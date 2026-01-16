import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import ApplicationProgress from '../components/ApplicationProgress';
import UnderwriterReport from '../components/UnderwriterReport';
import Select from '../components/Select';
import Textarea from '../components/Textarea';
import Input from '../components/Input';

function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [statusUpdateForm, setStatusUpdateForm] = useState({ status: '', feedback: '' });
  const [docUploadForm, setDocUploadForm] = useState({ description: '', document_type_id: '', is_required: false });
  const [dragActive, setDragActive] = useState(false);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [underwriting, setUnderwriting] = useState(null);
  const [givingConsent, setGivingConsent] = useState(false);
  const role = localStorage.getItem('role');
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';

  useEffect(() => {
    loadApplication();
    loadDocumentTypes();
    loadUnderwriting();
  }, [id]);
  
  async function loadDocumentTypes() {
    try {
      const res = await api.get('/api/documents/types/?loan_type=business_finance');
      setDocumentTypes(res.data || []);
    } catch (err) {
      console.error('Failed to load document types:', err);
    }
  }
  
  async function loadUnderwriting() {
    try {
      // Try to get underwriting from application endpoint first
      const appRes = await api.get(`/api/applications/${id}/`);
      if (appRes.data.project) {
        // Get the latest underwriting report for this project
        const reportsRes = await api.get(`/api/underwriting/reports/?project=${appRes.data.project}`);
        if (reportsRes.data && reportsRes.data.length > 0) {
          const latestReport = reportsRes.data[0];
          setUnderwriting({
            content: latestReport.content,
            summary: latestReport.content?.substring(0, 500) + '...',
            risk_score: 'N/A',
            recommendation: 'pending',
            documents_valid: 0,
            documents_analyzed: 0,
          });
          return;
        }
      }
      // Fallback to application underwriting endpoint
      const res = await api.get(`/api/applications/${id}/underwriting/`);
      setUnderwriting(res.data);
    } catch (err) {
      // Underwriting may not exist yet
      console.log('No underwriting assessment available');
      setUnderwriting(null);
    }
  }

  async function loadApplication() {
    setLoading(true);
    setError(null);
    try {
      const [appRes, historyRes, docsRes, messagesRes] = await Promise.all([
        api.get(`/api/applications/${id}/`),
        api.get(`/api/applications/${id}/status_history/`).catch(() => ({ data: [] })),
        api.get(`/api/applications/${id}/documents/`).catch(() => ({ data: [] })),
        api.get(`/api/messages/?application=${id}`).catch(() => ({ data: [] })),
      ]);
      setApplication(appRes.data);
      setStatusHistory(historyRes.data || []);
      setDocuments(docsRes.data || []);
      setMessages(messagesRes.data || []);
      
      // Load underwriting if lender
      if (role === 'Lender') {
        loadUnderwriting();
      }
    } catch (err) {
      console.error('ApplicationDetail loadApplication error:', err);
      setError('Failed to load application details');
    } finally {
      setLoading(false);
    }
  }

  async function handleDocumentUpload(files) {
    if (!files || files.length === 0) return;
    
    setUploadingDoc(true);
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('description', docUploadForm.description);
    if (docUploadForm.document_type_id) {
      formData.append('document_type_id', docUploadForm.document_type_id);
    }
    formData.append('is_required', docUploadForm.is_required);
    
    try {
      await api.post(`/api/applications/${id}/documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadApplication();
      await loadUnderwriting();
      setDocUploadForm({ description: '', document_type_id: '', is_required: false });
    } catch (err) {
      console.error('Document upload error:', err);
      alert('Failed to upload document: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingDoc(false);
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDocumentUpload(e.dataTransfer.files);
    }
  }

  const handleViewDocument = async (docId) => {
    try {
      const response = await api.get(`/api/applications/${id}/documents/${docId}/view/`, {
        responseType: 'blob',
      });
      
      // Create a blob URL and open in new tab
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      
      // Clean up the URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('Failed to view document:', err);
      alert('Failed to view document: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDownloadDocument = async (docId, fileName) => {
    try {
      const response = await api.get(`/api/applications/${id}/documents/${docId}/download/`, {
        responseType: 'blob',
      });
      
      // Create a blob and trigger download
      const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download document:', err);
      alert('Failed to download document: ' + (err.response?.data?.error || err.message));
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      submitted: { variant: 'info', label: 'Submitted' },
      opened: { variant: 'info', label: 'Opened' },
      under_review: { variant: 'warning', label: 'Under Review' },
      further_info_required: { variant: 'warning', label: 'Further Info Required' },
      credit_check: { variant: 'info', label: 'Credit Check' },
      approved: { variant: 'success', label: 'Approved' },
      accepted: { variant: 'success', label: 'Accepted' },
      declined: { variant: 'error', label: 'Declined' },
      withdrawn: { variant: 'info', label: 'Withdrawn' },
      completed: { variant: 'success', label: 'Completed' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading application...</p>
      </div>
    );
  }

  if (error || !application) {
    const backPath = role === 'Borrower' ? '/borrower/applications' : '/lender/applications';
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
        }}>
          <p>{error || 'Application not found'}</p>
          <Button onClick={() => navigate(backPath)} variant="primary">
            Back to Applications
          </Button>
        </div>
      </div>
    );
  }

  const backPath = role === 'Borrower' ? '/borrower/applications' : '/lender/applications';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'messages', label: `Messages (${messages.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'underwriter-report', label: "Underwriter's Report" },
    { id: 'progress', label: 'Progress' },
  ];

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.lg, display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Button onClick={() => navigate(backPath)} variant="outline">
          ← Back
        </Button>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          Application #{application.id}
        </h1>
        {getStatusBadge(application.status)}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.sm,
        borderBottom: `2px solid ${theme.colors.gray200}`,
        marginBottom: theme.spacing.xl,
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              color: activeTab === tab.id ? theme.colors.primary : theme.colors.textSecondary,
              fontWeight: activeTab === tab.id ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
              cursor: 'pointer',
              fontSize: theme.typography.fontSize.base,
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.xl }}>
          {/* Main Details */}
          <div>
            {/* Application Terms */}
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                Application Terms
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Loan Amount:</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                    £{parseFloat(application.proposed_loan_amount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Interest Rate:</strong>
                  </p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                    {application.proposed_interest_rate ? `${application.proposed_interest_rate}%` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Term:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{application.proposed_term_months} months</p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>LTV Ratio:</strong>
                  </p>
                  <p style={{ margin: 0 }}>
                    {application.proposed_ltv_ratio ? `${application.proposed_ltv_ratio}%` : 'N/A'}
                  </p>
                </div>
              </div>
              {application.notes && (
                <div style={{ marginTop: theme.spacing.lg }}>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Notes:</strong>
                  </p>
                  <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                    {application.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Project Details */}
            {application.project_details && (
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Project Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Address:</strong>
                    </p>
                    <p style={{ margin: 0 }}>
                      {application.project_details.address}<br />
                      {application.project_details.town}, {application.project_details.county}<br />
                      {application.project_details.postcode}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Funding Type:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.project_details.funding_type}</p>
                    <p style={{ margin: `${theme.spacing.md} 0 ${theme.spacing.xs}`, color: theme.colors.textSecondary }}>
                      <strong>Property Type:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.project_details.property_type}</p>
                  </div>
                </div>
                {application.project_details.project_reference && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <Badge variant="info">
                      Project Reference: {application.project_details.project_reference}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Borrower/Lender Details */}
            {role === 'Lender' && application.borrower_details && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Borrower Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Company Name:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.borrower_details.company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Contact:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.borrower_details.user_email || 'N/A'}</p>
                  </div>
                </div>
                
                {/* Company Charges */}
                {application.borrower_details.charges_summary && application.borrower_details.charges_summary.total_charges > 0 && (
                  <div style={{ marginTop: theme.spacing.lg, paddingTop: theme.spacing.lg, borderTop: `1px solid ${theme.colors.gray200}` }}>
                    <h4 style={{
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      marginBottom: theme.spacing.md,
                    }}>
                      Company Charges
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                      <div>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                          {application.borrower_details.charges_summary.total_charges || 0}
                        </p>
                      </div>
                      {application.borrower_details.charges_summary.active_charges > 0 && (
                        <div>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.warning }}>
                            {application.borrower_details.charges_summary.active_charges || 0}
                          </p>
                        </div>
                      )}
                      {application.borrower_details.charges_summary.satisfied_charges > 0 && (
                        <div>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Satisfied Charges</p>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.success }}>
                            {application.borrower_details.charges_summary.satisfied_charges || 0}
                          </p>
                        </div>
                      )}
                    </div>
                    {application.borrower_details.charges_summary.charges_summary?.active && application.borrower_details.charges_summary.charges_summary.active.length > 0 && (
                      <div style={{ marginTop: theme.spacing.md }}>
                        <h5 style={{
                          fontSize: theme.typography.fontSize.base,
                          fontWeight: theme.typography.fontWeight.semibold,
                          marginBottom: theme.spacing.sm,
                          color: theme.colors.warning,
                        }}>
                          Active Charges Details
                        </h5>
                        <div style={{ display: 'grid', gap: theme.spacing.sm }}>
                          {application.borrower_details.charges_summary.charges_summary.active.slice(0, 5).map((charge, idx) => (
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
                        {application.borrower_details.charges_summary.charges_summary.active.length > 5 && (
                          <p style={{ 
                            margin: `${theme.spacing.sm} 0 0 0`, 
                            fontSize: theme.typography.fontSize.sm, 
                            color: theme.colors.textSecondary,
                            fontStyle: 'italic',
                          }}>
                            ... and {application.borrower_details.charges_summary.charges_summary.active.length - 5} more active charge(s)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {role === 'Borrower' && application.lender_details && (
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Lender Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Organisation:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.lender_details.organisation_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Contact:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{application.lender_details.contact_email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Status Update (Lender only) */}
            {isLender && (
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Update Status</h3>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{
                    display: 'block',
                    marginBottom: theme.spacing.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                  }}>
                    New Status
                  </label>
                  <Select
                    value={statusUpdateForm.status}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, status: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select status...</option>
                    <option value="opened">Opened</option>
                    <option value="under_review">Under Review</option>
                    <option value="further_info_required">Further Information Required</option>
                    <option value="credit_check">Credit Check/Underwriting</option>
                    <option value="approved">Approved</option>
                    <option value="accepted">Accepted</option>
                    <option value="declined">Declined</option>
                    <option value="withdrawn">Withdrawn</option>
                    <option value="completed">Completed</option>
                  </Select>
                </div>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{
                    display: 'block',
                    marginBottom: theme.spacing.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                  }}>
                    Feedback/Notes (optional)
                  </label>
                  <Textarea
                    value={statusUpdateForm.feedback}
                    onChange={(e) => setStatusUpdateForm({ ...statusUpdateForm, feedback: e.target.value })}
                    placeholder="Add feedback or notes about this status change..."
                    rows={3}
                  />
                </div>
                <Button
                  variant="primary"
                  style={{ width: '100%' }}
                  onClick={async () => {
                    if (!statusUpdateForm.status) {
                      alert('Please select a status');
                      return;
                    }
                    setUpdatingStatus(true);
                    try {
                      await api.post(`/api/applications/${id}/update_status/`, {
                        status: statusUpdateForm.status,
                        feedback: statusUpdateForm.feedback,
                      });
                      await loadApplication();
                      setStatusUpdateForm({ status: '', feedback: '' });
                    } catch (err) {
                      console.error('Status update error:', err);
                      alert('Failed to update status: ' + (err.response?.data?.error || err.message));
                    } finally {
                      setUpdatingStatus(false);
                    }
                  }}
                  disabled={updatingStatus || !statusUpdateForm.status}
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </Button>
              </div>
            )}

            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quick Actions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                <Link 
                  to={`/${role.toLowerCase()}/messages?application_id=${application.id}`} 
                  style={{ textDecoration: 'none' }}
                >
                  <Button variant="primary" style={{ width: '100%' }}>
                    Message {role === 'Borrower' ? 'Lender' : 'Borrower'}
                  </Button>
                </Link>
                
                {/* Lender: View Deal Room (if accepted) */}
                {isLender && application.status === 'accepted' && application.deal_deal_id && (
                  <Link 
                    to={`/deals/${application.deal_deal_id}`}
                    style={{ textDecoration: 'none', width: '100%', display: 'block', marginBottom: theme.spacing.sm }}
                  >
                    <Button variant="primary" style={{ width: '100%' }}>
                      🏢 Open Deal Room
                    </Button>
                  </Link>
                )}
                
                {/* Borrower: View Deal Room (if accepted) */}
                {isBorrower && application.status === 'accepted' && application.deal_deal_id && (
                  <Link 
                    to={`/deals/${application.deal_deal_id}`}
                    style={{ textDecoration: 'none', width: '100%', display: 'block', marginBottom: theme.spacing.sm }}
                  >
                    <Button variant="primary" style={{ width: '100%' }}>
                      🏢 Open Deal Room
                    </Button>
                  </Link>
                )}
                
                {/* Lender: View Borrower Information (if accepted and consent given) */}
                {isLender && application.status === 'accepted' && application.borrower_consent_given && (
                  <Link 
                    to={`/lender/applications/${application.id}/borrower-info`}
                    style={{ textDecoration: 'none' }}
                  >
                    <Button variant="secondary" style={{ width: '100%' }}>
                      📋 View Borrower Information
                    </Button>
                  </Link>
                )}
                
                {/* Borrower: Give Consent (if application is accepted) */}
                {isBorrower && application.status === 'accepted' && !application.borrower_consent_given && (
                  <Button 
                    variant="primary" 
                    style={{ width: '100%' }}
                    onClick={async () => {
                      setGivingConsent(true);
                      try {
                        await api.post(`/api/applications/${id}/give_consent/`);
                        await loadApplication();
                        alert('Consent given successfully. The lender can now view your information.');
                      } catch (err) {
                        console.error('Failed to give consent:', err);
                        alert('Failed to give consent: ' + (err.response?.data?.error || err.message));
                      } finally {
                        setGivingConsent(false);
                      }
                    }}
                    disabled={givingConsent}
                  >
                    {givingConsent ? 'Processing...' : '✓ Give Consent to Share Information'}
                  </Button>
                )}
                
                {/* Borrower: Consent Status */}
                {isBorrower && application.status === 'accepted' && (
                  <div style={{
                    padding: theme.spacing.md,
                    background: application.borrower_consent_given ? theme.colors.successLight : theme.colors.warningLight,
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.fontSize.sm,
                  }}>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                      {application.borrower_consent_given ? '✓ Consent Given' : '⚠️ Consent Required'}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.xs }}>
                      {application.borrower_consent_given 
                        ? 'Lender can view your information'
                        : 'Give consent to allow lender to view your information'}
                    </p>
                    {application.borrower_consent_given && application.borrower_consent_given_at && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                        Given on {new Date(application.borrower_consent_given_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Messages</h2>
          {messages.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary }}>No messages yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  padding: theme.spacing.md,
                  background: msg.sender === role ? theme.colors.primaryLight : theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                    <strong>{msg.sender_username || 'Unknown'}</strong>
                    <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {new Date(msg.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{msg.body}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: theme.spacing.lg }}>
            <Link to={`/${role.toLowerCase()}/messages?application_id=${application.id}`}>
              <Button variant="primary">Go to Messages</Button>
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          {/* AI Underwriting Report (for lenders) */}
          {isLender && (
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                <h2 style={{ margin: 0 }}>AI Underwriting Report</h2>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await api.post('/api/underwriting/reports/generate/', {
                        project_id: application.project,
                        report_type: 'lender',
                      });
                      await loadUnderwriting();
                      alert('Underwriting report generated successfully!');
                    } catch (err) {
                      console.error('Failed to generate report:', err);
                      alert('Failed to generate report: ' + (err.response?.data?.detail || err.message));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  Generate Report
                </Button>
              </div>
              {underwriting ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Risk Score</p>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold }}>
                        {underwriting.risk_score || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Recommendation</p>
                      <Badge variant={underwriting.recommendation === 'approve' ? 'success' : underwriting.recommendation === 'decline' ? 'error' : 'warning'}>
                        {underwriting.recommendation || 'Pending'}
                      </Badge>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Documents Valid</p>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                        {underwriting.documents_valid || 0} / {underwriting.documents_analyzed || 0}
                      </p>
                    </div>
                  </div>
                  {underwriting.summary && (
                    <div style={{
                      padding: theme.spacing.md,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                      marginTop: theme.spacing.md,
                    }}>
                      <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>Report Summary</h3>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                        {underwriting.summary}
                      </p>
                    </div>
                  )}
                  {underwriting.content && (
                    <div style={{
                      padding: theme.spacing.md,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                      marginTop: theme.spacing.md,
                      maxHeight: '400px',
                      overflowY: 'auto',
                    }}>
                      <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>Full Report</h3>
                      <div style={{ fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                        {underwriting.content}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.lg }}>
                  No underwriting report available. Click "Generate Report" to create one.
                </p>
              )}
            </div>
          )}

          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Upload Documents</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
              Upload required documents for your loan application. Documents will be automatically validated and assessed.
            </p>
            
            {/* Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                marginBottom: theme.spacing.lg,
                padding: theme.spacing.xl,
                border: `2px dashed ${dragActive ? theme.colors.primary : theme.colors.gray300}`,
                borderRadius: theme.borderRadius.md,
                textAlign: 'center',
                background: dragActive ? theme.colors.primaryLight : theme.colors.gray50,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <input
                id="file-upload"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => handleDocumentUpload(e.target.files)}
              />
              <div style={{ fontSize: '48px', marginBottom: theme.spacing.sm }}>📎</div>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, marginBottom: theme.spacing.xs }}>
                Drag and drop files here
              </p>
              <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                or click to browse • PDF, Images, Word, Excel
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
              <div>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                  Document Type
                </label>
                <select
                  value={docUploadForm.document_type_id}
                  onChange={(e) => setDocUploadForm({ ...docUploadForm, document_type_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: theme.spacing.sm,
                    border: `1px solid ${theme.colors.gray300}`,
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.fontSize.base,
                    fontFamily: theme.typography.fontFamily,
                    backgroundColor: theme.colors.white,
                  }}
                >
                  <option value="">Select document type...</option>
                  {documentTypes.map(dt => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name} {dt.is_required && '(Required)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                  Description (Optional)
                </label>
                <Input
                  name="description"
                  value={docUploadForm.description}
                  onChange={(e) => setDocUploadForm({ ...docUploadForm, description: e.target.value })}
                  placeholder="e.g., Q1 2024 Bank Statement"
                />
              </div>
            </div>

            {uploadingDoc && (
              <div style={{ padding: theme.spacing.md, background: theme.colors.infoLight, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.md }}>
                <p style={{ margin: 0, color: theme.colors.info }}>
                  ⏳ Uploading and validating documents...
                </p>
              </div>
            )}
          </div>

          {/* Documents List */}
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Uploaded Documents ({documents.length})</h3>
            {documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
                <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
                  No documents uploaded yet.
                </p>
                <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
                  Required documents: Passport/ID, Utility Bill, Bank Statements, Company Accounts
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {documents.map(doc => (
                  <div key={doc.id} style={{
                    padding: theme.spacing.md,
                    border: `1px solid ${theme.colors.gray200}`,
                    borderRadius: theme.borderRadius.md,
                    background: doc.validation_status === 'valid' ? theme.colors.successLight : 
                               doc.validation_status === 'invalid' ? theme.colors.errorLight : 
                               theme.colors.gray50,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                          <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                            {doc.file_name}
                          </p>
                          {doc.document_type && (
                            <Badge variant="info" style={{ fontSize: theme.typography.fontSize.xs }}>
                              {doc.document_type}
                            </Badge>
                          )}
                          {doc.is_required && (
                            <Badge variant="warning" style={{ fontSize: theme.typography.fontSize.xs }}>
                              Required
                            </Badge>
                          )}
                        </div>
                        {doc.description && (
                          <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            {doc.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
                          <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                            {(doc.file_size / 1024).toFixed(2)} KB
                          </span>
                          <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                            Uploaded by {doc.uploaded_by} • {new Date(doc.uploaded_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDocument(doc.id)}
                          >
                            👁️ View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.id, doc.file_name)}
                          >
                            ⬇️ Download
                          </Button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.spacing.xs }}>
                        {doc.validation_status && (
                          <Badge 
                            variant={doc.validation_status === 'valid' ? 'success' : doc.validation_status === 'invalid' ? 'error' : 'warning'}
                          >
                            {doc.validation_status === 'valid' ? '✓ Valid' : 
                             doc.validation_status === 'invalid' ? '✗ Invalid' : 
                             '⏳ Validating'}
                          </Badge>
                        )}
                        {doc.validation_score !== null && doc.validation_score !== undefined && (
                          <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                            Score: {doc.validation_score}/100
                          </span>
                        )}
                      </div>
                    </div>
                    {doc.validation_notes && (
                      <div style={{ 
                        marginTop: theme.spacing.sm, 
                        padding: theme.spacing.xs, 
                        background: theme.colors.white,
                        borderRadius: theme.borderRadius.sm,
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.textSecondary 
                      }}>
                        {doc.validation_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'underwriter-report' && (
        <UnderwriterReport
          applicationId={id}
          role={role}
          isAdmin={role === 'Admin'}
        />
      )}

      {activeTab === 'progress' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Application Progress</h2>
          <ApplicationProgress application={application} statusHistory={statusHistory} />
        </div>
      )}
    </div>
  );
}

export default ApplicationDetail;
