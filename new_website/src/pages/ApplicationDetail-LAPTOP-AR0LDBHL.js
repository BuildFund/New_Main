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
import InformationRequestBuilder from '../components/InformationRequestBuilder';

function ApplicationDetail() {
  const params = useParams();
  // Handle both :id and :applicationId route parameters
  const id = params.id || params.applicationId;
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
  const [borrowerInfo, setBorrowerInfo] = useState(null);
  const [loadingBorrowerInfo, setLoadingBorrowerInfo] = useState(false);
  const [informationRequests, setInformationRequests] = useState([]);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const role = localStorage.getItem('role');
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';

  useEffect(() => {
    loadApplication();
    loadDocumentTypes();
    loadInformationRequests();
    // Only load underwriting for lenders and admins
    if (isLender || role === 'Admin') {
      loadUnderwriting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  
  async function loadInformationRequests() {
    setLoadingRequests(true);
    try {
      const res = await api.get(`/api/applications/${id}/information-requests/`);
      setInformationRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load information requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }
  
  // Load borrower information for Application Review (lenders only, pre-accept)
  useEffect(() => {
    if (isLender && application && application.status !== 'accepted' && activeTab === 'company') {
      loadBorrowerInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLender, application, activeTab]);
  
  async function loadBorrowerInfo() {
    if (borrowerInfo || loadingBorrowerInfo) return;
    setLoadingBorrowerInfo(true);
    try {
      const res = await api.get(`/api/applications/${id}/borrower_information/`);
      setBorrowerInfo(res.data);
    } catch (err) {
      console.error('Failed to load borrower information:', err);
      // Don't show error - borrower info may not be available yet
    } finally {
      setLoadingBorrowerInfo(false);
    }
  }
  
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
      // Get the latest comprehensive underwriter report
      const res = await api.get(`/api/applications/${id}/underwriter-report/`);
      if (res.data.status === 'ready' && res.data.report_json) {
        const reportJson = res.data.report_json;
        const executiveSummary = reportJson.executiveSummary || {};
        const recommendation = reportJson.recommendation || executiveSummary.recommendation || 'pending';
        const riskRating = executiveSummary.risk_rating || 'N/A';
        
        // Create summary from executive summary or plain text narrative
        let summary = '';
        if (executiveSummary.key_highlights && executiveSummary.key_highlights.length > 0) {
          summary = executiveSummary.key_highlights.join('\n\n');
        } else if (res.data.plain_text_narrative) {
          summary = res.data.plain_text_narrative.substring(0, 500) + '...';
        } else if (reportJson.plainTextNarrative) {
          summary = reportJson.plainTextNarrative.substring(0, 500) + '...';
        }
        
        // Use plain text narrative as content if available
        const content = res.data.plain_text_narrative || reportJson.plainTextNarrative || JSON.stringify(reportJson, null, 2);
        
        setUnderwriting({
          status: res.data.status,
          report_json: reportJson,
          content: content,
          summary: summary,
          risk_score: riskRating,
          recommendation: recommendation.toLowerCase(),
          documents_valid: reportJson.documentsReviewed?.filter((d) => d.status === 'valid')?.length || 0,
          documents_analyzed: reportJson.documentsReviewed?.length || 0,
        });
        return;
      }
      
      // If report is not ready or doesn't exist, set to null
      setUnderwriting(null);
    } catch (err) {
      // Underwriting report may not exist yet
      console.log('No underwriter report available:', err.response?.status);
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
      // Reverse messages to show newest at bottom (WhatsApp style)
      const messagesList = messagesRes.data || [];
      setMessages([...messagesList].reverse());
      
      // Load underwriting if lender
      if (role === 'Lender') {
        loadUnderwriting();
      }
    } catch (err) {
      console.error('ApplicationDetail loadApplication error:', err);
      const errorMsg = err.response?.data?.error || 
                       err.response?.data?.detail || 
                       err.message || 
                       'Failed to load application details';
      setError(`Failed to load application details: ${errorMsg}`);
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
  
  // For lenders viewing pre-accept applications, show Application Review workspace
  const isApplicationReview = isLender && application && application.status !== 'accepted';
  
  // Application Review tabs (for lenders pre-accept)
  const applicationReviewTabs = isApplicationReview ? [
    { id: 'overview', label: 'Overview' },
    { id: 'company', label: 'Company' },
    { id: 'applicants', label: 'Applicants' },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'requests', label: `Requests (${informationRequests.length})` },
    { id: 'underwriter-report', label: "Underwriter's Report" },
    { id: 'playbook', label: 'Playbook' },
  ] : [];
  
  // Standard tabs (for borrowers or accepted applications)
  const standardTabs = !isApplicationReview ? [
    { id: 'overview', label: 'Overview' },
    { id: 'messages', label: `Messages (${messages.length})` },
    { id: 'documents', label: `Documents (${documents.length})` },
    { id: 'requests', label: `Requests (${informationRequests.length})` },
    // Only show Underwriter's Report tab for lenders and admins
    ...(isLender || role === 'Admin' ? [{ id: 'underwriter-report', label: "Underwriter's Report" }] : []),
    { id: 'progress', label: 'Progress' },
  ] : [];
  
  const tabs = isApplicationReview ? applicationReviewTabs : standardTabs;

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
        <div style={{ display: 'grid', gridTemplateColumns: isApplicationReview ? '1fr 350px' : '2fr 1fr', gap: theme.spacing.xl }}>
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

          {/* Sidebar / Action Panel */}
          <div>
            {/* Application Review Action Panel (Lender, pre-accept) */}
            {isApplicationReview && (
              <>
                {/* Validation Checklist */}
                <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Validation Checklist</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    {/* Placeholder validation items - will be populated from playbook in Chunk 12 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Badge variant="success">✓</Badge>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>Application submitted</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Badge variant={borrowerInfo?.company?.company_verified_at ? "success" : "warning"}>
                        {borrowerInfo?.company?.company_verified_at ? "✓" : "⏳"}
                      </Badge>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>Company verification</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Badge variant={documents.length > 0 ? "success" : "warning"}>
                        {documents.length > 0 ? "✓" : "⏳"}
                      </Badge>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>Required documents</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Badge variant={underwriting?.status === 'ready' ? "success" : underwriting?.status === 'generating' ? "warning" : "warning"}>
                        {underwriting?.status === 'ready' ? "✓" : "⏳"}
                      </Badge>
                      <span style={{ fontSize: theme.typography.fontSize.sm }}>Underwriter report</span>
                    </div>
                    <p style={{ margin: `${theme.spacing.md} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                      Playbook validation rules will be shown here (Chunk 12)
                    </p>
                  </div>
                </div>
                
                {/* Status Update (in Application Review mode) */}
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
                
                {/* Actions */}
                <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Actions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                    <Button 
                      variant="outline" 
                      style={{ width: '100%' }}
                      onClick={() => {
                        setShowRequestInfoModal(true);
                      }}
                    >
                      Request Info
                    </Button>
                    {(application.status === 'approved' || application.status === 'under_review' || application.status === 'credit_check') && (
                      <Button 
                        variant="success" 
                        style={{ width: '100%' }}
                        onClick={async () => {
                          if (!window.confirm('Accept this application and create a deal? This action cannot be undone.')) {
                            return;
                          }
                          
                          try {
                            const res = await api.post(`/api/applications/${id}/accept/`);
                            // Check for success flag or deal_deal_id
                            if (res.data.success || res.data.deal_deal_id) {
                              const dealId = res.data.deal_deal_id || res.data.deal_id;
                              if (dealId) {
                                // Redirect to Deal Room using deal_deal_id (the unique deal identifier)
                                navigate(`/lender/deals/${dealId}`);
                                return; // Exit early on success
                              }
                            }
                            // If we get here, deal might have been created but response is unclear
                            // Refresh and check if deal exists
                            await loadApplication();
                            if (application?.deal_deal_id) {
                              navigate(`/lender/deals/${application.deal_deal_id}`);
                            } else {
                              alert('Application accepted, but deal ID not found. Please refresh the page and try opening the Deal Room again.');
                            }
                          } catch (err) {
                            console.error('Failed to accept application:', err);
                            const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
                            alert('Failed to accept application: ' + errorMsg);
                            
                            // Even if there's an error, check if deal was created
                            // Sometimes the deal is created but the response fails
                            try {
                              await loadApplication();
                              if (application?.deal_deal_id) {
                                if (window.confirm('Application appears to be accepted. Would you like to open the Deal Room?')) {
                                  navigate(`/lender/deals/${application.deal_deal_id}`);
                                }
                              }
                            } catch (refreshErr) {
                              console.error('Failed to refresh application:', refreshErr);
                            }
                          }
                        }}
                      >
                        Accept
                      </Button>
                    )}
                    <Button 
                      variant="error" 
                      style={{ width: '100%' }}
                      onClick={async () => {
                        // Show decline reason modal
                        const reasonCategory = window.prompt(
                          'Please select a decline reason category:\n\n' +
                          '1. credit_risk\n' +
                          '2. insufficient_collateral\n' +
                          '3. property_valuation\n' +
                          '4. borrower_profile\n' +
                          '5. documentation\n' +
                          '6. other\n\n' +
                          'Enter the category:'
                        );
                        
                        if (!reasonCategory) return;
                        
                        const validCategories = [
                          'credit_risk',
                          'insufficient_collateral',
                          'property_valuation',
                          'borrower_profile',
                          'documentation',
                          'other',
                        ];
                        
                        if (!validCategories.includes(reasonCategory.toLowerCase())) {
                          alert('Invalid category. Please use one of: ' + validCategories.join(', '));
                          return;
                        }
                        
                        const notes = window.prompt('Additional notes (optional):');
                        
                        try {
                          await api.post(`/api/applications/${id}/decline/`, {
                            reason_category: reasonCategory.toLowerCase(),
                            notes: notes || '',
                          });
                          alert('Application declined successfully');
                          await loadApplication();
                        } catch (err) {
                          console.error('Failed to decline application:', err);
                          alert('Failed to decline application: ' + (err.response?.data?.error || err.message));
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              </>
            )}
            
            {/* Status Update (Lender only, non-Application Review mode) */}
            {isLender && !isApplicationReview && (
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
                    to={`/lender/deals/${application.deal_deal_id}`}
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
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: theme.spacing.md,
              maxHeight: '500px',
              overflowY: 'auto',
              padding: theme.spacing.md,
            }}>
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
          {/* Underwriter Report Summary (if available) */}
          {underwriting && underwriting.status === 'ready' && underwriting.report_json && (
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg, background: theme.colors.primaryLight }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <Badge variant="success">✓</Badge>
                Underwriter's Report Summary
              </h3>
              {underwriting.summary && (
                <div style={{
                  padding: theme.spacing.md,
                  background: theme.colors.white,
                  borderRadius: theme.borderRadius.md,
                  marginBottom: theme.spacing.sm,
                }}>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.fontWeight.medium, marginBottom: theme.spacing.xs }}>
                    Executive Summary:
                  </p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary, whiteSpace: 'pre-wrap' }}>
                    {underwriting.summary}
                  </p>
                </div>
              )}
              {underwriting.recommendation && (
                <div style={{
                  padding: theme.spacing.md,
                  background: theme.colors.white,
                  borderRadius: theme.borderRadius.md,
                  marginBottom: theme.spacing.sm,
                }}>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontWeight: theme.typography.fontWeight.medium, marginBottom: theme.spacing.xs }}>
                    Recommendation:
                  </p>
                  <Badge variant={underwriting.recommendation === 'approve' ? 'success' : underwriting.recommendation === 'decline' ? 'error' : 'warning'}>
                    {underwriting.recommendation === 'approve' ? '✓ Approve' : 
                     underwriting.recommendation === 'decline' ? '✗ Decline' : 
                     '⚠ Conditional'}
                  </Badge>
                </div>
              )}
              <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                Full report available in the "Underwriter's Report" tab
              </p>
            </div>
          )}

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

      {/* Company Tab (Application Review only) */}
      {activeTab === 'company' && isApplicationReview && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Company Information</h2>
          {loadingBorrowerInfo ? (
            <p style={{ color: theme.colors.textSecondary }}>Loading company information...</p>
          ) : borrowerInfo?.company ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
              <div>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Company Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Name</p>
                    <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                      {borrowerInfo.company.company_name || application.borrower_details?.company_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Number</p>
                    <p style={{ margin: 0 }}>{borrowerInfo.company.company_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Company Status</p>
                    <p style={{ margin: 0 }}>{borrowerInfo.company.company_status || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Incorporation Date</p>
                    <p style={{ margin: 0 }}>{borrowerInfo.company.incorporation_date || 'N/A'}</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Trading Address</p>
                    <p style={{ margin: 0 }}>{borrowerInfo.company.trading_address || 'N/A'}</p>
                  </div>
                </div>
              </div>
              <div>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Charges Summary</h3>
                {application.borrower_details?.charges_summary ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Total Charges</p>
                      <p style={{ margin: 0, fontWeight: theme.typography.fontWeight.semibold }}>
                        {application.borrower_details.charges_summary.total_charges || 0}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Active Charges</p>
                      <p style={{ margin: 0, color: theme.colors.warning }}>
                        {application.borrower_details.charges_summary.active_charges || 0}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: theme.colors.textSecondary }}>No charges information available</p>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: theme.colors.textSecondary }}>
              Company information not available. This will be populated from borrower profile and Companies House data.
            </p>
          )}
        </div>
      )}

      {/* Applicants Tab (Application Review only) */}
      {activeTab === 'applicants' && isApplicationReview && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Applicants & Guarantors</h2>
          {loadingBorrowerInfo ? (
            <p style={{ color: theme.colors.textSecondary }}>Loading applicant information...</p>
          ) : borrowerInfo?.applicants_and_guarantors && borrowerInfo.applicants_and_guarantors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {borrowerInfo.applicants_and_guarantors.map((applicant, idx) => (
                <div key={idx} style={{
                  padding: theme.spacing.md,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.gray200}`,
                }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>{applicant.name || 'Applicant'}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm }}>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Role</p>
                      <p style={{ margin: 0 }}>{applicant.role || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Nationality</p>
                      <p style={{ margin: 0 }}>{applicant.nationality || 'N/A'}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Employment Status</p>
                      <p style={{ margin: 0 }}>{applicant.employment_status || 'N/A'}</p>
                    </div>
                    {applicant.net_monthly_income && (
                      <div>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Net Monthly Income</p>
                        <p style={{ margin: 0 }}>£{parseFloat(applicant.net_monthly_income).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: theme.colors.textSecondary }}>
              Applicant information not available. This will be populated from borrower profile.
            </p>
          )}
        </div>
      )}

      {/* Playbook Tab (Application Review only) */}
      {activeTab === 'playbook' && isApplicationReview && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Applied Playbook</h2>
          <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.lg }}>
            This section will display the playbook rules and checklist status applied to this application.
            Playbook functionality will be implemented in Chunk 12.
          </p>
          <div style={{
            padding: theme.spacing.lg,
            background: theme.colors.gray50,
            borderRadius: theme.borderRadius.md,
            border: `1px dashed ${theme.colors.gray300}`,
          }}>
            <p style={{ margin: 0, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
              Playbook: Not yet applied (will be auto-selected or manually selected in Chunk 12)
            </p>
          </div>
        </div>
      )}

      {activeTab === 'underwriter-report' && (isLender || role === 'Admin') && (
        <UnderwriterReport
          applicationId={id}
          role={role}
          isAdmin={role === 'Admin'}
        />
      )}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div>
          {isLender && !isApplicationReview && (
            <div style={{ marginBottom: theme.spacing.lg, textAlign: 'right' }}>
              <Button variant="primary" onClick={() => setShowRequestInfoModal(true)}>
                + Create Information Request
              </Button>
            </div>
          )}
          
          {loadingRequests ? (
            <div style={commonStyles.card}>
              <p style={{ color: theme.colors.textSecondary }}>Loading requests...</p>
            </div>
          ) : informationRequests.length === 0 ? (
            <div style={commonStyles.card}>
              <p style={{ color: theme.colors.textSecondary }}>
                {isLender ? 'No information requests created yet.' : 'No information requests received yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
              {informationRequests.map((req) => (
                <div key={req.id} style={commonStyles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.md }}>
                    <div>
                      <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0` }}>{req.title}</h3>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        Created {new Date(req.created_at).toLocaleDateString()} by {req.created_by_name}
                      </p>
                    </div>
                  </div>
                  
                  {req.notes && (
                    <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                      {req.notes}
                    </p>
                  )}
                  
                  <div style={{ marginTop: theme.spacing.md }}>
                    <h4 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Items ({req.items.length})</h4>
                    {req.items.map((item) => (
                      <div key={item.id} style={{
                        padding: theme.spacing.md,
                        border: `1px solid ${theme.colors.gray200}`,
                        borderRadius: theme.borderRadius.md,
                        marginBottom: theme.spacing.sm,
                        background: theme.colors.gray50,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.xs }}>
                          <div>
                            <strong>{item.title}</strong>
                            {item.description && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                {item.description}
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            item.status === 'accepted' ? 'success' :
                            item.status === 'rejected' ? 'error' :
                            item.status === 'uploaded' ? 'info' : 'warning'
                          }>
                            {item.status}
                          </Badge>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.sm }}>
                          {item.due_date && (
                            <div>
                              <strong>Due:</strong> {new Date(item.due_date).toLocaleDateString()}
                            </div>
                          )}
                          {item.document_type_name && (
                            <div>
                              <strong>Type:</strong> {item.document_type_name}
                            </div>
                          )}
                        </div>
                        
                        {/* Borrower: Upload document */}
                        {isBorrower && item.status !== 'accepted' && (
                          <div style={{ marginTop: theme.spacing.md }}>
                            {item.uploaded_document ? (
                              <div>
                                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                                  Document uploaded. Waiting for review.
                                </p>
                                {item.status === 'rejected' && item.lender_comment && (
                                  <div style={{
                                    marginTop: theme.spacing.sm,
                                    padding: theme.spacing.sm,
                                    background: theme.colors.errorLight,
                                    borderRadius: theme.borderRadius.sm,
                                    fontSize: theme.typography.fontSize.sm,
                                  }}>
                                    <strong>Rejection reason:</strong> {item.lender_comment}
                                    {item.rework_count > 0 && (
                                      <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>
                                        Rework count: {item.rework_count}
                                      </p>
                                    )}
                                  </div>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  style={{ marginTop: theme.spacing.sm }}
                                  onClick={async () => {
                                    const fileInput = document.createElement('input');
                                    fileInput.type = 'file';
                                    fileInput.onchange = async (e) => {
                                      const file = e.target.files[0];
                                      if (!file) return;
                                      
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      
                                      try {
                                        await api.post(
                                          `/api/applications/${id}/information-requests/${req.id}/items/${item.id}/upload/`,
                                          formData,
                                          { headers: { 'Content-Type': 'multipart/form-data' } }
                                        );
                                        await loadInformationRequests();
                                        alert('Document uploaded successfully');
                                      } catch (err) {
                                        alert('Failed to upload document: ' + (err.response?.data?.error || err.message));
                                      }
                                    };
                                    fileInput.click();
                                  }}
                                >
                                  {item.status === 'rejected' ? 'Re-upload Document' : 'Replace Document'}
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={async () => {
                                  const fileInput = document.createElement('input');
                                  fileInput.type = 'file';
                                  fileInput.onchange = async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    
                                    try {
                                      await api.post(
                                        `/api/applications/${id}/information-requests/${req.id}/items/${item.id}/upload/`,
                                        formData,
                                        { headers: { 'Content-Type': 'multipart/form-data' } }
                                      );
                                      await loadInformationRequests();
                                      alert('Document uploaded successfully');
                                    } catch (err) {
                                      alert('Failed to upload document: ' + (err.response?.data?.error || err.message));
                                    }
                                  };
                                  fileInput.click();
                                }}
                              >
                                Upload Document
                              </Button>
                            )}
                          </div>
                        )}
                        
                        {/* Lender: Review item */}
                        {isLender && item.status === 'uploaded' && (
                          <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm }}>
                            <Button
                              variant="success"
                              size="sm"
                              onClick={async () => {
                                const comment = window.prompt('Add a comment (optional):');
                                try {
                                  await api.post(
                                    `/api/applications/${id}/information-requests/${req.id}/items/${item.id}/review/`,
                                    { action: 'accept', comment: comment || '' }
                                  );
                                  await loadInformationRequests();
                                  alert('Item accepted');
                                } catch (err) {
                                  alert('Failed to accept item: ' + (err.response?.data?.error || err.message));
                                }
                              }}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="error"
                              size="sm"
                              onClick={async () => {
                                const comment = window.prompt('Please provide a reason for rejection:');
                                if (!comment) return;
                                try {
                                  await api.post(
                                    `/api/applications/${id}/information-requests/${req.id}/items/${item.id}/review/`,
                                    { action: 'reject', comment }
                                  );
                                  await loadInformationRequests();
                                  alert('Item rejected');
                                } catch (err) {
                                  alert('Failed to reject item: ' + (err.response?.data?.error || err.message));
                                }
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                        
                        {item.lender_comment && item.status === 'accepted' && (
                          <div style={{
                            marginTop: theme.spacing.sm,
                            padding: theme.spacing.sm,
                            background: theme.colors.successLight,
                            borderRadius: theme.borderRadius.sm,
                            fontSize: theme.typography.fontSize.sm,
                          }}>
                            <strong>Lender comment:</strong> {item.lender_comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'progress' && !isApplicationReview && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Application Progress</h2>
          <ApplicationProgress application={application} statusHistory={statusHistory} />
        </div>
      )}
      
      {/* Information Request Builder Modal */}
      {showRequestInfoModal && (
        <InformationRequestBuilder
          applicationId={id}
          onClose={() => setShowRequestInfoModal(false)}
          onSuccess={() => {
            loadInformationRequests();
            setShowRequestInfoModal(false);
          }}
        />
      )}
    </div>
  );
}

export default ApplicationDetail;
