import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Badge from './Badge';
import Select from './Select';
import Textarea from './Textarea';
import Input from './Input';

function LegalWorkspace({ dealId, deal, onUpdate }) {
  const [cps, setCps] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('cps'); // 'cps' or 'requisitions'
  const [cpFilter, setCpFilter] = useState('all'); // all, pending, satisfied, rejected, waived
  const [reqFilter, setReqFilter] = useState('all'); // all, open, responded, approved, rejected, closed
  
  // CP modals
  const [approveCpModal, setApproveCpModal] = useState({ open: false, cpId: null });
  const [rejectCpModal, setRejectCpModal] = useState({ open: false, cpId: null, reason: '' });
  
  // Requisition modals
  const [raiseReqModal, setRaiseReqModal] = useState({ open: false, form: { title: '', question: '' } });
  const [respondReqModal, setRespondReqModal] = useState({ open: false, reqId: null, response: '' });

  useEffect(() => {
    loadCPs();
    loadRequisitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  async function loadCPs() {
    try {
      const res = await api.get(`/api/deals/deal-cps/?deal_id=${dealId}`);
      setCps(res.data || []);
    } catch (err) {
      console.error('Failed to load CPs:', err);
      setCps([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequisitions() {
    try {
      const res = await api.get(`/api/deals/deal-requisitions/?deal_id=${dealId}`);
      setRequisitions(res.data || []);
    } catch (err) {
      console.error('Failed to load requisitions:', err);
      setRequisitions([]);
    }
  }

  async function handleApproveCP() {
    try {
      await api.post(`/api/deals/deal-cps/${approveCpModal.cpId}/approve/`);
      await loadCPs();
      setApproveCpModal({ open: false, cpId: null });
      if (onUpdate) onUpdate();
      alert('CP approved successfully');
    } catch (err) {
      alert('Failed to approve CP: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleRejectCP() {
    if (!rejectCpModal.reason.trim()) {
      alert('Please provide a reason for rejecting the CP');
      return;
    }

    try {
      await api.post(`/api/deals/deal-cps/${rejectCpModal.cpId}/reject/`, {
        reason: rejectCpModal.reason,
      });
      await loadCPs();
      setRejectCpModal({ open: false, cpId: null, reason: '' });
      if (onUpdate) onUpdate();
      alert('CP rejected successfully');
    } catch (err) {
      alert('Failed to reject CP: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleRaiseRequisition() {
    if (!raiseReqModal.form.title.trim() || !raiseReqModal.form.question.trim()) {
      alert('Please provide both title and question');
      return;
    }

    try {
      // Look up deal by deal_id first
      const dealRes = await api.get(`/api/deals/deals/${dealId}/`);
      await api.post('/api/deals/deal-requisitions/', {
        deal: dealRes.data.id,
        subject: raiseReqModal.form.title,
        question: raiseReqModal.form.question,
      });
      await loadRequisitions();
      setRaiseReqModal({ open: false, form: { title: '', question: '' } });
      alert('Requisition raised successfully');
    } catch (err) {
      alert('Failed to raise requisition: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleRespondRequisition() {
    if (!respondReqModal.response.trim()) {
      alert('Please provide a response');
      return;
    }

    try {
      await api.post(`/api/deals/deal-requisitions/${respondReqModal.reqId}/respond/`, {
        response: respondReqModal.response,
      });
      await loadRequisitions();
      setRespondReqModal({ open: false, reqId: null, response: '' });
      alert('Response submitted successfully');
    } catch (err) {
      alert('Failed to submit response: ' + (err.response?.data?.error || err.message));
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

  const getCPStatusBadge = (status) => {
    const statusMap = {
      pending: { variant: 'warning', label: 'Pending' },
      satisfied: { variant: 'success', label: 'Satisfied' },
      rejected: { variant: 'error', label: 'Rejected' },
      waived: { variant: 'info', label: 'Waived' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getReqStatusBadge = (status) => {
    const statusMap = {
      open: { variant: 'warning', label: 'Open' },
      responded: { variant: 'info', label: 'Responded' },
      approved: { variant: 'success', label: 'Approved' },
      rejected: { variant: 'error', label: 'Rejected' },
      closed: { variant: 'info', label: 'Closed' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const filteredCPs = cps.filter(cp => {
    if (cpFilter === 'all') return true;
    return cp.status === cpFilter;
  });

  const filteredRequisitions = requisitions.filter(req => {
    if (reqFilter === 'all') return true;
    return req.status === reqFilter;
  });

  const mandatoryCPs = filteredCPs.filter(cp => cp.is_mandatory);
  const satisfiedMandatoryCPs = mandatoryCPs.filter(cp => cp.status === 'satisfied');
  const cpProgress = mandatoryCPs.length > 0 
    ? Math.round((satisfiedMandatoryCPs.length / mandatoryCPs.length) * 100) 
    : 0;

  if (loading) {
    return (
      <div style={commonStyles.card}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading legal workspace...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.gray300}` }}>
        <button
          onClick={() => setActiveSubTab('cps')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            border: 'none',
            borderBottom: activeSubTab === 'cps' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            background: 'transparent',
            color: activeSubTab === 'cps' ? theme.colors.primary : theme.colors.textSecondary,
            cursor: 'pointer',
            fontWeight: activeSubTab === 'cps' ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal,
          }}
        >
          CP Checklist ({mandatoryCPs.length} mandatory, {satisfiedMandatoryCPs.length} satisfied)
        </button>
        <button
          onClick={() => setActiveSubTab('requisitions')}
          style={{
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            border: 'none',
            borderBottom: activeSubTab === 'requisitions' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            background: 'transparent',
            color: activeSubTab === 'requisitions' ? theme.colors.primary : theme.colors.textSecondary,
            cursor: 'pointer',
            fontWeight: activeSubTab === 'requisitions' ? theme.typography.fontWeight.medium : theme.typography.fontWeight.normal,
          }}
        >
          Requisitions ({requisitions.filter(r => r.status === 'open').length} open)
        </button>
      </div>

      {/* CP Checklist Tab */}
      {activeSubTab === 'cps' && (
        <div>
          {/* CP Progress Summary */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>CP Progress</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  width: '100%', 
                  height: '24px', 
                  background: theme.colors.gray200, 
                  borderRadius: theme.borderRadius.md,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${cpProgress}%`,
                    height: '100%',
                    background: cpProgress === 100 ? theme.colors.success : theme.colors.primary,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
              <div style={{ fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.medium }}>
                {cpProgress}%
              </div>
            </div>
            <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
              {satisfiedMandatoryCPs.length} of {mandatoryCPs.length} mandatory CPs satisfied
            </p>
          </div>

          {/* CP Filter */}
          <div style={{ marginBottom: theme.spacing.md }}>
            <Select
              value={cpFilter}
              onChange={(e) => setCpFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="all">All CPs</option>
              <option value="pending">Pending</option>
              <option value="satisfied">Satisfied</option>
              <option value="rejected">Rejected</option>
              <option value="waived">Waived</option>
            </Select>
          </div>

          {/* CP List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            {filteredCPs.length === 0 ? (
              <div style={commonStyles.card}>
                <p style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                  No CPs found. CPs will be created from the product playbook when the deal enters the legal stage.
                </p>
              </div>
            ) : (
              filteredCPs.map((cp) => (
                <div
                  key={cp.id}
                  style={{
                    ...commonStyles.card,
                    borderLeft: `4px solid ${
                      cp.status === 'satisfied' ? theme.colors.success :
                      cp.status === 'rejected' ? theme.colors.error :
                      cp.is_mandatory ? theme.colors.warning :
                      theme.colors.gray300
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                        <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                          {cp.cp_number}: {cp.title}
                        </h3>
                        {cp.is_mandatory && <Badge variant="warning">Mandatory</Badge>}
                        {getCPStatusBadge(cp.status)}
                      </div>
                      <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                        {cp.description}
                      </p>
                      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm, flexWrap: 'wrap', fontSize: theme.typography.fontSize.sm }}>
                        <span style={{ color: theme.colors.textSecondary }}>
                          Owner: {cp.owner_party_type}
                        </span>
                        {cp.due_date && (
                          <span style={{ color: theme.colors.textSecondary }}>
                            Due: {formatDate(cp.due_date)}
                          </span>
                        )}
                        {cp.approved_at && (
                          <span style={{ color: theme.colors.textSecondary }}>
                            Approved: {formatDate(cp.approved_at)}
                          </span>
                        )}
                        {cp.rejected_at && (
                          <span style={{ color: theme.colors.error }}>
                            Rejected: {formatDate(cp.rejected_at)}
                          </span>
                        )}
                      </div>
                      {cp.rejection_reason && (
                        <div style={{
                          marginTop: theme.spacing.sm,
                          padding: theme.spacing.sm,
                          background: theme.colors.errorLight,
                          borderRadius: theme.borderRadius.md,
                        }}>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                            <strong>Rejection reason:</strong> {cp.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                      {cp.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => setApproveCpModal({ open: true, cpId: cp.id })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="error"
                            onClick={() => setRejectCpModal({ open: true, cpId: cp.id, reason: '' })}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Requisitions Tab */}
      {activeSubTab === 'requisitions' && (
        <div>
          {/* Raise Requisition Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: 0 }}>Legal Requisitions</h3>
            <Button
              variant="primary"
              onClick={() => setRaiseReqModal({ open: true, form: { title: '', question: '' } })}
            >
              + Raise Requisition
            </Button>
          </div>

          {/* Requisition Filter */}
          <div style={{ marginBottom: theme.spacing.md }}>
            <Select
              value={reqFilter}
              onChange={(e) => setReqFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="all">All Requisitions</option>
              <option value="open">Open</option>
              <option value="responded">Responded</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="closed">Closed</option>
            </Select>
          </div>

          {/* Requisitions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
            {filteredRequisitions.length === 0 ? (
              <div style={commonStyles.card}>
                <p style={{ color: theme.colors.textSecondary, textAlign: 'center' }}>
                  No requisitions found. Click "Raise Requisition" to create one.
                </p>
              </div>
            ) : (
              filteredRequisitions.map((req) => (
                <div
                  key={req.id}
                  style={{
                    ...commonStyles.card,
                    borderLeft: `4px solid ${
                      req.status === 'approved' ? theme.colors.success :
                      req.status === 'rejected' ? theme.colors.error :
                      req.status === 'open' ? theme.colors.warning :
                      theme.colors.gray300
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                        <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                          {req.subject}
                        </h3>
                        {getReqStatusBadge(req.status)}
                      </div>
                      <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                        <strong>Question:</strong> {req.question}
                      </p>
                      {req.response && (
                        <div style={{
                          marginTop: theme.spacing.sm,
                          padding: theme.spacing.sm,
                          background: theme.colors.infoLight,
                          borderRadius: theme.borderRadius.md,
                        }}>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                            <strong>Response:</strong> {req.response}
                          </p>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm, flexWrap: 'wrap', fontSize: theme.typography.fontSize.sm }}>
                        <span style={{ color: theme.colors.textSecondary }}>
                          Raised by: {req.raised_by_name || 'Unknown'}
                        </span>
                        <span style={{ color: theme.colors.textSecondary }}>
                          Raised: {formatDate(req.created_at)}
                        </span>
                        {req.responded_at && (
                          <span style={{ color: theme.colors.textSecondary }}>
                            Responded: {formatDate(req.responded_at)}
                          </span>
                        )}
                        {req.responded_by_name && (
                          <span style={{ color: theme.colors.textSecondary }}>
                            Response by: {req.responded_by_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                      {req.status === 'open' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setRespondReqModal({ open: true, reqId: req.id, response: '' })}
                        >
                          Respond
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Approve CP Modal */}
      {approveCpModal.open && (
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
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Approve CP</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
              Are you sure you want to approve this CP? This action will mark it as satisfied.
            </p>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setApproveCpModal({ open: false, cpId: null })}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={handleApproveCP}
              >
                Approve CP
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject CP Modal */}
      {rejectCpModal.open && (
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
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Reject CP</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
              Please provide a reason for rejecting this CP.
            </p>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Reason (Required)
              </label>
              <Textarea
                value={rejectCpModal.reason}
                onChange={(e) => setRejectCpModal({ ...rejectCpModal, reason: e.target.value })}
                rows={4}
                placeholder="e.g., Evidence provided is insufficient..."
              />
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setRejectCpModal({ open: false, cpId: null, reason: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                onClick={handleRejectCP}
                disabled={!rejectCpModal.reason.trim()}
              >
                Reject CP
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Raise Requisition Modal */}
      {raiseReqModal.open && (
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
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Raise Requisition</h2>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Title (Required)
              </label>
              <Input
                value={raiseReqModal.form.title}
                onChange={(e) => setRaiseReqModal({ ...raiseReqModal, form: { ...raiseReqModal.form, title: e.target.value } })}
                placeholder="e.g., Confirmation of planning permission"
              />
            </div>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Question (Required)
              </label>
              <Textarea
                value={raiseReqModal.form.question}
                onChange={(e) => setRaiseReqModal({ ...raiseReqModal, form: { ...raiseReqModal.form, question: e.target.value } })}
                rows={6}
                placeholder="Please provide details about..."
              />
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setRaiseReqModal({ open: false, form: { title: '', question: '' } })}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRaiseRequisition}
                disabled={!raiseReqModal.form.title.trim() || !raiseReqModal.form.question.trim()}
              >
                Raise Requisition
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Respond Requisition Modal */}
      {respondReqModal.open && (
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
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Respond to Requisition</h2>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Response (Required)
              </label>
              <Textarea
                value={respondReqModal.response}
                onChange={(e) => setRespondReqModal({ ...respondReqModal, response: e.target.value })}
                rows={8}
                placeholder="Provide your response to the requisition..."
              />
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => setRespondReqModal({ open: false, reqId: null, response: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRespondRequisition}
                disabled={!respondReqModal.response.trim()}
              >
                Submit Response
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LegalWorkspace;
