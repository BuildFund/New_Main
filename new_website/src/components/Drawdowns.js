import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Badge from './Badge';
import Select from './Select';
import Textarea from './Textarea';
import Input from './Input';

function Drawdowns({ dealId, deal, onUpdate }) {
  const [drawdowns, setDrawdowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestModal, setRequestModal] = useState({ 
    open: false, 
    form: { 
      requested_amount: '', 
      purpose: '', 
      milestone: '',
      ims_inspection_required: true,
      documents: [] // Files to upload
    } 
  });
  const [approveModal, setApproveModal] = useState({ open: false, drawdownId: null });
  const [uploadDocsModal, setUploadDocsModal] = useState({ 
    open: false, 
    drawdownId: null, 
    files: [],
    category: 'drawdown_other',
    description: ''
  });
  const [msActionsModal, setMsActionsModal] = useState({ 
    open: false, 
    drawdownId: null, 
    action: null, // 'start_review', 'schedule_visit', 'complete_visit', 'approve', 'reject'
    visitDate: '',
    notes: ''
  });
  const role = localStorage.getItem('role');
  const isBorrower = role === 'Borrower';
  const isLender = role === 'Lender';
  const isConsultant = role === 'Consultant';

  useEffect(() => {
    loadDrawdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function loadDrawdowns() {
    try {
      const res = await api.get(`/api/deals/drawdowns/?deal_id=${dealId}`);
      setDrawdowns(res.data || []);
    } catch (err) {
      console.error('Failed to load drawdowns:', err);
      setDrawdowns([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestDrawdown() {
    if (!requestModal.form.requested_amount || !requestModal.form.purpose.trim()) {
      alert('Please provide amount and purpose');
      return;
    }

    try {
      // Look up deal by deal_id first
      const dealRes = await api.get(`/api/deals/deals/${dealId}/`);
      
      // Calculate next sequence number
      const nextSequence = drawdowns.length > 0 
        ? Math.max(...drawdowns.map(d => d.sequence_number || 0)) + 1 
        : 1;

      // Create drawdown first
      const drawdownRes = await api.post('/api/deals/drawdowns/', {
        deal: dealRes.data.id,
        sequence_number: nextSequence,
        requested_amount: parseFloat(requestModal.form.requested_amount),
        purpose: requestModal.form.purpose,
        milestone: requestModal.form.milestone || '',
        ims_inspection_required: requestModal.form.ims_inspection_required,
      });

      // Upload documents if any - need to upload by category
      // For now, upload all as 'drawdown_other' - borrower can add more later
      if (requestModal.form.documents && requestModal.form.documents.length > 0) {
        const formData = new FormData();
        Array.from(requestModal.form.documents).forEach(file => {
          formData.append('files', file);
        });
        formData.append('document_category', 'drawdown_other');
        
        await api.post(`/api/deals/drawdowns/${drawdownRes.data.id}/upload_documents/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await loadDrawdowns();
      setRequestModal({ 
        open: false, 
        form: { 
          requested_amount: '', 
          purpose: '', 
          milestone: '',
          ims_inspection_required: true,
          documents: []
        } 
      });
      if (onUpdate) onUpdate();
      alert('Drawdown requested successfully');
    } catch (err) {
      alert('Failed to request drawdown: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleUploadDocuments() {
    if (!uploadDocsModal.files || uploadDocsModal.files.length === 0) {
      alert('Please select files to upload');
      return;
    }

    if (!uploadDocsModal.category) {
      alert('Please select a document category');
      return;
    }

    try {
      const formData = new FormData();
      Array.from(uploadDocsModal.files).forEach(file => {
        formData.append('files', file);
      });
      formData.append('document_category', uploadDocsModal.category);
      if (uploadDocsModal.description) {
        formData.append('document_type_description', uploadDocsModal.description);
      }
      
      await api.post(`/api/deals/drawdowns/${uploadDocsModal.drawdownId}/upload_documents/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      await loadDrawdowns();
      setUploadDocsModal({ open: false, drawdownId: null, files: [], category: 'drawdown_other', description: '' });
      alert('Documents uploaded successfully');
    } catch (err) {
      alert('Failed to upload documents: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleMsAction() {
    try {
      const { drawdownId, action, visitDate, notes } = msActionsModal;
      
      if (action === 'start_review') {
        await api.post(`/api/deals/drawdowns/${drawdownId}/ms_start_review/`);
      } else if (action === 'schedule_visit') {
        if (!visitDate) {
          alert('Please select a visit date');
          return;
        }
        await api.post(`/api/deals/drawdowns/${drawdownId}/ms_schedule_site_visit/`, { visit_date: visitDate });
      } else if (action === 'complete_visit') {
        await api.post(`/api/deals/drawdowns/${drawdownId}/ms_complete_site_visit/`);
      } else if (action === 'approve') {
        await api.post(`/api/deals/drawdowns/${drawdownId}/ms_approve/`, { notes });
      } else if (action === 'reject') {
        if (!notes.trim()) {
          alert('Please provide a reason for rejection');
          return;
        }
        await api.post(`/api/deals/drawdowns/${drawdownId}/ms_reject/`, { reason: notes });
      }
      
      await loadDrawdowns();
      setMsActionsModal({ open: false, drawdownId: null, action: null, visitDate: '', notes: '' });
      if (onUpdate) onUpdate();
      alert('Action completed successfully');
    } catch (err) {
      alert('Failed to perform action: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleViewDocument(docLinkId) {
    try {
      const res = await api.get(`/api/deals/deal-documents/${docLinkId}/view/`);
      if (res.data.view_url) {
        window.open(res.data.view_url, '_blank');
      }
    } catch (err) {
      if (err.response?.data?.requires_step_up) {
        // Handle step-up auth if needed
        alert('Step-up authentication required to view this document');
      } else {
        alert('Failed to view document: ' + (err.response?.data?.error || err.message));
      }
    }
  }

  async function handleDownloadDocument(docLinkId) {
    try {
      const res = await api.get(`/api/deals/deal-documents/${docLinkId}/download/`);
      if (res.data.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      if (err.response?.data?.requires_step_up) {
        alert('Step-up authentication required to download this document');
      } else {
        alert('Failed to download document: ' + (err.response?.data?.error || err.message));
      }
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  async function handleApproveDrawdown() {
    try {
      await api.post(`/api/deals/drawdowns/${approveModal.drawdownId}/approve/`);
      await loadDrawdowns();
      setApproveModal({ open: false, drawdownId: null });
      if (onUpdate) onUpdate();
      alert('Drawdown approved successfully');
    } catch (err) {
      alert('Failed to approve drawdown: ' + (err.response?.data?.error || err.message));
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      requested: { variant: 'info', label: 'Requested' },
      ims_inspection_required: { variant: 'warning', label: 'IMS Inspection Required' },
      ims_certified: { variant: 'info', label: 'IMS Certified' },
      lender_review: { variant: 'warning', label: 'Lender Review' },
      approved: { variant: 'success', label: 'Approved' },
      paid: { variant: 'success', label: 'Paid' },
      rejected: { variant: 'error', label: 'Rejected' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getMsStatusBadge = (status) => {
    const statusMap = {
      pending: { variant: 'info', label: 'Pending MS Review' },
      under_review: { variant: 'warning', label: 'Under MS Review' },
      site_visit_scheduled: { variant: 'info', label: 'Site Visit Scheduled' },
      site_visit_completed: { variant: 'info', label: 'Site Visit Completed' },
      ms_approved: { variant: 'success', label: 'MS Approved' },
      ms_rejected: { variant: 'error', label: 'MS Rejected' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getDocumentCategoryLabel = (category) => {
    const categoryMap = {
      'drawdown_progress_reports': 'Progress Reports',
      'drawdown_photos': 'Photos',
      'drawdown_consultants_building_control': 'Consultants & Building Control',
      'drawdown_other': 'Other',
    };
    return categoryMap[category] || category;
  };

  const groupDocumentsByCategory = (documents) => {
    const grouped = {
      'drawdown_progress_reports': [],
      'drawdown_photos': [],
      'drawdown_consultants_building_control': [],
      'drawdown_other': [],
    };
    
    documents.forEach(doc => {
      const cat = doc.document_category || 'drawdown_other';
      if (grouped[cat]) {
        grouped[cat].push(doc);
      } else {
        grouped['drawdown_other'].push(doc);
      }
    });
    
    return grouped;
  };

  // Check if deal is development finance
  const isDevelopmentFinance = deal?.facility_type === 'development';

  if (loading) {
    return (
      <div style={commonStyles.card}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading drawdowns...</p>
      </div>
    );
  }

  if (!isDevelopmentFinance) {
    return (
      <div style={commonStyles.card}>
        <p style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
          Drawdowns are only available for Development Finance deals. This deal is {deal?.facility_type || 'not a development finance deal'}.
        </p>
      </div>
    );
  }

  const totalRequested = drawdowns.reduce((sum, d) => sum + parseFloat(d.requested_amount || 0), 0);
  const totalApproved = drawdowns
    .filter(d => ['approved', 'paid'].includes(d.lender_approval_status))
    .reduce((sum, d) => sum + parseFloat(d.requested_amount || 0), 0);
  const totalPaid = drawdowns
    .filter(d => d.lender_approval_status === 'paid')
    .reduce((sum, d) => sum + parseFloat(d.requested_amount || 0), 0);

  return (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <div style={commonStyles.card}>
          <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
            Total Requested
          </h3>
          <p style={{ margin: 0, fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold }}>
            {formatCurrency(totalRequested)}
          </p>
        </div>
        <div style={commonStyles.card}>
          <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
            Total Approved
          </h3>
          <p style={{ margin: 0, fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.success }}>
            {formatCurrency(totalApproved)}
          </p>
        </div>
        <div style={commonStyles.card}>
          <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
            Total Paid
          </h3>
          <p style={{ margin: 0, fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.primary }}>
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div style={commonStyles.card}>
          <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
            Drawdowns
          </h3>
          <p style={{ margin: 0, fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold }}>
            {drawdowns.length}
          </p>
        </div>
      </div>

      {/* Request Drawdown Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <h2 style={{ margin: 0 }}>Drawdown Requests</h2>
        {isBorrower && (
          <Button
            variant="primary"
            onClick={() => setRequestModal({ 
              open: true, 
              form: { 
                requested_amount: '', 
                purpose: '', 
                milestone: '',
                ims_inspection_required: true,
                documents: []
              } 
            })}
          >
            + Request Drawdown
          </Button>
        )}
      </div>

      {/* Drawdowns List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        {drawdowns.length === 0 ? (
          <div style={commonStyles.card}>
            <p style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
              No drawdowns requested yet. Click "Request Drawdown" to create one.
            </p>
          </div>
        ) : (
          drawdowns.map((drawdown) => (
            <div
              key={drawdown.id}
              style={{
                ...commonStyles.card,
                borderLeft: `4px solid ${
                  drawdown.lender_approval_status === 'approved' || drawdown.lender_approval_status === 'paid' ? theme.colors.success :
                  drawdown.lender_approval_status === 'rejected' ? theme.colors.error :
                  drawdown.lender_approval_status === 'ims_inspection_required' ? theme.colors.warning :
                  theme.colors.gray300
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                      Drawdown #{drawdown.sequence_number}
                    </h3>
                    {getStatusBadge(drawdown.lender_approval_status)}
                    {drawdown.ms_review_status && getMsStatusBadge(drawdown.ms_review_status)}
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.lg, marginBottom: theme.spacing.sm, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Amount: </span>
                      <span style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold }}>
                        {formatCurrency(drawdown.requested_amount)}
                      </span>
                    </div>
                    {drawdown.retention_amount && (
                      <div>
                        <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Retention: </span>
                        <span style={{ fontSize: theme.typography.fontSize.md }}>
                          {formatCurrency(drawdown.retention_amount)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Purpose:</strong> {drawdown.purpose}
                  </p>
                  {drawdown.milestone && (
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Milestone:</strong> {drawdown.milestone}
                    </p>
                  )}
                  {drawdown.ims_inspection_required && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      padding: theme.spacing.sm,
                      background: drawdown.lender_approval_status === 'ims_certified' 
                        ? theme.colors.infoLight 
                        : theme.colors.warningLight,
                      borderRadius: theme.borderRadius.md,
                    }}>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                        {drawdown.lender_approval_status === 'ims_certified' 
                          ? '✅ IMS inspection completed and certified'
                          : '⏳ IMS inspection required before approval'}
                      </p>
                      {drawdown.ims_inspection_date && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                          Inspection date: {formatDate(drawdown.ims_inspection_date)}
                        </p>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm, flexWrap: 'wrap', fontSize: theme.typography.fontSize.sm }}>
                    <span style={{ color: theme.colors.textSecondary }}>
                      Requested: {formatDate(drawdown.requested_at)}
                    </span>
                    {drawdown.approved_at && (
                      <span style={{ color: theme.colors.textSecondary }}>
                        Approved: {formatDate(drawdown.approved_at)}
                      </span>
                    )}
                    {drawdown.approved_by_name && (
                      <span style={{ color: theme.colors.textSecondary }}>
                        Approved by: {drawdown.approved_by_name}
                      </span>
                    )}
                    {drawdown.paid_at && (
                      <span style={{ color: theme.colors.success }}>
                        Paid: {formatDate(drawdown.paid_at)}
                      </span>
                    )}
                    {drawdown.payment_reference && (
                      <span style={{ color: theme.colors.textSecondary }}>
                        Payment ref: {drawdown.payment_reference}
                      </span>
                    )}
                  </div>
                  {drawdown.contingencies && drawdown.contingencies.length > 0 && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      padding: theme.spacing.sm,
                      background: theme.colors.gray50,
                      borderRadius: theme.borderRadius.md,
                    }}>
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                        Contingencies:
                      </p>
                      <ul style={{ margin: `${theme.spacing.xs} 0 0 0`, paddingLeft: theme.spacing.lg }}>
                        {drawdown.contingencies.map((contingency, idx) => (
                          <li key={idx} style={{ fontSize: theme.typography.fontSize.sm }}>
                            {typeof contingency === 'string' ? contingency : JSON.stringify(contingency)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* MS Review Status Section */}
                  {drawdown.ms_review_status && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      padding: theme.spacing.sm,
                      background: drawdown.ms_review_status === 'ms_approved' 
                        ? theme.colors.infoLight 
                        : drawdown.ms_review_status === 'ms_rejected'
                        ? theme.colors.errorLight
                        : theme.colors.warningLight,
                      borderRadius: theme.borderRadius.md,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs }}>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                          MS Review Status: {drawdown.ms_review_status_display || drawdown.ms_review_status}
                        </p>
                        {isConsultant && drawdown.ms_review_status === 'pending' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'start_review', visitDate: '', notes: '' })}
                          >
                            Start Review
                          </Button>
                        )}
                      </div>
                      {drawdown.ms_reviewed_at && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs }}>
                          Reviewed: {formatDate(drawdown.ms_reviewed_at)}
                          {drawdown.ms_reviewed_by_name && ` by ${drawdown.ms_reviewed_by_name}`}
                        </p>
                      )}
                      {drawdown.ms_notes && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs }}>
                          <strong>Notes:</strong> {drawdown.ms_notes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Supporting Documents Section - Categorized */}
                  <div style={{
                    marginTop: theme.spacing.md,
                    padding: theme.spacing.md,
                    background: theme.colors.gray50,
                    borderRadius: theme.borderRadius.md,
                    border: `1px solid ${theme.colors.gray200}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}>
                      <h4 style={{ margin: 0, fontSize: theme.typography.fontSize.md, fontWeight: theme.typography.fontWeight.medium }}>
                        Supporting Documents
                      </h4>
                      {(isBorrower || isConsultant) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setUploadDocsModal({ open: true, drawdownId: drawdown.id, files: [], category: 'drawdown_other', description: '' })}
                        >
                          + Add Documents
                        </Button>
                      )}
                    </div>
                    {drawdown.supporting_documents && drawdown.supporting_documents.length > 0 ? (
                      (() => {
                        const grouped = groupDocumentsByCategory(drawdown.supporting_documents);
                        const categories = ['drawdown_progress_reports', 'drawdown_photos', 'drawdown_consultants_building_control', 'drawdown_other'];
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                            {categories.map(category => {
                              const docs = grouped[category];
                              if (docs.length === 0) return null;
                              return (
                                <div key={category} style={{
                                  padding: theme.spacing.sm,
                                  background: 'white',
                                  borderRadius: theme.borderRadius.sm,
                                  border: `1px solid ${theme.colors.gray200}`,
                                }}>
                                  <h5 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium, color: theme.colors.primary }}>
                                    {getDocumentCategoryLabel(category)}
                                  </h5>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                                    {docs.map((doc) => (
                                      <div
                                        key={doc.id}
                                        style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          padding: theme.spacing.xs,
                                          background: theme.colors.gray50,
                                          borderRadius: theme.borderRadius.xs,
                                        }}
                                      >
                                        <div style={{ flex: 1 }}>
                                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                                            {doc.document_file_name}
                                          </p>
                                          <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                                            {formatFileSize(doc.document_file_size)} • Uploaded {formatDate(doc.uploaded_at)}
                                            {doc.uploaded_by_name && ` by ${doc.uploaded_by_name}`}
                                            {doc.document_type_description && ` • ${doc.document_type_description}`}
                                          </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleViewDocument(doc.id)}
                                          >
                                            View
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDownloadDocument(doc.id)}
                                          >
                                            Download
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                        No supporting documents uploaded yet. Click "Add Documents" to upload progress reports, programmes, building control reports, photographs, etc.
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.xs, flexDirection: 'column' }}>
                  {/* MS Actions */}
                  {isConsultant && drawdown.ms_review_status && (
                    <>
                      {drawdown.ms_review_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'start_review', visitDate: '', notes: '' })}
                        >
                          Start Review
                        </Button>
                      )}
                      {drawdown.ms_review_status === 'under_review' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'schedule_visit', visitDate: '', notes: '' })}
                          >
                            Schedule Site Visit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'complete_visit', visitDate: '', notes: '' })}
                          >
                            Complete Site Visit
                          </Button>
                        </>
                      )}
                      {drawdown.ms_review_status === 'site_visit_completed' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'approve', visitDate: '', notes: '' })}
                          >
                            Approve for Lender
                          </Button>
                          <Button
                            size="sm"
                            variant="error"
                            onClick={() => setMsActionsModal({ open: true, drawdownId: drawdown.id, action: 'reject', visitDate: '', notes: '' })}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  {/* Lender Actions */}
                  {isLender && drawdown.lender_approval_status === 'lender_review' && drawdown.ms_review_status === 'ms_approved' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setApproveModal({ open: true, drawdownId: drawdown.id })}
                    >
                      Approve Payment
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Request Drawdown Modal */}
      {requestModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            ...commonStyles.card,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Request Drawdown</h2>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Amount (Required)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={requestModal.form.requested_amount}
                onChange={(e) => setRequestModal({ ...requestModal, form: { ...requestModal.form, requested_amount: e.target.value } })}
                placeholder="0.00"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Purpose (Required)
              </label>
              <Textarea
                value={requestModal.form.purpose}
                onChange={(e) => setRequestModal({ ...requestModal, form: { ...requestModal.form, purpose: e.target.value } })}
                rows={4}
                placeholder="e.g., Payment for foundation works, materials, etc."
              />
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Milestone (Optional)
              </label>
              <Input
                value={requestModal.form.milestone}
                onChange={(e) => setRequestModal({ ...requestModal, form: { ...requestModal.form, milestone: e.target.value } })}
                placeholder="e.g., Foundation complete, First floor complete"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <input
                  type="checkbox"
                  checked={requestModal.form.ims_inspection_required}
                  onChange={(e) => setRequestModal({ ...requestModal, form: { ...requestModal.form, ims_inspection_required: e.target.checked } })}
                />
                <span style={{ fontSize: theme.typography.fontSize.sm }}>
                  IMS Inspection Required
                </span>
              </label>
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Supporting Documents (Optional)
              </label>
              <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                Upload progress reports, programmes, building control reports, photographs, etc.
              </p>
              <input
                type="file"
                multiple
                onChange={(e) => setRequestModal({ ...requestModal, form: { ...requestModal.form, documents: Array.from(e.target.files) } })}
                style={{
                  width: '100%',
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                }}
              />
              {requestModal.form.documents && requestModal.form.documents.length > 0 && (
                <div style={{ marginTop: theme.spacing.xs }}>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                    {requestModal.form.documents.length} file(s) selected
                  </p>
                  <ul style={{ margin: `${theme.spacing.xs} 0 0 0`, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.xs }}>
                    {Array.from(requestModal.form.documents).map((file, idx) => (
                      <li key={idx} style={{ color: theme.colors.textSecondary }}>
                        {file.name} ({formatFileSize(file.size)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setRequestModal({ 
                  open: false, 
                  form: { 
                    requested_amount: '', 
                    purpose: '', 
                    milestone: '',
                    ims_inspection_required: true,
                    documents: []
                  } 
                })}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRequestDrawdown}
                disabled={!requestModal.form.requested_amount || !requestModal.form.purpose.trim()}
              >
                Request Drawdown
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Drawdown Modal */}
      {approveModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            ...commonStyles.card,
            maxWidth: '500px',
            width: '90%',
          }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Approve Drawdown</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
              Are you sure you want to approve this drawdown? This action will mark it as approved and ready for payment.
            </p>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setApproveModal({ open: false, drawdownId: null })}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleApproveDrawdown}
              >
                Approve Drawdown
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Documents Modal */}
      {uploadDocsModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            ...commonStyles.card,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Upload Supporting Documents</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md, fontSize: theme.typography.fontSize.sm }}>
              Upload progress reports, programmes, building control reports, photographs, or other supporting documents for this drawdown.
            </p>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Document Category (Required)
              </label>
              <Select
                value={uploadDocsModal.category}
                onChange={(e) => setUploadDocsModal({ ...uploadDocsModal, category: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="drawdown_progress_reports">Progress Reports</option>
                <option value="drawdown_photos">Photos</option>
                <option value="drawdown_consultants_building_control">Consultants & Building Control</option>
                <option value="drawdown_other">Other</option>
              </Select>
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Description (Optional)
              </label>
              <Input
                value={uploadDocsModal.description}
                onChange={(e) => setUploadDocsModal({ ...uploadDocsModal, description: e.target.value })}
                placeholder="e.g., Site Visit Photos, Progress Report Week 4"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Select Files
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => setUploadDocsModal({ ...uploadDocsModal, files: Array.from(e.target.files) })}
                style={{
                  width: '100%',
                  padding: theme.spacing.sm,
                  border: `1px solid ${theme.colors.gray300}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                }}
              />
              {uploadDocsModal.files && uploadDocsModal.files.length > 0 && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.medium }}>
                    Selected files:
                  </p>
                  <ul style={{ margin: `${theme.spacing.xs} 0 0 0`, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                    {Array.from(uploadDocsModal.files).map((file, idx) => (
                      <li key={idx} style={{ color: theme.colors.textSecondary }}>
                        {file.name} ({formatFileSize(file.size)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setUploadDocsModal({ open: false, drawdownId: null, files: [], category: 'drawdown_other', description: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUploadDocuments}
                disabled={!uploadDocsModal.files || uploadDocsModal.files.length === 0 || !uploadDocsModal.category}
              >
                Upload Documents
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MS Actions Modal */}
      {msActionsModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            ...commonStyles.card,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
              {msActionsModal.action === 'start_review' && 'Start MS Review'}
              {msActionsModal.action === 'schedule_visit' && 'Schedule Site Visit'}
              {msActionsModal.action === 'complete_visit' && 'Complete Site Visit'}
              {msActionsModal.action === 'approve' && 'Approve for Lender Review'}
              {msActionsModal.action === 'reject' && 'Reject Drawdown'}
            </h2>
            
            {msActionsModal.action === 'schedule_visit' && (
              <div style={{ marginBottom: theme.spacing.md }}>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                  Visit Date (Required)
                </label>
                <Input
                  type="date"
                  value={msActionsModal.visitDate}
                  onChange={(e) => setMsActionsModal({ ...msActionsModal, visitDate: e.target.value })}
                />
              </div>
            )}
            
            {(msActionsModal.action === 'approve' || msActionsModal.action === 'reject') && (
              <div style={{ marginBottom: theme.spacing.md }}>
                <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                  {msActionsModal.action === 'approve' ? 'Notes (Optional)' : 'Reason (Required)'}
                </label>
                <Textarea
                  value={msActionsModal.notes}
                  onChange={(e) => setMsActionsModal({ ...msActionsModal, notes: e.target.value })}
                  rows={4}
                  placeholder={msActionsModal.action === 'approve' ? 'Add any notes about the review...' : 'Provide reason for rejection...'}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setMsActionsModal({ open: false, drawdownId: null, action: null, visitDate: '', notes: '' })}
              >
                Cancel
              </Button>
              <Button
                variant={msActionsModal.action === 'reject' ? 'error' : 'primary'}
                onClick={handleMsAction}
                disabled={
                  (msActionsModal.action === 'schedule_visit' && !msActionsModal.visitDate) ||
                  (msActionsModal.action === 'reject' && !msActionsModal.notes.trim())
                }
              >
                {msActionsModal.action === 'start_review' && 'Start Review'}
                {msActionsModal.action === 'schedule_visit' && 'Schedule Visit'}
                {msActionsModal.action === 'complete_visit' && 'Complete Visit'}
                {msActionsModal.action === 'approve' && 'Approve'}
                {msActionsModal.action === 'reject' && 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Drawdowns;
