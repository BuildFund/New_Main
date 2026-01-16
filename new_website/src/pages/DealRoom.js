import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import { tokenStorage } from '../utils/tokenStorage';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Select from '../components/Select';
import StepUpAuth from '../components/StepUpAuth';
import Input from '../components/Input';
import ConsultantsTab from '../components/DealConsultants';
import LegalWorkspace from '../components/LegalWorkspace';
import Drawdowns from '../components/Drawdowns';

function DealRoom() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [stages, setStages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [taskFilter, setTaskFilter] = useState('all'); // all, overdue, awaiting_review, critical_path
  const [taskStageFilter, setTaskStageFilter] = useState('all');
  const [documents, setDocuments] = useState([]);
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('all');
  const [stepUpAuth, setStepUpAuth] = useState({ required: false, verified: false, docId: null, action: null });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadForm, setDocUploadForm] = useState({ category: 'compliance', description: '' });
  const [providerStages, setProviderStages] = useState([]);
  const [completionBlockers, setCompletionBlockers] = useState([]);

  // Determine user role (must be before useEffect that uses it)
  const role = tokenStorage.getRole();
  const isConsultant = role === 'Consultant';
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';

  useEffect(() => {
    loadDeal();
    loadTimeline();
    loadDocuments();
    if (isConsultant) {
      loadProviderStages();
    }
    if (isBorrower || isLender) {
      loadCompletionReadiness();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function loadDeal() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/deals/deals/${dealId}/`);

      // Check if response is XML (indicates wrong content-type)
      if (res.data && typeof res.data === 'string' && res.data.trim().startsWith('<?xml')) {
        console.error('Server returned XML instead of JSON:', res.data.substring(0, 200));
        setError('Server returned XML instead of JSON. Please check API configuration.');
        setDeal(null);
        return;
      }

      setDeal(res.data);
    } catch (err) {
      console.error('Failed to load deal:', err);
      console.error('Error response:', err.response);
      console.error('Error data:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to load deal';
      setError(errorMsg);

      // Check if it's a permission error
      if (err.response?.status === 403 || err.response?.status === 404) {
        setError('You do not have permission to view this deal, or the deal does not exist.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadTimeline() {
    try {
      const res = await api.get(`/api/deals/deals/${dealId}/timeline/`);
      setStages(res.data.stages || []);
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
      // Don't fail completely if timeline fails
      setStages([]);
      setTasks([]);
    }
  }

  async function completeTask(taskId) {
    try {
      await api.post(`/api/deals/deal-tasks/${taskId}/complete/`);
      await loadTimeline();
      await loadDeal(); // Refresh deal to update readiness score
    } catch (err) {
      console.error('Failed to complete task:', err);
      alert('Failed to complete task: ' + (err.response?.data?.error || err.message));
    }
  }

  async function sendChaseReminder(taskId) {
    try {
      // TODO: Implement chase reminder endpoint in backend
      // For now, just show a message
      alert('Chase reminder sent (backend endpoint to be implemented)');
    } catch (err) {
      console.error('Failed to send chase reminder:', err);
      alert('Failed to send chase reminder: ' + (err.response?.data?.error || err.message));
    }
  }

  async function loadProviderStages() {
    try {
      const res = await api.get(`/api/deals/provider-stages/?deal_id=${dealId}`);
      setProviderStages(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load provider stages:', err);
      setProviderStages([]);
    }
  }

  async function loadCompletionReadiness() {
    try {
      const res = await api.get(`/api/deals/deals/${dealId}/completion-readiness/`);
      if (res.data && res.data.blockers) {
        setCompletionBlockers(res.data.blockers || []);
      }
    } catch (err) {
      console.error('Failed to load completion readiness:', err);
      setCompletionBlockers([]);
    }
  }

  async function loadDocuments() {
    try {
      const res = await api.get(`/api/deals/deal-documents/?deal_id=${dealId}`);
      setDocuments(res.data || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
      setDocuments([]);
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
    formData.append('category', docUploadForm.category);
    
    try {
      // First create the document
      const docRes = await api.post('/api/documents/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      if (docRes.data.documents && docRes.data.documents.length > 0) {
        // Then link it to the deal
        for (const doc of docRes.data.documents) {
          await api.post('/api/deals/deal-documents/', {
            deal: dealId,
            document: doc.id,
            document_category: docUploadForm.category,
            visibility: 'shared',
          });
        }
      }
      
      await loadDocuments();
      setDocUploadForm({ category: 'compliance', description: '' });
    } catch (err) {
      console.error('Document upload error:', err);
      alert('Failed to upload document: ' + (err.response?.data?.error || err.message));
    } finally {
      setUploadingDoc(false);
    }
  }

  async function handleViewDocument(docLinkId) {
    try {
      const sessionKey = tokenStorage.getStepUpSessionKey();
      const expiresAt = localStorage.getItem('stepUpExpiresAt'); // Keep this in localStorage for expiry check
      
      // Check if step-up session is still valid
      if (expiresAt && new Date(expiresAt) > new Date()) {
        const res = await api.get(`/api/deals/deal-documents/${docLinkId}/view/`, {
          headers: { 'X-Step-Up-Session-Key': sessionKey },
        });
        
        if (res.data.view_url) {
          window.open(res.data.view_url, '_blank');
        }
        return;
      }
      
      // Try without step-up first
      const res = await api.get(`/api/deals/deal-documents/${docLinkId}/view/`);
      
      if (res.data.view_url) {
        window.open(res.data.view_url, '_blank');
      }
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.requires_step_up) {
        setStepUpAuth({ required: true, verified: false, docId: docLinkId, action: 'view' });
      } else {
        alert('Failed to view document: ' + (err.response?.data?.error || err.message));
      }
    }
  }

  async function handleDownloadDocument(docLinkId) {
    try {
      const sessionKey = tokenStorage.getStepUpSessionKey();
      const expiresAt = localStorage.getItem('stepUpExpiresAt'); // Keep this in localStorage for expiry check
      
      // Check if step-up session is still valid
      if (expiresAt && new Date(expiresAt) > new Date()) {
        const res = await api.get(`/api/deals/deal-documents/${docLinkId}/download/`, {
          headers: { 'X-Step-Up-Session-Key': sessionKey },
        });
        
        if (res.data.download_url) {
          window.open(res.data.download_url, '_blank');
        }
        return;
      }
      
      // Try without step-up first
      const res = await api.get(`/api/deals/deal-documents/${docLinkId}/download/`);
      
      if (res.data.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      if (err.response?.status === 401 && err.response?.data?.requires_step_up) {
        setStepUpAuth({ required: true, verified: false, docId: docLinkId, action: 'download' });
      } else {
        alert('Failed to download document: ' + (err.response?.data?.error || err.message));
      }
    }
  }

  async function handleStepUpAuthenticated() {
    const { docId, action } = stepUpAuth;
    
    if (action === 'view') {
      await handleViewDocument(docId);
    } else if (action === 'download') {
      await handleDownloadDocument(docId);
    }
    
    setStepUpAuth({ required: false, verified: true, docId: null, action: null });
  }

  const documentCategories = [
    { value: 'compliance', label: 'Compliance (KYC/AML)' },
    { value: 'legal', label: 'Legal' },
    { value: 'reports', label: 'Reports' },
    { value: 'financial', label: 'Financial' },
    { value: 'drawdowns', label: 'Drawdowns' },
  ];

  const filteredDocuments = documents.filter(doc => {
    if (documentCategoryFilter !== 'all') {
      return doc.document_category === documentCategoryFilter;
    }
    return true;
  });

  const getCategoryColor = (category) => {
    const colors = {
      compliance: theme.colors.warning,
      legal: theme.colors.primary,
      reports: theme.colors.info,
      financial: theme.colors.success,
      drawdowns: theme.colors.accent,
    };
    return colors[category] || theme.colors.gray300;
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { variant: 'success', label: 'Active' },
      completed: { variant: 'info', label: 'Completed' },
      cancelled: { variant: 'error', label: 'Cancelled' },
      on_hold: { variant: 'warning', label: 'On Hold' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading deal...</p>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
        }}>
          <p>{error || 'Deal not found'}</p>
          <Button onClick={() => navigate('/deals')} variant="primary">
            Back to Deals
          </Button>
        </div>
      </div>
    );
  }

  // Filter tabs based on role (role variables defined above)
  const allTabs = [
    { id: 'overview', label: 'Overview', roles: ['Lender', 'Borrower', 'Consultant', 'Admin'] },
    { id: 'timeline', label: 'Timeline', roles: ['Lender', 'Borrower', 'Consultant', 'Admin'] },
    { id: 'tasks', label: `Tasks (${tasks.length})`, roles: ['Lender', 'Borrower', 'Consultant', 'Admin'] },
    { id: 'my-progress', label: 'My Progress', roles: ['Consultant'] },
    { id: 'documents', label: 'Documents', roles: ['Lender', 'Borrower', 'Consultant', 'Admin'] },
    { id: 'underwriter-report', label: "Underwriter's Report", roles: ['Lender', 'Admin'] },
    { id: 'consultants', label: 'Consultants', roles: ['Lender', 'Borrower', 'Consultant', 'Admin'] },
    { id: 'legal-workspace', label: 'Legal Workspace', roles: ['Lender', 'Borrower', 'Admin'] },
    { id: 'drawdowns', label: 'Drawdowns', roles: ['Lender', 'Borrower', 'Admin'] },
    { id: 'audit-log', label: 'Audit Log', roles: ['Lender', 'Admin'] },
    { id: 'reporting', label: 'Reporting', roles: ['Lender', 'Admin'] },
  ];

  const tabs = allTabs.filter(tab => tab.roles.includes(role || ''));

  // Filter tasks based on selected filters
  const filteredTasks = tasks.filter(task => {
    if (taskFilter === 'overdue') {
      if (!task.due_date) return false;
      return new Date(task.due_date) < new Date() && task.status !== 'completed';
    }
    if (taskFilter === 'awaiting_review') {
      return task.status === 'in_progress' || task.status === 'pending';
    }
    if (taskFilter === 'critical_path') {
      return task.priority === 'critical' || task.dependencies?.length > 0;
    }
    if (taskStageFilter !== 'all') {
      return task.stage?.toString() === taskStageFilter;
    }
    return true;
  });

  // Calculate SLA status for stages
  const getStageSLAStatus = (stage) => {
    if (!stage.sla_target_days || !stage.entered_at) return null;
    const enteredDate = new Date(stage.entered_at);
    const daysElapsed = Math.floor((new Date() - enteredDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = stage.sla_target_days - daysElapsed;
    if (daysRemaining < 0) return { status: 'overdue', days: Math.abs(daysRemaining) };
    if (daysRemaining <= 3) return { status: 'warning', days: daysRemaining };
    return { status: 'ok', days: daysRemaining };
  };

  // Calculate SLA status for tasks
  const getTaskSLAStatus = (task) => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    if (task.status === 'completed') return { status: 'completed' };
    if (dueDate < now) return { status: 'overdue', hours: Math.floor((now - dueDate) / (1000 * 60 * 60)) };
    const hoursRemaining = Math.floor((dueDate - now) / (1000 * 60 * 60));
    if (hoursRemaining <= 24) return { status: 'warning', hours: hoursRemaining };
    return { status: 'ok', hours: hoursRemaining };
  };

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.lg, display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Button onClick={() => navigate('/deals')} variant="outline">
          ← Back to Deals
        </Button>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          {deal.deal_id || `Deal #${deal.id}`}
        </h1>
        {getStatusBadge(deal.status)}
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
            {/* Deal Information */}
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                Deal Information
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Deal ID:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.deal_id || `#${deal.id}`}</p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Status:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{getStatusBadge(deal.status)}</p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Facility Type:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.facility_type || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Jurisdiction:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.jurisdiction || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Accepted At:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{formatDate(deal.accepted_at)}</p>
                </div>
                {deal.target_completion_date && (
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Target Completion:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{formatDate(deal.target_completion_date)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Commercial Terms */}
            {deal.commercial_terms && (
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                  Commercial Terms
                </h2>
                {typeof deal.commercial_terms === 'object' && deal.commercial_terms !== null ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                    {deal.commercial_terms.loan_amount && (
                      <div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Loan Amount:</strong>
                        </p>
                        <p style={{ margin: 0 }}>£{parseFloat(deal.commercial_terms.loan_amount).toLocaleString()}</p>
                      </div>
                    )}
                    {deal.commercial_terms.interest_rate && (
                      <div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Interest Rate:</strong>
                        </p>
                        <p style={{ margin: 0 }}>{deal.commercial_terms.interest_rate}%</p>
                      </div>
                    )}
                    {deal.commercial_terms.term_months && (
                      <div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Term:</strong>
                        </p>
                        <p style={{ margin: 0 }}>{deal.commercial_terms.term_months} months</p>
                      </div>
                    )}
                    {deal.commercial_terms.ltv_ratio && (
                      <div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>LTV Ratio:</strong>
                        </p>
                        <p style={{ margin: 0 }}>{deal.commercial_terms.ltv_ratio}%</p>
                      </div>
                    )}
                    {deal.commercial_terms.product_name && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Product:</strong>
                        </p>
                        <p style={{ margin: 0 }}>{deal.commercial_terms.product_name}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <pre style={{
                    margin: 0,
                    padding: theme.spacing.md,
                    background: theme.colors.gray50,
                    borderRadius: theme.borderRadius.md,
                    overflow: 'auto',
                    fontSize: theme.typography.fontSize.sm,
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                  }}>
                    {typeof deal.commercial_terms === 'string' 
                      ? deal.commercial_terms 
                      : JSON.stringify(deal.commercial_terms, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Completion Readiness */}
            {deal.completion_readiness_score !== null && deal.completion_readiness_score !== undefined && (
              <div style={{ ...commonStyles.card }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                  Completion Readiness
                </h2>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                    <span style={{ fontWeight: theme.typography.fontWeight.semibold }}>
                      {deal.completion_readiness_score}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '24px',
                    background: theme.colors.gray200,
                    borderRadius: theme.borderRadius.full,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${deal.completion_readiness_score}%`,
                      height: '100%',
                      background: deal.completion_readiness_score >= 80 ? theme.colors.success : 
                                 deal.completion_readiness_score >= 50 ? theme.colors.warning : theme.colors.error,
                      transition: 'width 0.3s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.semibold,
                    }}>
                      {deal.completion_readiness_score}%
                    </div>
                  </div>
                </div>
                {deal.completion_readiness_breakdown && (
                  <div style={{
                    marginTop: theme.spacing.md,
                    padding: theme.spacing.md,
                    background: theme.colors.gray50,
                    borderRadius: theme.borderRadius.md,
                  }}>
                    {typeof deal.completion_readiness_breakdown === 'object' && deal.completion_readiness_breakdown !== null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                        {Array.isArray(deal.completion_readiness_breakdown) ? (
                          deal.completion_readiness_breakdown.map((item, idx) => (
                            <div key={idx} style={{
                              padding: theme.spacing.sm,
                              background: theme.colors.white,
                              borderRadius: theme.borderRadius.sm,
                              border: `1px solid ${theme.colors.gray300}`,
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: theme.typography.fontWeight.medium }}>
                                  {item.category || item.name || `Item ${idx + 1}`}
                                </span>
                                {item.current !== undefined && item.required !== undefined ? (
                                  <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                    {item.current} / {item.required}
                                  </span>
                                ) : item.status ? (
                                  <Badge variant={item.status === 'complete' || item.status === 'satisfied' ? 'success' : 'warning'}>
                                    {item.status}
                                  </Badge>
                                ) : null}
                              </div>
                              {item.note && (
                                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                  {item.note}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          Object.entries(deal.completion_readiness_breakdown).map(([key, value]) => (
                            <div key={key} style={{
                              padding: theme.spacing.sm,
                              background: theme.colors.white,
                              borderRadius: theme.borderRadius.sm,
                            }}>
                              <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <pre style={{
                        margin: 0,
                        fontSize: theme.typography.fontSize.sm,
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                      }}>
                        {typeof deal.completion_readiness_breakdown === 'string'
                          ? deal.completion_readiness_breakdown
                          : JSON.stringify(deal.completion_readiness_breakdown, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
                
                {/* Action Items for Borrowers */}
                {isBorrower && deal.completion_readiness_score !== null && deal.completion_readiness_score < 100 && (
                  <div style={{ ...commonStyles.card, marginTop: theme.spacing.lg }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, fontSize: theme.typography.fontSize.xl }}>
                      What You Need to Do
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                      {/* Check incomplete borrower tasks */}
                      {tasks.filter(t => t.owner_party_type === 'borrower' && t.status !== 'completed').length > 0 && (
                        <div style={{
                          padding: theme.spacing.md,
                          background: theme.colors.warningLight,
                          borderRadius: theme.borderRadius.sm,
                          border: `1px solid ${theme.colors.warning}`,
                        }}>
                          <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                            📋 Complete Your Tasks
                          </p>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                            You have {tasks.filter(t => t.owner_party_type === 'borrower' && t.status !== 'completed').length} incomplete task(s). 
                            Go to the <strong>Tasks</strong> tab to complete them.
                          </p>
                        </div>
                      )}
                      
                      {/* Show completion blockers if available */}
                      {completionBlockers.length > 0 && (
                        <div style={{
                          padding: theme.spacing.md,
                          background: theme.colors.errorLight,
                          borderRadius: theme.borderRadius.sm,
                          border: `1px solid ${theme.colors.error}`,
                        }}>
                          <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                            ⚠️ Blocking Completion
                          </p>
                          <ul style={{ margin: `${theme.spacing.xs} 0 0 0`, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                            {completionBlockers.map((blocker, idx) => (
                              <li key={idx}>{blocker}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Check open requisitions */}
                      <div style={{
                        padding: theme.spacing.md,
                        background: theme.colors.infoLight,
                        borderRadius: theme.borderRadius.sm,
                        border: `1px solid ${theme.colors.info}`,
                      }}>
                        <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                          📝 Legal Requirements
                        </p>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                          Check the <strong>Legal Workspace</strong> tab to:
                        </p>
                        <ul style={{ margin: `${theme.spacing.xs} 0 0 0`, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                          <li>Approve or satisfy Conditions Precedent (CPs)</li>
                          <li>Respond to any open requisitions from the lender's solicitor</li>
                        </ul>
                      </div>
                      
                      {/* Check documents */}
                      <div style={{
                        padding: theme.spacing.md,
                        background: theme.colors.infoLight,
                        borderRadius: theme.borderRadius.sm,
                        border: `1px solid ${theme.colors.info}`,
                      }}>
                        <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                          📎 Upload Required Documents
                        </p>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                          Go to the <strong>Documents</strong> tab to upload any required documents for CPs, tasks, or drawdowns.
                        </p>
                      </div>
                      
                      {/* Check drawdowns if applicable */}
                      {deal.facility_type === 'development' && (
                        <div style={{
                          padding: theme.spacing.md,
                          background: theme.colors.infoLight,
                          borderRadius: theme.borderRadius.sm,
                          border: `1px solid ${theme.colors.info}`,
                        }}>
                          <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                            💰 Request Drawdowns
                          </p>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                            Go to the <strong>Drawdowns</strong> tab to request funding as milestones are reached.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Parties */}
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                Parties
              </h2>
              <div style={{ marginBottom: theme.spacing.md }}>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Lender:</strong>
                </p>
                <p style={{ margin: 0 }}>{deal.lender_name || 'Unknown'}</p>
              </div>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Borrower:</strong>
                </p>
                <p style={{ margin: 0 }}>{deal.borrower_name || 'Unknown'}</p>
              </div>
            </div>

            {/* Current Stage */}
            {deal.current_stage_name && (
              <div style={{ ...commonStyles.card }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0`, fontSize: theme.typography.fontSize['2xl'] }}>
                  Current Stage
                </h2>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  {deal.current_stage_name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Deal Stages</h2>
            {stages.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary }}>No stages found for this deal.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {stages.map((stage) => {
                  const slaStatus = getStageSLAStatus(stage);
                  return (
                    <div
                      key={stage.id}
                      style={{
                        padding: theme.spacing.lg,
                        border: `2px solid ${
                          stage.status === 'completed' ? theme.colors.success :
                          stage.status === 'in_progress' ? theme.colors.primary :
                          theme.colors.gray300
                        }`,
                        borderRadius: theme.borderRadius.md,
                        background: stage.status === 'in_progress' ? theme.colors.primaryLight : theme.colors.white,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                        <div>
                          <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg }}>
                            Stage {stage.stage_number}: {stage.name}
                          </h3>
                          {stage.description && (
                            <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                              {stage.description}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                          <Badge
                            variant={
                              stage.status === 'completed' ? 'success' :
                              stage.status === 'in_progress' ? 'primary' :
                              stage.status === 'blocked' ? 'error' : 'info'
                            }
                          >
                            {stage.status_display || stage.status}
                          </Badge>
                          {slaStatus && (
                            <Badge
                              variant={
                                slaStatus.status === 'overdue' ? 'error' :
                                slaStatus.status === 'warning' ? 'warning' : 'success'
                              }
                            >
                              {slaStatus.status === 'overdue' ? `${slaStatus.days}d overdue` :
                               slaStatus.status === 'warning' ? `${slaStatus.days}d remaining` :
                               `${slaStatus.days}d remaining`}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                        {stage.entered_at && (
                          <div>
                            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Started: {formatDate(stage.entered_at)}
                            </p>
                          </div>
                        )}
                        {stage.sla_target_days && (
                          <div>
                            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              SLA Target: {stage.sla_target_days} days
                            </p>
                          </div>
                        )}
                      </div>
                      {stage.entry_criteria && stage.entry_criteria.length > 0 && (
                        <div style={{ marginTop: theme.spacing.md }}>
                          <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                            Entry Criteria:
                          </p>
                          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                            {stage.entry_criteria.map((criteria, idx) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {stage.exit_criteria && stage.exit_criteria.length > 0 && (
                        <div style={{ marginTop: theme.spacing.md }}>
                          <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                            Exit Criteria:
                          </p>
                          <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                            {stage.exit_criteria.map((criteria, idx) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
        <div>
          {/* Task Filters */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Filter by Status
                </label>
                <Select
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All Tasks</option>
                  <option value="overdue">Overdue</option>
                  <option value="awaiting_review">Awaiting Review</option>
                  <option value="critical_path">Critical Path</option>
                </Select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                  Filter by Stage
                </label>
                <Select
                  value={taskStageFilter}
                  onChange={(e) => setTaskStageFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="all">All Stages</option>
                  {stages.map(stage => (
                    <option key={stage.id} value={stage.id.toString()}>
                      Stage {stage.stage_number}: {stage.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
              Tasks ({filteredTasks.length})
            </h2>
            {filteredTasks.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary }}>No tasks found matching the selected filters.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {filteredTasks.map((task) => {
                  const slaStatus = getTaskSLAStatus(task);
                  const stage = stages.find(s => s.id === task.stage);
                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: theme.spacing.lg,
                        border: `1px solid ${
                          task.status === 'completed' ? theme.colors.success :
                          task.status === 'blocked' ? theme.colors.error :
                          task.priority === 'critical' ? theme.colors.warning :
                          theme.colors.gray300
                        }`,
                        borderRadius: theme.borderRadius.md,
                        background: task.status === 'blocked' ? theme.colors.errorLight : theme.colors.white,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                            <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                              {task.title}
                            </h3>
                            <Badge
                              variant={
                                task.priority === 'critical' ? 'error' :
                                task.priority === 'high' ? 'warning' :
                                task.priority === 'medium' ? 'info' : 'secondary'
                              }
                            >
                              {task.priority_display || task.priority}
                            </Badge>
                            <Badge
                              variant={
                                task.status === 'completed' ? 'success' :
                                task.status === 'in_progress' ? 'primary' :
                                task.status === 'blocked' ? 'error' : 'info'
                              }
                            >
                              {task.status_display || task.status}
                            </Badge>
                            {slaStatus && slaStatus.status === 'overdue' && (
                              <Badge variant="error">
                                {slaStatus.hours}h overdue
                              </Badge>
                            )}
                            {slaStatus && slaStatus.status === 'warning' && (
                              <Badge variant="warning">
                                {slaStatus.hours}h remaining
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                              {task.description}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
                            {stage && (
                              <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Stage: {stage.stage_number} - {stage.name}
                              </span>
                            )}
                            {task.assignee_name && (
                              <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Assigned to: {task.assignee_name}
                              </span>
                            )}
                            {task.owner_party_type && (
                              <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Owner: {task.owner_party_type}
                              </span>
                            )}
                            {task.due_date && (
                              <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Due: {formatDate(task.due_date)}
                              </span>
                            )}
                          </div>
                          {task.dependencies && task.dependencies.length > 0 && (
                            <div style={{ marginTop: theme.spacing.sm, padding: theme.spacing.sm, background: theme.colors.warningLight, borderRadius: theme.borderRadius.sm }}>
                              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                                Blocked by {task.dependencies.length} task(s)
                              </p>
                            </div>
                          )}
                          {task.blockers && task.blockers.length > 0 && (
                            <div style={{ marginTop: theme.spacing.sm, padding: theme.spacing.sm, background: theme.colors.errorLight, borderRadius: theme.borderRadius.sm }}>
                              <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                                Blockers:
                              </p>
                              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                                {task.blockers.map((blocker, idx) => (
                                  <li key={idx}>{blocker}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, alignItems: 'flex-end' }}>
                          {task.status !== 'completed' && (
                            <>
                              {/* Show Complete button if:
                                  - User is lender/admin (can complete any task)
                                  - User is borrower and task is owned by borrower
                                  - User is consultant and task is assigned to them
                                  Note: Backend will validate permissions */}
                              {(
                                isLender || 
                                (isBorrower && task.owner_party_type === 'borrower') ||
                                (isConsultant && task.owner_party_type && ['valuer', 'monitoring_surveyor', 'solicitor'].includes(task.owner_party_type))
                              ) && (
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => {
                                    if (window.confirm('Mark this task as completed?')) {
                                      completeTask(task.id);
                                    }
                                  }}
                                >
                                  Complete
                                </Button>
                              )}
                              {/* Show Chase button for lenders/admins or if borrower is owner and task is assigned to someone else */}
                              {task.assignee_name && (
                                (isLender || (isBorrower && task.owner_party_type === 'borrower')) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => sendChaseReminder(task.id)}
                                  >
                                    Chase
                                  </Button>
                                )
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          {/* Step-up Authentication Modal */}
          {stepUpAuth.required && !stepUpAuth.verified && (
            <StepUpAuth
              onAuthenticated={handleStepUpAuthenticated}
              onCancel={() => setStepUpAuth({ required: false, verified: false, docId: null, action: null })}
              purpose="view or download this document"
            />
          )}

          {/* Document Filters and Upload */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Deal Documents</h2>
              <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center' }}>
                <Select
                  value={documentCategoryFilter}
                  onChange={(e) => setDocumentCategoryFilter(e.target.value)}
                  style={{ minWidth: '200px' }}
                >
                  <option value="all">All Categories</option>
                  {documentCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Upload Section */}
            <div style={{ marginBottom: theme.spacing.lg, padding: theme.spacing.lg, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Upload Document</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    Category
                  </label>
                  <Select
                    value={docUploadForm.category}
                    onChange={(e) => setDocUploadForm({ ...docUploadForm, category: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {documentCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    Description (Optional)
                  </label>
                  <Input
                    value={docUploadForm.description}
                    onChange={(e) => setDocUploadForm({ ...docUploadForm, description: e.target.value })}
                    placeholder="e.g., Q1 2024 Bank Statement"
                  />
                </div>
              </div>
              <div
                onClick={() => document.getElementById('deal-doc-upload').click()}
                style={{
                  padding: theme.spacing.xl,
                  border: `2px dashed ${theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: theme.colors.white,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                  e.currentTarget.style.background = theme.colors.primaryLight;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.gray300;
                  e.currentTarget.style.background = theme.colors.white;
                }}
              >
                <input
                  id="deal-doc-upload"
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleDocumentUpload(e.target.files)}
                />
                <div style={{ fontSize: '48px', marginBottom: theme.spacing.sm }}>📎</div>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  Click to upload documents
                </p>
                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, color: theme.colors.textSecondary }}>
                  PDF, Images, Word, Excel
                </p>
              </div>
              {uploadingDoc && (
                <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.infoLight, borderRadius: theme.borderRadius.md }}>
                  <p style={{ margin: 0, color: theme.colors.info }}>
                    ⏳ Uploading documents...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Documents List */}
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
              Documents ({filteredDocuments.length})
            </h3>
            {filteredDocuments.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No documents found. Upload documents to get started.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: theme.spacing.md }}>
                {filteredDocuments.map((docLink) => {
                  const doc = docLink.document;
                  const isSensitive = ['compliance', 'financial'].includes(docLink.document_category);
                  return (
                    <div
                      key={docLink.id}
                      style={{
                        padding: theme.spacing.lg,
                        border: `1px solid ${getCategoryColor(docLink.document_category)}`,
                        borderRadius: theme.borderRadius.md,
                        background: theme.colors.white,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                            <h4 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                              {doc.file_name}
                            </h4>
                            <Badge
                              variant="info"
                              style={{
                                background: getCategoryColor(docLink.document_category),
                                color: 'white',
                              }}
                            >
                              {docLink.document_category_display || docLink.document_category}
                            </Badge>
                            {isSensitive && (
                              <Badge variant="warning">🔒 Sensitive</Badge>
                            )}
                            <Badge variant={docLink.visibility === 'shared' ? 'success' : 'info'}>
                              {docLink.visibility_display || docLink.visibility}
                            </Badge>
                          </div>
                          {docLink.uploaded_by_name && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Uploaded by {docLink.uploaded_by_name} • {formatDate(docLink.uploaded_at)}
                            </p>
                          )}
                          {doc.file_size && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              {(doc.file_size / 1024).toFixed(2)} KB
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDocument(docLink.id)}
                          >
                            👁️ View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadDocument(docLink.id)}
                          >
                            ⬇️ Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'underwriter-report' && (
        <div style={commonStyles.card}>
          <p style={{ color: theme.colors.textSecondary }}>Underwriter's Report functionality coming soon...</p>
        </div>
      )}

      {activeTab === 'my-progress' && isConsultant && (
        <div>
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>My Progress</h2>
            {providerStages.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                You haven't been selected as a provider for this deal yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
                {providerStages.map(stage => {
                  const roleDisplay = stage.role_type_display || stage.role_type;
                  const stageDisplay = stage.current_stage_display || stage.current_stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                  const tasks = stage.tasks || [];
                  const completedTasks = tasks.filter(t => t.status === 'completed').length;
                  const totalTasks = tasks.length;
                  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                  
                  return (
                    <div key={stage.id} style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.md }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                            <h3 style={{ margin: 0 }}>{roleDisplay}</h3>
                            <Badge color={theme.colors.primary}>{stageDisplay}</Badge>
                            {stage.completed_at && (
                              <Badge color={theme.colors.success}>Completed</Badge>
                            )}
                          </div>
                          {stage.stage_entered_at && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Stage entered: {new Date(stage.stage_entered_at).toLocaleDateString()}
                            </p>
                          )}
                          {totalTasks > 0 && (
                            <div style={{ marginTop: theme.spacing.sm }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
                                <span style={{ fontSize: theme.typography.fontSize.sm }}>Progress</span>
                                <span style={{ fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                                  {completedTasks} / {totalTasks} tasks
                                </span>
                              </div>
                              <div style={{
                                width: '100%',
                                height: 8,
                                background: theme.colors.gray200,
                                borderRadius: theme.borderRadius.sm,
                                overflow: 'hidden',
                              }}>
                                <div style={{
                                  width: `${progressPercent}%`,
                                  height: '100%',
                                  background: progressPercent === 100 ? theme.colors.success : theme.colors.primary,
                                  transition: 'width 0.3s ease',
                                }} />
                              </div>
                            </div>
                          )}
                        </div>
                        {stage.next_stage && !stage.completed_at && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.post(`/api/deals/provider-stages/${stage.id}/advance_stage/`);
                                await loadProviderStages();
                                await loadTimeline();
                              } catch (err) {
                                console.error('Failed to advance stage:', err);
                                alert('Failed to advance stage: ' + (err.response?.data?.error || err.message));
                              }
                            }}
                          >
                            Advance to Next Stage
                          </Button>
                        )}
                      </div>
                      
                      {/* Tasks */}
                      {tasks.length > 0 && (
                        <div style={{ marginTop: theme.spacing.lg }}>
                          <h4 style={{ margin: `0 0 ${theme.spacing.md} 0`, fontSize: theme.typography.fontSize.lg }}>
                            My Tasks
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                            {tasks.map(task => {
                              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
                              const priorityColors = {
                                critical: theme.colors.error,
                                high: theme.colors.warning,
                                medium: theme.colors.info,
                                low: theme.colors.gray500,
                              };
                              
                              return (
                                <div
                                  key={task.id}
                                  style={{
                                    padding: theme.spacing.md,
                                    border: `1px solid ${task.status === 'completed' ? theme.colors.success : theme.colors.gray300}`,
                                    borderRadius: theme.borderRadius.sm,
                                    background: task.status === 'completed' ? theme.colors.successLight : theme.colors.white,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                                        <h5 style={{ margin: 0, fontSize: theme.typography.fontSize.md }}>
                                          {task.title}
                                        </h5>
                                        <Badge color={priorityColors[task.priority] || theme.colors.gray500} style={{ fontSize: theme.typography.fontSize.xs }}>
                                          {task.priority}
                                        </Badge>
                                        {task.status === 'completed' && (
                                          <Badge color={theme.colors.success}>Completed</Badge>
                                        )}
                                        {isOverdue && task.status !== 'completed' && (
                                          <Badge color={theme.colors.error}>Overdue</Badge>
                                        )}
                                      </div>
                                      {task.description && (
                                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                          {task.description}
                                        </p>
                                      )}
                                      {task.due_date && (
                                        <span style={{ fontSize: theme.typography.fontSize.sm, color: isOverdue ? theme.colors.error : theme.colors.textSecondary }}>
                                          Due: {new Date(task.due_date).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                    {task.status !== 'completed' && (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            await api.post(`/api/deals/deal-tasks/${task.id}/complete/`);
                                            await loadProviderStages();
                                            await loadTimeline();
                                          } catch (err) {
                                            console.error('Failed to complete task:', err);
                                            alert('Failed to complete task: ' + (err.response?.data?.error || err.message));
                                          }
                                        }}
                                      >
                                        Mark Complete
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'consultants' && (
        <div>
          <ConsultantsTab dealId={dealId} deal={deal} onUpdate={loadDeal} />
        </div>
      )}

      {activeTab === 'legal-workspace' && (
        <div>
          <LegalWorkspace dealId={dealId} deal={deal} onUpdate={loadDeal} />
        </div>
      )}

      {activeTab === 'drawdowns' && (
        <div>
          <Drawdowns dealId={dealId} deal={deal} onUpdate={loadDeal} />
        </div>
      )}

      {activeTab === 'audit-log' && (
        <div style={commonStyles.card}>
          <p style={{ color: theme.colors.textSecondary }}>Audit Log functionality coming soon...</p>
        </div>
      )}

      {activeTab === 'reporting' && (
        <div style={commonStyles.card}>
          <p style={{ color: theme.colors.textSecondary }}>Reporting functionality coming soon (Chunk 11)...</p>
        </div>
      )}
    </div>
  );
}

export default DealRoom;
