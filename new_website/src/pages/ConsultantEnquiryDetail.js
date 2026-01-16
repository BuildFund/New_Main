import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input from '../components/Input';
import Textarea from '../components/Textarea';

function ConsultantEnquiryDetail() {
  const { enquiryId } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acknowledging, setAcknowledging] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showAcknowledgeForm, setShowAcknowledgeForm] = useState(false);
  const [showQueriesForm, setShowQueriesForm] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declining, setDeclining] = useState(false);
  const [acknowledgeData, setAcknowledgeData] = useState({
    expected_quote_date: '',
    acknowledgment_notes: '',
  });
  const [queriesText, setQueriesText] = useState('');

  useEffect(() => {
    loadEnquiry();
  }, [enquiryId]);

  async function loadEnquiry() {
    try {
      const res = await api.get(`/api/deals/provider-enquiries/${enquiryId}/`);
      setEnquiry(res.data);
    } catch (err) {
      setError('Failed to load enquiry details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAcknowledge = async (e) => {
    e.preventDefault();
    setAcknowledging(true);
    setError(null);

    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/acknowledge/`, {
        expected_quote_date: acknowledgeData.expected_quote_date,
        acknowledgment_notes: acknowledgeData.acknowledgment_notes,
      });
      await loadEnquiry();
      setShowAcknowledgeForm(false);
      setAcknowledgeData({ expected_quote_date: '', acknowledgment_notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to acknowledge enquiry');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleMarkViewed = async () => {
    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/mark_viewed/`);
      await loadEnquiry();
    } catch (err) {
      console.error('Failed to mark as viewed:', err);
      alert('Failed to mark as received: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStatus = async (newStatus, notes = '') => {
    setUpdatingStatus(true);
    setError(null);
    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/update-status/`, {
        status: newStatus,
        notes: notes,
      });
      await loadEnquiry();
      if (newStatus === 'queries_raised') {
        setShowQueriesForm(false);
        setQueriesText('');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to update status');
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeclineEnquiry = async () => {
    if (!declineReason.trim()) {
      alert('Please provide a reason for declining this enquiry');
      return;
    }

    setDeclining(true);
    setError(null);
    try {
      await api.post(`/api/deals/provider-enquiries/${enquiryId}/decline/`, {
        reason: declineReason,
      });
      await loadEnquiry();
      setShowDeclineModal(false);
      setDeclineReason('');
      alert('Enquiry declined successfully');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to decline enquiry');
    } finally {
      setDeclining(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading enquiry details...</p>
      </div>
    );
  }

  if (error && !enquiry) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Error</h2>
          <p>{error}</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Enquiry Not Found</h2>
          <p>The enquiry you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/consultant/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const isExpired = enquiry.quote_due_at && new Date(enquiry.quote_due_at) < new Date();
  const dealSummary = enquiry.deal_summary_snapshot || {};
  const project = dealSummary.project || {};
  const borrower = dealSummary.borrower || {};
  const lender = dealSummary.lender || {};
  const product = dealSummary.product || {};
  const commercialIndicators = dealSummary.commercial_indicators || {};
  const applicationTerms = dealSummary.application_terms || {};
  const securityStructure = dealSummary.security_structure || {};
  const transactionStructure = dealSummary.transaction_structure || {};

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.lg }}>
        <Button variant="outline" onClick={() => navigate('/consultant/dashboard')}>
          ← Back to Dashboard
        </Button>
      </div>

      <div style={commonStyles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.lg }}>
          <div>
            <h1 style={{ margin: 0 }}>Quote Request Details</h1>
            <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0 0 0` }}>
              Deal {enquiry.deal_id_display || enquiry.deal}
            </p>
          </div>
          <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <Badge color={theme.colors.primary}>
              {enquiry.role_type_display || enquiry.role_type}
            </Badge>
            <Badge color={getStatusColor(enquiry.status)}>
              {enquiry.status_display || enquiry.status}
            </Badge>
            {isExpired && (
              <Badge color={theme.colors.error}>Expired</Badge>
            )}
            {enquiry.acknowledged_at && (
              <Badge color={theme.colors.success}>Acknowledged</Badge>
            )}
          </div>
        </div>

        {/* Quote Request Workflow - MOVED TO TOP */}
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quote Request Workflow</h2>
          
          {/* Progress Steps */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              {/* Step 1: Received */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '150px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: ['received', 'acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) 
                    ? theme.colors.success 
                    : enquiry.status === 'sent' 
                    ? theme.colors.primary 
                    : theme.colors.gray300,
                  color: theme.colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {['received', 'acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) ? '✓' : '1'}
                </div>
                <div>
                  <div style={{ fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm }}>
                    Received
                  </div>
                  {enquiry.viewed_at && (
                    <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                      {new Date(enquiry.viewed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector */}
              <div style={{ width: '20px', height: '2px', background: ['acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) ? theme.colors.success : theme.colors.gray300 }} />

              {/* Step 2: Acknowledged */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '150px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: ['acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) 
                    ? theme.colors.success 
                    : enquiry.status === 'received' 
                    ? theme.colors.primary 
                    : theme.colors.gray300,
                  color: theme.colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {['acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) ? '✓' : '2'}
                </div>
                <div>
                  <div style={{ fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm }}>
                    Acknowledged
                  </div>
                  {enquiry.acknowledged_at && (
                    <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                      {new Date(enquiry.acknowledged_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector */}
              <div style={{ width: '20px', height: '2px', background: ['preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) ? theme.colors.success : theme.colors.gray300 }} />

              {/* Step 3: Preparing Quote */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '150px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: enquiry.status === 'preparing_quote' 
                    ? theme.colors.primary 
                    : ['queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) 
                    ? theme.colors.success 
                    : theme.colors.gray300,
                  color: theme.colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {['preparing_quote', 'queries_raised', 'ready_to_submit', 'quoted'].includes(enquiry.status) ? '✓' : '3'}
                </div>
                <div>
                  <div style={{ fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm }}>
                    Preparing Quote
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div style={{ width: '20px', height: '2px', background: ['ready_to_submit', 'quoted'].includes(enquiry.status) ? theme.colors.success : theme.colors.gray300 }} />

              {/* Step 4: Ready to Submit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '150px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: enquiry.status === 'ready_to_submit' 
                    ? theme.colors.primary 
                    : enquiry.status === 'quoted' 
                    ? theme.colors.success 
                    : theme.colors.gray300,
                  color: theme.colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {['ready_to_submit', 'quoted'].includes(enquiry.status) ? '✓' : '4'}
                </div>
                <div>
                  <div style={{ fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm }}>
                    Ready to Submit
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div style={{ width: '20px', height: '2px', background: enquiry.status === 'quoted' ? theme.colors.success : theme.colors.gray300 }} />

              {/* Step 5: Quote Submitted */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flex: 1, minWidth: '150px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: enquiry.status === 'quoted' ? theme.colors.success : theme.colors.gray300,
                  color: theme.colors.white,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: theme.typography.fontWeight.bold,
                  fontSize: theme.typography.fontSize.sm,
                }}>
                  {enquiry.status === 'quoted' ? '✓' : '5'}
                </div>
                <div>
                  <div style={{ fontWeight: theme.typography.fontWeight.semibold, fontSize: theme.typography.fontSize.sm }}>
                    Quote Submitted
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Status Actions */}
          <div style={commonStyles.card}>
            {enquiry.status === 'sent' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Mark this quote request as received to begin the process.
                </p>
                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    onClick={handleMarkViewed}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? 'Updating...' : 'Mark as Received'}
                  </Button>
                  <Button
                    variant="error"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={updatingStatus}
                  >
                    Decline Enquiry
                  </Button>
                </div>
              </div>
            )}

            {enquiry.status === 'received' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Acknowledge this quote request and provide your expected quote date.
                </p>
                {!showAcknowledgeForm ? (
                  <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      onClick={() => setShowAcknowledgeForm(true)}
                    >
                      Acknowledge Quote Request
                    </Button>
                    <Button
                      variant="error"
                      onClick={() => setShowDeclineModal(true)}
                    >
                      Decline Enquiry
                    </Button>
                  </div>
                ) : (
                  <div>
                    <form onSubmit={handleAcknowledge}>
                      <Input
                        label="Expected Quote Date *"
                        name="expected_quote_date"
                        type="date"
                        value={acknowledgeData.expected_quote_date}
                        onChange={(e) => setAcknowledgeData({ ...acknowledgeData, expected_quote_date: e.target.value })}
                        required
                        style={{ marginBottom: theme.spacing.md }}
                      />
                      <Textarea
                        label="Notes (Optional)"
                        name="acknowledgment_notes"
                        value={acknowledgeData.acknowledgment_notes}
                        onChange={(e) => setAcknowledgeData({ ...acknowledgeData, acknowledgment_notes: e.target.value })}
                        rows={3}
                        placeholder="Any notes about timeline, questions, or requirements..."
                        style={{ marginBottom: theme.spacing.md }}
                      />
                      <div style={{ display: 'flex', gap: theme.spacing.md }}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAcknowledgeForm(false);
                            setAcknowledgeData({ expected_quote_date: '', acknowledgment_notes: '' });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          loading={acknowledging}
                        >
                          {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {enquiry.status === 'acknowledged' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Start preparing your quote. You can raise queries if you need more information.
                </p>
                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    onClick={() => handleUpdateStatus('preparing_quote')}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? 'Updating...' : 'Start Preparing Quote'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowQueriesForm(true)}
                    disabled={updatingStatus}
                  >
                    Raise Queries
                  </Button>
                  <Button
                    variant="error"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={updatingStatus}
                  >
                    Decline Enquiry
                  </Button>
                </div>
                {showQueriesForm && (
                  <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
                    <Textarea
                      label="Your Questions"
                      value={queriesText}
                      onChange={(e) => setQueriesText(e.target.value)}
                      rows={4}
                      placeholder="What information do you need from the lender?"
                      style={{ marginBottom: theme.spacing.md }}
                    />
                    <div style={{ display: 'flex', gap: theme.spacing.md }}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowQueriesForm(false);
                          setQueriesText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleUpdateStatus('queries_raised', queriesText)}
                        disabled={updatingStatus || !queriesText.trim()}
                      >
                        {updatingStatus ? 'Submitting...' : 'Submit Queries'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {enquiry.status === 'preparing_quote' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Continue preparing your quote. When ready, mark it as ready to submit.
                </p>
                <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    onClick={() => handleUpdateStatus('ready_to_submit')}
                    disabled={updatingStatus}
                  >
                    {updatingStatus ? 'Updating...' : 'Mark as Ready to Submit'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowQueriesForm(true)}
                    disabled={updatingStatus}
                  >
                    Raise Queries
                  </Button>
                  <Button
                    variant="error"
                    onClick={() => setShowDeclineModal(true)}
                    disabled={updatingStatus}
                  >
                    Decline Enquiry
                  </Button>
                </div>
                {showQueriesForm && (
                  <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
                    <Textarea
                      label="Your Questions"
                      value={queriesText}
                      onChange={(e) => setQueriesText(e.target.value)}
                      rows={4}
                      placeholder="What information do you need from the lender?"
                      style={{ marginBottom: theme.spacing.md }}
                    />
                    <div style={{ display: 'flex', gap: theme.spacing.md }}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowQueriesForm(false);
                          setQueriesText('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => handleUpdateStatus('queries_raised', queriesText)}
                        disabled={updatingStatus || !queriesText.trim()}
                      >
                        {updatingStatus ? 'Submitting...' : 'Submit Queries'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {enquiry.status === 'queries_raised' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Continue preparing your quote once your queries have been answered.
                </p>
                <Button
                  variant="primary"
                  onClick={() => handleUpdateStatus('preparing_quote')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? 'Updating...' : 'Continue Preparing Quote'}
                </Button>
              </div>
            )}

            {enquiry.status === 'ready_to_submit' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Your quote is ready. Submit it now.
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/consultant/enquiries/${enquiryId}/quote`)}
                >
                  Submit Quote
                </Button>
              </div>
            )}

            {enquiry.status === 'quoted' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.success }}>
                  ✓ Quote submitted successfully!
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate('/consultant/dashboard', { state: { activeTab: 'quotes' } })}
                >
                  View Submitted Quote
                </Button>
              </div>
            )}

            {/* Acknowledgment Details (if acknowledged) */}
            {enquiry.acknowledged_at && (
              <div style={{ marginTop: theme.spacing.lg, padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.md }}>
                  Acknowledgment Details
                </h3>
                <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                  <strong>Acknowledged:</strong> {new Date(enquiry.acknowledged_at).toLocaleString()}
                </p>
                {enquiry.expected_quote_date && (
                  <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Expected Quote Date:</strong> {new Date(enquiry.expected_quote_date).toLocaleDateString()}
                  </p>
                )}
                {enquiry.acknowledgment_notes && (
                  <div style={{ marginTop: theme.spacing.xs }}>
                    <strong style={{ fontSize: theme.typography.fontSize.sm }}>Notes:</strong>
                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {enquiry.acknowledgment_notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Decline Status Display */}
            {enquiry.status === 'declined' && enquiry.decline_reason && (
              <div style={{ marginTop: theme.spacing.lg, padding: theme.spacing.md, background: theme.colors.errorLight, borderRadius: theme.borderRadius.md }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.md, color: theme.colors.error }}>
                  Enquiry Declined
                </h3>
                <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                  <strong>Reason:</strong>
                </p>
                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                  {enquiry.decline_reason}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Decline Enquiry Modal */}
        {showDeclineModal && (
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
            zIndex: 1000,
          }}>
            <div style={{
              background: theme.colors.white,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.xl,
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Decline Quote Request</h2>
              <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                Please provide a reason for declining this quote request. This will be shared with the lender.
              </p>
              <Textarea
                label="Reason for Decline *"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={5}
                placeholder="Please explain why you are declining this quote request..."
                style={{ marginBottom: theme.spacing.lg }}
                required
              />
              <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeclineModal(false);
                    setDeclineReason('');
                  }}
                  disabled={declining}
                >
                  Cancel
                </Button>
                <Button
                  variant="error"
                  onClick={handleDeclineEnquiry}
                  disabled={declining || !declineReason.trim()}
                  loading={declining}
                >
                  {declining ? 'Declining...' : 'Decline Enquiry'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: theme.spacing.md,
            background: theme.colors.errorLight,
            color: theme.colors.errorDark,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
          }}>
            {error}
          </div>
        )}

        {/* Key Information Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}>
          <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Received</p>
            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold }}>
              {new Date(enquiry.sent_at).toLocaleDateString()}
            </p>
          </div>
          {enquiry.quote_due_at && (
            <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.md }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Quote Due</p>
              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold, color: isExpired ? theme.colors.error : 'inherit' }}>
                {new Date(enquiry.quote_due_at).toLocaleDateString()}
              </p>
            </div>
          )}
          {enquiry.expected_quote_date && (
            <div style={{ padding: theme.spacing.md, background: theme.colors.successLight, borderRadius: theme.borderRadius.md }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Expected Quote Date</p>
              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                {new Date(enquiry.expected_quote_date).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Project Information */}
        {Object.keys(project).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Project Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {project.property_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Property Type:</strong> {project.property_type_display}
                </div>
              )}
              {project.address && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Address:</strong> {project.address}
                  {project.town && `, ${project.town}`}
                  {project.county && `, ${project.county}`}
                  {project.postcode && ` ${project.postcode}`}
                </div>
              )}
              {project.description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0`, whiteSpace: 'pre-wrap' }}>{project.description}</p>
                </div>
              )}
              {project.development_extent_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Development Extent:</strong> {project.development_extent_display}
                </div>
              )}
              {project.tenure_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Tenure:</strong> {project.tenure_display}
                </div>
              )}
              {project.planning_permission !== undefined && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Planning Permission:</strong> {project.planning_permission ? 'Yes' : 'No'}
                  {project.planning_reference && ` (Ref: ${project.planning_reference})`}
                </div>
              )}
              {project.planning_description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Planning Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{project.planning_description}</p>
                </div>
              )}
              {project.unit_counts && Object.keys(project.unit_counts).length > 0 && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Unit Counts:</strong> {JSON.stringify(project.unit_counts)}
                </div>
              )}
              {project.funding_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Funding Type:</strong> {project.funding_type_display}
                </div>
              )}
              {project.repayment_method_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Repayment Method:</strong> {project.repayment_method_display}
                </div>
              )}
              {project.term_required_months && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Term Required:</strong> {project.term_required_months} months
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                {project.gross_internal_area && (
                  <div>
                    <strong>GIA:</strong> {project.gross_internal_area.toLocaleString()} sq ft
                  </div>
                )}
                {project.purchase_price && (
                  <div>
                    <strong>Purchase Price:</strong> £{project.purchase_price.toLocaleString()}
                  </div>
                )}
                {project.purchase_costs && (
                  <div>
                    <strong>Purchase Costs:</strong> £{project.purchase_costs.toLocaleString()}
                  </div>
                )}
                {project.build_cost && (
                  <div>
                    <strong>Build Cost:</strong> £{project.build_cost.toLocaleString()}
                  </div>
                )}
                {project.current_market_value && (
                  <div>
                    <strong>Current Market Value:</strong> £{project.current_market_value.toLocaleString()}
                  </div>
                )}
                {project.gross_development_value && (
                  <div>
                    <strong>GDV:</strong> £{project.gross_development_value.toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Borrower Information */}
        {Object.keys(borrower).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Borrower Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {borrower.company_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Company Name:</strong> {borrower.company_name}
                </div>
              )}
              {borrower.trading_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Trading Name:</strong> {borrower.trading_name}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lender Information */}
        {Object.keys(lender).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Lender Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {lender.organisation_name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Lender:</strong> {lender.organisation_name}
                </div>
              )}
              {lender.description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>About:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{lender.description}</p>
                </div>
              )}
              {lender.contact_email && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Contact Email:</strong> {lender.contact_email}
                </div>
              )}
              {lender.contact_phone && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Contact Phone:</strong> {lender.contact_phone}
                </div>
              )}
              {lender.website && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Website:</strong> <a href={lender.website} target="_blank" rel="noopener noreferrer">{lender.website}</a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Information */}
        {Object.keys(product).length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Product Information</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {product.name && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Product Name:</strong> {product.name}
                </div>
              )}
              {product.funding_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Funding Type:</strong> {product.funding_type_display}
                </div>
              )}
              {product.property_type_display && product.property_type_display !== 'N/A - Not Applicable' && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Property Type:</strong> {product.property_type_display}
                </div>
              )}
              {product.description && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Description:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{product.description}</p>
                </div>
              )}
              {(product.min_loan_amount || product.max_loan_amount) && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Loan Amount Range:</strong> 
                  {product.min_loan_amount && ` £${parseFloat(product.min_loan_amount).toLocaleString()}`}
                  {product.min_loan_amount && product.max_loan_amount && ' - '}
                  {product.max_loan_amount && ` £${parseFloat(product.max_loan_amount).toLocaleString()}`}
                </div>
              )}
              {(product.interest_rate_min || product.interest_rate_max) && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Interest Rate Range:</strong> 
                  {product.interest_rate_min && `${product.interest_rate_min}%`}
                  {product.interest_rate_min && product.interest_rate_max && ' - '}
                  {product.interest_rate_max && `${product.interest_rate_max}%`}
                </div>
              )}
              {(product.term_min_months || product.term_max_months) && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Term Range:</strong> 
                  {product.term_min_months && `${product.term_min_months} months`}
                  {product.term_min_months && product.term_max_months && ' - '}
                  {product.term_max_months && `${product.term_max_months} months`}
                </div>
              )}
              {product.max_ltv_ratio && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Maximum LTV:</strong> {product.max_ltv_ratio}%
                </div>
              )}
              {product.repayment_structure_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Repayment Structure:</strong> {product.repayment_structure_display}
                </div>
              )}
              {product.eligibility_criteria && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Eligibility Criteria:</strong>
                  <p style={{ margin: `${theme.spacing.xs} 0 0 0` }}>{product.eligibility_criteria}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Deal Commercial Terms */}
        {(Object.keys(commercialIndicators).length > 0 || Object.keys(applicationTerms).length > 0) && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Deal Commercial Terms</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {dealSummary.facility_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Facility Type:</strong> {dealSummary.facility_type_display}
                </div>
              )}
              {dealSummary.jurisdiction && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Jurisdiction:</strong> {dealSummary.jurisdiction}
                </div>
              )}
              <div style={{ 
                marginTop: theme.spacing.md, 
                padding: theme.spacing.md, 
                background: theme.colors.white, 
                borderRadius: theme.borderRadius.sm,
                border: `1px solid ${theme.colors.gray300}`
              }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                  Proposed Terms (for this deal)
                </h3>
                {applicationTerms.proposed_loan_amount_range && (
                  <div style={{ marginBottom: theme.spacing.xs }}>
                    <strong>Loan Amount Range:</strong> {applicationTerms.proposed_loan_amount_range}
                  </div>
                )}
                {applicationTerms.proposed_term_months && (
                  <div style={{ marginBottom: theme.spacing.xs }}>
                    <strong>Term:</strong> {applicationTerms.proposed_term_months} months
                  </div>
                )}
                {applicationTerms.proposed_ltv_range && (
                  <div style={{ marginBottom: theme.spacing.xs }}>
                    <strong>LTV Range:</strong> {applicationTerms.proposed_ltv_range}
                  </div>
                )}
                {applicationTerms.proposed_interest_rate_range && (
                  <div style={{ marginBottom: theme.spacing.xs }}>
                    <strong>Interest Rate Range:</strong> {applicationTerms.proposed_interest_rate_range}
                  </div>
                )}
              </div>
              {Object.keys(commercialIndicators).length > 0 && (
                <div style={{ 
                  marginTop: theme.spacing.md, 
                  padding: theme.spacing.md, 
                  background: theme.colors.white, 
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.gray300}`
                }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                    Commercial Indicators
                  </h3>
                  {commercialIndicators.loan_amount_range && (
                    <div style={{ marginBottom: theme.spacing.xs }}>
                      <strong>Loan Amount Range:</strong> {commercialIndicators.loan_amount_range}
                    </div>
                  )}
                  {commercialIndicators.term_months && (
                    <div style={{ marginBottom: theme.spacing.xs }}>
                      <strong>Term:</strong> {commercialIndicators.term_months} months
                    </div>
                  )}
                  {commercialIndicators.ltv_range && (
                    <div style={{ marginBottom: theme.spacing.xs }}>
                      <strong>LTV Range:</strong> {commercialIndicators.ltv_range}
                    </div>
                  )}
                  {commercialIndicators.interest_rate_range && (
                    <div style={{ marginBottom: theme.spacing.xs }}>
                      <strong>Interest Rate Range:</strong> {commercialIndicators.interest_rate_range}
                    </div>
                  )}
                  {commercialIndicators.repayment_structure && (
                    <div style={{ marginBottom: theme.spacing.xs }}>
                      <strong>Repayment Structure:</strong> {commercialIndicators.repayment_structure}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Security & Transaction Structure */}
        {(Object.keys(securityStructure).length > 0 || Object.keys(transactionStructure).length > 0) && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Security & Transaction Structure</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.gray50 }}>
              {securityStructure.primary_security && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Primary Security:</strong> {securityStructure.primary_security}
                </div>
              )}
              {securityStructure.security_type && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Security Type:</strong> {securityStructure.security_type}
                </div>
              )}
              {transactionStructure.borrower_entity_type_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Borrower Entity Type:</strong> {transactionStructure.borrower_entity_type_display}
                </div>
              )}
              {transactionStructure.deal_structure_display && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Deal Structure:</strong> {transactionStructure.deal_structure_display}
                </div>
              )}
              {transactionStructure.transaction_type && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Transaction Type:</strong> {transactionStructure.transaction_type}
                </div>
              )}
              {transactionStructure.jurisdiction && (
                <div style={{ marginBottom: theme.spacing.sm }}>
                  <strong>Jurisdiction:</strong> {transactionStructure.jurisdiction}
                </div>
              )}
              {transactionStructure.complexity_indicators && (
                <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.white, borderRadius: theme.borderRadius.sm }}>
                  <strong>Complexity Indicators:</strong>
                  <div style={{ marginTop: theme.spacing.xs }}>
                    {transactionStructure.complexity_indicators.has_intercreditor && (
                      <div style={{ marginBottom: theme.spacing.xs }}>
                        • Intercreditor arrangements may be required
                      </div>
                    )}
                    {transactionStructure.complexity_indicators.requires_planning_condition_satisfaction && (
                      <div style={{ marginBottom: theme.spacing.xs }}>
                        • Planning condition satisfaction required
                      </div>
                    )}
                    {transactionStructure.complexity_indicators.has_guarantees && (
                      <div style={{ marginBottom: theme.spacing.xs }}>
                        • Personal/company guarantees involved
                      </div>
                    )}
                    {transactionStructure.complexity_indicators.has_multiple_securities && (
                      <div style={{ marginBottom: theme.spacing.xs }}>
                        • Multiple security properties
                      </div>
                    )}
                  </div>
                </div>
              )}
              {transactionStructure.expected_completion_timeline && (
                <div style={{ marginTop: theme.spacing.sm }}>
                  <strong>Expected Completion Timeline:</strong> {transactionStructure.expected_completion_timeline} months
                </div>
              )}
            </div>
          </div>
        )}

        {/* Missing Deal Summary Warning */}
        {(!dealSummary || Object.keys(dealSummary).length === 0 || (!project || Object.keys(project).length === 0)) && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <div style={{
              padding: theme.spacing.md,
              background: theme.colors.warningLight,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.warning}`,
            }}>
              <p style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
                ⚠️ Limited Deal Information Available
              </p>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                This quote request was created before comprehensive deal information was available. 
                Please contact the lender for additional details needed to provide an accurate quotation.
              </p>
            </div>
          </div>
        )}

        {/* Lender Notes */}
        {enquiry.lender_notes && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Lender Notes</h2>
            <div style={{ ...commonStyles.card, background: theme.colors.infoLight }}>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{enquiry.lender_notes}</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );

  function getStatusColor(status) {
    const colors = {
      sent: theme.colors.info,
      received: theme.colors.success,
      acknowledged: theme.colors.success,
      preparing_quote: theme.colors.primary,
      queries_raised: theme.colors.warning,
      ready_to_submit: theme.colors.primary,
      quoted: theme.colors.success,
      declined: theme.colors.error,
      expired: theme.colors.error,
    };
    return colors[status] || theme.colors.gray500;
  }
}

export default ConsultantEnquiryDetail;
