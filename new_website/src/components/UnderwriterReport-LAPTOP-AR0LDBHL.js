import React, { useState, useEffect } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Badge from './Badge';
import Input from './Input';

function UnderwriterReport({ applicationId, role, isAdmin }) {
  const isLender = role === 'Lender';
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [stepUpAuth, setStepUpAuth] = useState({ required: false, verified: false });
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [showDataSources, setShowDataSources] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport();
    
    // Set up polling if report is generating
    let pollInterval = null;
    const startPolling = () => {
      pollInterval = setInterval(async () => {
        try {
          const res = await api.get(`/api/applications/${applicationId}/underwriter-report/`);
          if (res.data.status === 'ready' || res.data.status === 'failed') {
            clearInterval(pollInterval);
            setReport(res.data);
            setGenerating(false);
          } else if (res.data.status === 'generating') {
            setReport(res.data);
          }
        } catch (err) {
          console.error('Polling error:', err);
          // Don't clear interval on error, keep trying
        }
      }, 3000); // Poll every 3 seconds
    };
    
    // Check if we need to start polling after initial load
    const checkAndPoll = async () => {
      try {
        const res = await api.get(`/api/applications/${applicationId}/underwriter-report/`);
        if (res.data.status === 'generating') {
          setReport(res.data);
          setGenerating(true);
          startPolling();
        }
      } catch (err) {
        // Ignore errors during check
      }
    };
    
    // Small delay to allow initial load to complete
    const timeoutId = setTimeout(checkAndPoll, 1000);
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/applications/${applicationId}/underwriter-report/`);
      
      if (res.data.requires_step_up) {
        setStepUpAuth({ required: true, verified: false });
        setLoading(false);
        return;
      }
      
      if (res.data.status === 'not_generated') {
        setReport(null);
        setLoading(false);
        return;
      }
      
      setReport(res.data);
      
      // If status is generating, start polling
      if (res.data.status === 'generating') {
        setGenerating(true);
      }
    } catch (err) {
      console.error('Failed to load underwriter report:', err);
      if (err.response?.status === 401 && err.response?.data?.requires_step_up) {
        setStepUpAuth({ required: true, verified: false });
      } else {
        setError(err.response?.data?.error || 'Failed to load underwriter report');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyStepUpAuth = async () => {
    try {
      const res = await api.post(`/api/applications/${applicationId}/verify-step-up-auth/`, {
        password: stepUpPassword,
      });
      
      if (res.data.verified) {
        setStepUpAuth({ required: false, verified: true });
        setStepUpPassword('');
        await loadReport();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Password verification failed');
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setError(null);
    const startTime = Date.now();
    const MAX_POLL_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    try {
      const res = await api.post(`/api/applications/${applicationId}/generate-underwriter-report/`);
      setReport({ 
        ...report, 
        status: 'generating',
        id: res.data.report_id,
        version: res.data.version,
      });
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const elapsed = Date.now() - startTime;
          
          // Check timeout
          if (elapsed >= MAX_POLL_TIME) {
            clearInterval(pollInterval);
            setGenerating(false);
            setError('Report generation is taking longer than expected. Please refresh the page to check status.');
            return;
          }
          
          const reportRes = await api.get(`/api/applications/${applicationId}/underwriter-report/`);
          if (reportRes.data.status === 'ready' || reportRes.data.status === 'failed') {
            clearInterval(pollInterval);
            setReport(reportRes.data);
            setGenerating(false);
          } else if (reportRes.data.status === 'generating') {
            // Update report to show it's still generating
            setReport(reportRes.data);
          }
        } catch (err) {
          console.error('Polling error:', err);
          // Don't clear interval on error, keep trying unless timeout
          const elapsed = Date.now() - startTime;
          if (elapsed >= MAX_POLL_TIME) {
            clearInterval(pollInterval);
            setGenerating(false);
            setError('Report generation timeout. Please refresh the page to check status.');
          }
        }
      }, 3000); // Poll every 3 seconds
      
      // Cleanup on unmount
      return () => clearInterval(pollInterval);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError(err.response?.data?.error || 'Failed to generate report');
      setGenerating(false);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      // For now, use window.print() - in production, generate server-side PDF
      window.print();
    } catch (err) {
      setError('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  const lockReport = async () => {
    try {
      await api.post(`/api/applications/${applicationId}/lock-underwriter-report/`);
      await loadReport();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to lock report');
    }
  };

  // Step-up authentication modal
  if (stepUpAuth.required && !stepUpAuth.verified) {
    return (
      <div style={{
        ...commonStyles.card,
        maxWidth: '400px',
        margin: '0 auto',
        padding: theme.spacing.xl,
      }}>
        <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Step-Up Authentication Required</h2>
        <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
          Please enter your password to view the Underwriter's Report.
        </p>
        <Input
          type="password"
          label="Password"
          value={stepUpPassword}
          onChange={(e) => setStepUpPassword(e.target.value)}
          style={{ marginBottom: theme.spacing.md }}
        />
        {error && (
          <p style={{ color: theme.colors.error, fontSize: theme.typography.fontSize.sm, marginBottom: theme.spacing.md }}>
            {error}
          </p>
        )}
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <Button variant="primary" onClick={verifyStepUpAuth}>
            Verify
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={commonStyles.card}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>
          Loading underwriter report...
        </p>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={commonStyles.card}>
        <p style={{ color: theme.colors.error }}>{error}</p>
        {(isAdmin || isLender) && (
          <Button variant="primary" onClick={generateReport} style={{ marginTop: theme.spacing.md }} disabled={generating}>
            {generating ? 'Generating Report...' : 'Generate Report'}
          </Button>
        )}
      </div>
    );
  }

  if (!report) {
    return (
      <div style={commonStyles.card}>
        <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Underwriter's Report</h2>
        <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
          No report has been generated yet. Reports are automatically generated when an application is submitted.
        </p>
        {(isAdmin || isLender) && (
          <Button variant="primary" onClick={generateReport} disabled={generating}>
            {generating ? 'Generating Report...' : 'Generate Report Now'}
          </Button>
        )}
      </div>
    );
  }

  if (report.status === 'generating') {
    const elapsed = report.created_at 
      ? Math.floor((Date.now() - new Date(report.created_at).getTime()) / 1000)
      : 0;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    return (
      <div style={commonStyles.card}>
        <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Underwriter's Report</h2>
        <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
          Report is being generated. This may take 1-3 minutes...
        </p>
        <div style={{ marginBottom: theme.spacing.md }}>
          <Badge variant="warning">Generating</Badge>
          {elapsed > 0 && (
            <span style={{ 
              marginLeft: theme.spacing.md, 
              fontSize: theme.typography.fontSize.sm, 
              color: theme.colors.textSecondary 
            }}>
              Elapsed: {minutes}m {seconds}s
            </span>
          )}
        </div>
        <div style={{
          background: theme.colors.gray50,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.fontSize.sm,
          color: theme.colors.textSecondary,
        }}>
          <p style={{ margin: 0 }}>
            The report is being generated in the background using AI. 
            This page will automatically update when the report is ready.
            Maximum wait time: 5 minutes.
          </p>
        </div>
      </div>
    );
  }

  if (report.status === 'failed') {
    return (
      <div style={commonStyles.card}>
        <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Underwriter's Report</h2>
        <p style={{ color: theme.colors.error, marginBottom: theme.spacing.sm, fontWeight: theme.typography.fontWeight.semibold }}>
          Report generation failed. Please try again.
        </p>
        {report.generation_error && (
          <div style={{
            padding: theme.spacing.md,
            background: theme.colors.errorLight || '#fee',
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.errorDark || '#c00',
            maxHeight: '200px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            <strong>Error Details:</strong><br />
            {report.generation_error.length > 500 
              ? report.generation_error.substring(0, 500) + '...' 
              : report.generation_error}
          </div>
        )}
        {(isAdmin || isLender) && (
          <Button variant="primary" onClick={generateReport} disabled={generating}>
            {generating ? 'Generating Report...' : 'Retry Generation'}
          </Button>
        )}
      </div>
    );
  }

  const reportData = report.report_json || {};
  const execSummary = reportData.executiveSummary || {};
  const facilityRequest = reportData.facilityRequest || {};
  const borrowerCompany = reportData.borrowerCompanyOverview || {};
  const applicants = reportData.applicantsAndGuarantors || [];
  const financial = reportData.financialOverview || {};
  const strengths = reportData.strengths || [];
  const risks = reportData.risksAndMitigants || [];
  const queries = reportData.queries || [];
  const conditions = reportData.conditionsPrecedent || [];
  const covenants = reportData.suggestedCovenants || [];
  const documents = reportData.documentsReviewed || [];
  const recommendation = reportData.recommendation || {};

  return (
    <div style={{ ...commonStyles.container, '@media print': { padding: 0 } }}>
      {/* Header Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        flexWrap: 'wrap',
        gap: theme.spacing.md,
      }}>
        <div>
          <h2 style={{ margin: `0 0 ${theme.spacing.xs} 0` }}>Underwriter's Report</h2>
          <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center', marginTop: theme.spacing.xs }}>
            <Badge variant={report.status === 'ready' ? 'success' : 'warning'}>
              {report.status === 'ready' ? 'Ready' : report.status}
            </Badge>
            {report.is_locked && <Badge variant="info">Locked</Badge>}
            <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
              Version {report.version} • Generated {new Date(report.created_at).toLocaleDateString('en-GB')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          {(isAdmin || role === 'Lender') && (
            <Button variant="outline" onClick={exportPDF} loading={exporting}>
              Export PDF
            </Button>
          )}
          {((isAdmin || isLender) && !report.is_locked) && (
            <Button variant="outline" onClick={generateReport} loading={generating}>
              Regenerate
            </Button>
          )}
          {isAdmin && !report.is_locked && (
            <Button variant="outline" onClick={lockReport}>
              Lock Report
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowDataSources(!showDataSources)}
            >
              {showDataSources ? 'Hide' : 'Show'} Data Sources
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
        }}>
          {error}
        </div>
      )}

      {/* Executive Summary */}
      <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
          Executive Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Borrower</p>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{execSummary.borrower_name || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Facility Amount</p>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
              £{parseFloat(execSummary.facility_amount || 0).toLocaleString('en-GB')}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Term</p>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{execSummary.facility_term || 'N/A'} months</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Recommendation</p>
            <Badge variant={
              execSummary.recommendation === 'Approve' ? 'success' :
              execSummary.recommendation === 'Approve with Conditions' ? 'warning' :
              'error'
            }>
              {execSummary.recommendation || 'Pending'}
            </Badge>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Risk Rating</p>
            <Badge variant={
              execSummary.risk_rating === 'Low' ? 'success' :
              execSummary.risk_rating === 'Medium' ? 'warning' :
              'error'
            }>
              {execSummary.risk_rating || 'Not provided'}
            </Badge>
          </div>
        </div>
        {execSummary.key_highlights && execSummary.key_highlights.length > 0 && (
          <div style={{ marginTop: theme.spacing.md }}>
            <p style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontWeight: theme.typography.fontWeight.semibold }}>Key Highlights:</p>
            <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
              {execSummary.key_highlights.map((highlight, idx) => (
                <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{highlight}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Facility Request */}
      <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Facility Request</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Amount</p>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
              £{parseFloat(facilityRequest.amount || 0).toLocaleString('en-GB')}
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Term</p>
            <p style={{ margin: 0 }}>{facilityRequest.term_months || 'N/A'} months</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Purpose</p>
            <p style={{ margin: 0 }}>{facilityRequest.purpose || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Security</p>
            <p style={{ margin: 0 }}>{facilityRequest.security || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Repayment Method</p>
            <p style={{ margin: 0 }}>{facilityRequest.repayment_method || 'Not provided'}</p>
          </div>
        </div>
      </div>

      {/* Borrower Company Overview */}
      <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Borrower Company Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: theme.spacing.md }}>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Name</p>
            <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{borrowerCompany.company_name || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Number</p>
            <p style={{ margin: 0 }}>{borrowerCompany.company_number || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Status</p>
            <p style={{ margin: 0 }}>{borrowerCompany.company_status || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Incorporation Date</p>
            <p style={{ margin: 0 }}>{borrowerCompany.incorporation_date || 'Not provided'}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Trading Address</p>
            <p style={{ margin: 0 }}>{borrowerCompany.trading_address || 'Not provided'}</p>
          </div>
          {borrowerCompany.sic_codes && borrowerCompany.sic_codes.length > 0 && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>SIC Codes</p>
              <p style={{ margin: 0 }}>{borrowerCompany.sic_codes.join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Applicants and Guarantors */}
      {applicants.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Applicants and Guarantors</h3>
          <div style={{ display: 'grid', gap: theme.spacing.md }}>
            {applicants.map((applicant, idx) => (
              <div key={idx} style={{
                padding: theme.spacing.md,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.md,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.sm }}>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Name</p>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{applicant.name || 'Not provided'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Role</p>
                    <p style={{ margin: 0 }}>{applicant.role || 'Not provided'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Nationality</p>
                    <p style={{ margin: 0 }}>{applicant.nationality || 'Not provided'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Employment Status</p>
                    <p style={{ margin: 0 }}>{applicant.employment_status || 'Not provided'}</p>
                  </div>
                  {applicant.net_monthly_income !== null && (
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Net Monthly Income</p>
                      <p style={{ margin: 0 }}>£{parseFloat(applicant.net_monthly_income).toLocaleString('en-GB')}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Financial Overview */}
      <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Financial Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md }}>
          {financial.total_income !== null && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Income</p>
              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                £{parseFloat(financial.total_income).toLocaleString('en-GB')}
              </p>
            </div>
          )}
          {financial.total_expenditure !== null && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Expenditure</p>
              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                £{parseFloat(financial.total_expenditure).toLocaleString('en-GB')}
              </p>
            </div>
          )}
          {financial.total_assets !== null && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Assets</p>
              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                £{parseFloat(financial.total_assets).toLocaleString('en-GB')}
              </p>
            </div>
          )}
          {financial.total_liabilities !== null && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Liabilities</p>
              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                £{parseFloat(financial.total_liabilities).toLocaleString('en-GB')}
              </p>
            </div>
          )}
          {financial.net_worth !== null && (
            <div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Net Worth</p>
              <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                £{parseFloat(financial.net_worth).toLocaleString('en-GB')}
              </p>
            </div>
          )}
          {financial.charges_summary && financial.charges_summary.total_charges > 0 && (
            <>
              <div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                  {financial.charges_summary.total_charges || 0}
                </p>
              </div>
              {financial.charges_summary.active_charges > 0 && (
                <div>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.warning }}>
                    {financial.charges_summary.active_charges || 0}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Company Charges Details */}
        {financial.charges_summary && financial.charges_summary.total_charges > 0 && (
          <div style={{ marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.gray200}` }}>
            <h4 style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              marginBottom: theme.spacing.md,
            }}>
              Company Charges
            </h4>
            <p style={{ 
              fontSize: theme.typography.fontSize.sm, 
              color: theme.colors.textSecondary,
              marginBottom: theme.spacing.md,
            }}>
              Registered charges (mortgages, debentures) against the company from Companies House.
            </p>
            {financial.charges_summary.active_charges_list && financial.charges_summary.active_charges_list.length > 0 && (
              <div style={{ marginTop: theme.spacing.md }}>
                <h5 style={{
                  fontSize: theme.typography.fontSize.base,
                  fontWeight: theme.typography.fontWeight.semibold,
                  marginBottom: theme.spacing.sm,
                  color: theme.colors.warning,
                }}>
                  Active Charges ({financial.charges_summary.active_charges_list.length})
                </h5>
                <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                  {financial.charges_summary.active_charges_list.map((charge, idx) => (
                    <div key={idx} style={{
                      padding: theme.spacing.md,
                      background: theme.colors.warningLight,
                      borderRadius: theme.borderRadius.md,
                      borderLeft: `4px solid ${theme.colors.warning}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                            {charge.charge_code || charge.charge_number || `Charge ${idx + 1}`}
                          </p>
                          {charge.created_on && (
                            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Created: {new Date(charge.created_on).toLocaleDateString('en-GB')}
                            </p>
                          )}
                          {charge.persons_entitled && charge.persons_entitled.length > 0 && (
                            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                              <strong>Charged to:</strong> {charge.persons_entitled.map(p => p.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <Badge variant="warning">Active</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {financial.charges_summary.satisfied_charges > 0 && (
              <div style={{ marginTop: theme.spacing.md }}>
                <p style={{ 
                  fontSize: theme.typography.fontSize.sm, 
                  color: theme.colors.textSecondary,
                }}>
                  {financial.charges_summary.satisfied_charges} satisfied charge(s) (not shown)
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Strengths</h3>
          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
            {strengths.map((strength, idx) => (
              <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks and Mitigants */}
      {risks.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Risks and Mitigants</h3>
          <div style={{ display: 'grid', gap: theme.spacing.md }}>
            {risks.map((risk, idx) => (
              <div key={idx} style={{
                padding: theme.spacing.md,
                background: theme.colors.warningLight,
                borderRadius: theme.borderRadius.md,
                borderLeft: `4px solid ${theme.colors.warning}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.xs }}>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>{risk.risk || 'Risk'}</p>
                  <Badge variant={
                    risk.severity === 'Low' ? 'success' :
                    risk.severity === 'Medium' ? 'warning' :
                    'error'
                  }>
                    {risk.severity || 'Unknown'}
                  </Badge>
                </div>
                {risk.mitigant && (
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                    <strong>Mitigant:</strong> {risk.mitigant}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Queries */}
      {queries.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Queries</h3>
          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
            {queries.map((query, idx) => {
              // Handle both string and object formats (objects have {section, query} keys)
              const queryText = typeof query === 'string' 
                ? query 
                : (query.query || (query.section ? `${query.section}: ${JSON.stringify(query)}` : JSON.stringify(query)));
              return (
                <li key={idx} style={{ marginBottom: theme.spacing.xs }}>
                  {queryText}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Conditions Precedent */}
      {conditions.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Conditions Precedent</h3>
          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
            {conditions.map((condition, idx) => (
              <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{condition}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Covenants */}
      {covenants.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Suggested Covenants</h3>
          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
            {covenants.map((covenant, idx) => (
              <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{covenant}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Documents Reviewed */}
      {documents.length > 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Documents Reviewed</h3>
          <div style={{ display: 'grid', gap: theme.spacing.sm }}>
            {documents.map((doc, idx) => (
              <div key={idx} style={{
                padding: theme.spacing.sm,
                background: theme.colors.gray50,
                borderRadius: theme.borderRadius.sm,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.medium }}>{doc.document_name || 'Unknown'}</p>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                    {doc.document_type || 'Unknown type'}
                  </p>
                </div>
                <Badge variant={
                  doc.status === 'Valid' ? 'success' :
                  doc.status === 'Invalid' ? 'error' :
                  'warning'
                }>
                  {doc.status || 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Recommendation</h3>
        <div style={{ marginBottom: theme.spacing.md }}>
          <Badge variant={
            recommendation.decision === 'Approve' ? 'success' :
            recommendation.decision === 'Approve with Conditions' ? 'warning' :
            'error'
          } style={{ marginBottom: theme.spacing.sm }}>
            {recommendation.decision || 'Pending'}
          </Badge>
        </div>
        {recommendation.rationale && (
          <p style={{ margin: `0 0 ${theme.spacing.md} 0`, lineHeight: theme.typography.lineHeight.relaxed }}>
            {recommendation.rationale}
          </p>
        )}
        {recommendation.conditions && recommendation.conditions.length > 0 && (
          <div style={{ marginTop: theme.spacing.md }}>
            <p style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontWeight: theme.typography.fontWeight.semibold }}>Conditions:</p>
            <ul style={{ margin: 0, paddingLeft: theme.spacing.lg }}>
              {recommendation.conditions.map((condition, idx) => (
                <li key={idx} style={{ marginBottom: theme.spacing.xs }}>{condition}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Plain Text Narrative */}
      {report.plain_text_narrative && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Narrative Summary</h3>
          <div style={{
            whiteSpace: 'pre-wrap',
            lineHeight: theme.typography.lineHeight.relaxed,
            color: theme.colors.textPrimary,
          }}>
            {report.plain_text_narrative}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      {reportData.disclaimer && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, pageBreakAfter: 'avoid' }}>
          <p style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
            margin: 0,
          }}>
            {reportData.disclaimer}
          </p>
        </div>
      )}

      {/* Data Sources (Admin Only) */}
      {showDataSources && report.input_data_snapshot && Object.keys(report.input_data_snapshot).length > 0 && (
        <div style={{ ...commonStyles.card, marginTop: theme.spacing.lg }}>
          <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Data Sources (Traceability)</h3>
          <pre style={{
            background: theme.colors.gray50,
            padding: theme.spacing.md,
            borderRadius: theme.borderRadius.md,
            overflow: 'auto',
            fontSize: theme.typography.fontSize.sm,
            maxHeight: '400px',
          }}>
            {JSON.stringify(report.input_data_snapshot, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default UnderwriterReport;
