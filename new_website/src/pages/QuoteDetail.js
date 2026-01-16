import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input from '../components/Input';
import Textarea from '../components/Textarea';
import { tokenStorage } from '../utils/tokenStorage';

function QuoteDetail() {
  const { quoteId, dealId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const role = tokenStorage.getRole() || '';
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';

  const [quote, setQuote] = useState(null);
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Messaging state
  const [messageThread, setMessageThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Request more info state
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState('');
  
  // Forward to borrower state
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardNotes, setForwardNotes] = useState('');

  useEffect(() => {
    loadQuote();
  }, [quoteId, dealId]);

  useEffect(() => {
    if (quote) {
      loadMessageThread();
    }
  }, [quote]);

  async function loadQuote() {
    try {
      const res = await api.get(`/api/deals/provider-quotes/${quoteId}/`);
      setQuote(res.data);
      
      // Load enquiry details
      if (res.data.enquiry) {
        try {
          const enquiryRes = await api.get(`/api/deals/provider-enquiries/${res.data.enquiry}/`);
          setEnquiry(enquiryRes.data);
        } catch (err) {
          console.error('Failed to load enquiry:', err);
        }
      }
    } catch (err) {
      setError('Failed to load quote details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessageThread() {
    if (!quote || !dealId) return;
    
    setLoadingMessages(true);
    try {
      // Determine thread type based on role
      let threadType = 'general';
      if (quote.role_type === 'valuer') threadType = 'valuation';
      else if (quote.role_type === 'monitoring_surveyor') threadType = 'ims';
      else if (quote.role_type === 'solicitor') threadType = 'legal';

      // Find or create thread
      const threadsRes = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}&thread_type=${threadType}`);
      const threads = threadsRes.data.results || threadsRes.data || [];
      
      let thread = threads.find(t => t.subject && t.subject.includes(quote.provider_firm_name));
      
      if (!thread && threads.length > 0) {
        thread = threads[0];
      } else if (!thread) {
        // Create new thread
        const newThreadRes = await api.post('/api/deals/deal-message-threads/', {
          deal: dealId,
          thread_type: threadType,
          subject: `Quote Discussion: ${quote.provider_firm_name} - ${quote.role_type_display}`,
        });
        thread = newThreadRes.data;
      }

      if (thread) {
        setMessageThread(thread);
        await loadMessages(thread.id);
      }
    } catch (err) {
      console.error('Failed to load message thread:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadMessages(threadId) {
    try {
      const res = await api.get(`/api/deals/deal-messages/?thread_id=${threadId}`);
      setMessages(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !messageThread) return;

    try {
      await api.post('/api/deals/deal-messages/', {
        thread: messageThread.id,
        message: newMessage.trim(),
      });
      setNewMessage('');
      await loadMessages(messageThread.id);
    } catch (err) {
      alert('Failed to send message: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleRequestMoreInfo() {
    if (!requestInfoText.trim()) {
      alert('Please enter your request for more information');
      return;
    }

    setActionLoading(true);
    try {
      // Send as a message to the consultant
      if (messageThread) {
        await api.post('/api/deals/deal-messages/', {
          thread: messageThread.id,
          message: `[Request for More Information]\n\n${requestInfoText.trim()}`,
        });
      }
      
      // Also update quote status to under_review if needed
      if (quote.status === 'submitted') {
        await api.post(`/api/deals/provider-quotes/${quoteId}/negotiate/`, {
          notes: `Request for more information: ${requestInfoText.trim()}`,
        });
        await loadQuote();
      }
      
      setShowRequestInfoModal(false);
      setRequestInfoText('');
      alert('Request for more information sent to consultant');
      await loadMessages(messageThread.id);
    } catch (err) {
      alert('Failed to send request: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleForwardToBorrower() {
    if (!forwardNotes.trim()) {
      alert('Please add notes for the borrower');
      return;
    }

    setActionLoading(true);
    try {
      // Create a notification or message to borrower about forwarded quotes
      // For now, we'll mark the quote as forwarded and notify via message thread
      // TODO: Implement proper forwarding mechanism
      
      // Create a general message thread with borrower if it doesn't exist
      const threadsRes = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}&thread_type=general`);
      const threads = threadsRes.data.results || threadsRes.data || [];
      let borrowerThread = threads[0];
      
      if (!borrowerThread && threads.length === 0) {
        borrowerThread = await api.post('/api/deals/deal-message-threads/', {
          deal: dealId,
          thread_type: 'general',
          subject: 'Quotes for Review',
        });
        borrowerThread = borrowerThread.data;
      }

      if (borrowerThread) {
        await api.post('/api/deals/deal-messages/', {
          thread: borrowerThread.id,
          message: `[Quotes Forwarded for Review]\n\nI have forwarded the following quote(s) for your review:\n\nProvider: ${quote.provider_firm_name}\nRole: ${quote.role_type_display}\nPrice: £${parseFloat(quote.price_gbp).toLocaleString()}\n\nNotes: ${forwardNotes.trim()}\n\nPlease review and select your preferred consultant.`,
        });
      }

      setShowForwardModal(false);
      setForwardNotes('');
      alert('Quote forwarded to borrower successfully');
    } catch (err) {
      alert('Failed to forward quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAcceptQuote() {
    if (!window.confirm('Are you sure you want to accept this quote? This will select the provider for this role.')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/api/deals/provider-quotes/${quoteId}/accept/`, {
        notes: '',
      });
      await loadQuote();
      alert('Quote accepted successfully');
    } catch (err) {
      alert('Failed to accept quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectQuote() {
    const reason = window.prompt('Please provide a reason for rejecting this quote:');
    if (!reason) return;

    setActionLoading(true);
    try {
      await api.post(`/api/deals/provider-quotes/${quoteId}/reject/`, {
        reason: reason,
      });
      await loadQuote();
      alert('Quote rejected successfully');
    } catch (err) {
      alert('Failed to reject quote: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNegotiateQuote() {
    const notes = window.prompt('What would you like to negotiate?');
    if (!notes) return;

    setActionLoading(true);
    try {
      await api.post(`/api/deals/provider-quotes/${quoteId}/negotiate/`, {
        notes: notes,
      });
      await loadQuote();
      alert('Negotiation request sent to consultant');
    } catch (err) {
      alert('Failed to request negotiation: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      submitted: 'info',
      under_review: 'warning',
      accepted: 'success',
      declined: 'error',
      withdrawn: 'error',
      expired: 'error',
    };
    return <Badge variant={statusColors[status] || 'info'}>{status?.replace('_', ' ').toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading quote details...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={commonStyles.card}>
          <h2>Quote Not Found</h2>
          <p>{error || 'The quote you\'re looking for doesn\'t exist.'}</p>
          <Button onClick={() => navigate(`/deals/${dealId}`)}>Back to Deal Room</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.lg }}>
        <Button variant="outline" onClick={() => navigate(`/deals/${dealId}`)}>
          ← Back to Deal Room
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
        {/* Quote Header */}
        <div style={commonStyles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.lg }}>
            <div>
              <h1 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>Quote Details</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                <Badge variant="info">{quote.role_type_display}</Badge>
                {getStatusBadge(quote.status)}
              </div>
            </div>
            {isLender && (quote.status === 'submitted' || quote.status === 'under_review') && (
              <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                <Button variant="success" onClick={handleAcceptQuote} disabled={actionLoading}>
                  Accept Quote
                </Button>
                <Button variant="warning" onClick={handleNegotiateQuote} disabled={actionLoading}>
                  Request Negotiation
                </Button>
                <Button variant="error" onClick={handleRejectQuote} disabled={actionLoading}>
                  Reject Quote
                </Button>
              </div>
            )}
          </div>

          {/* Quote Information Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
            <div>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                <strong>Provider:</strong> {quote.provider_firm_name}
              </p>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                <strong>Role:</strong> {quote.role_type_display}
              </p>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                <strong>Status:</strong> {quote.status_display}
              </p>
            </div>
            <div>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                <strong>Price:</strong> £{parseFloat(quote.price_gbp).toLocaleString()}
              </p>
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                <strong>Lead Time:</strong> {quote.lead_time_days} days
              </p>
              {quote.earliest_available_date && (
                <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  <strong>Available:</strong> {formatDate(quote.earliest_available_date)}
                </p>
              )}
              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                <strong>Submitted:</strong> {formatDate(quote.submitted_at)}
              </p>
            </div>
          </div>

          {/* Scope Summary */}
          {quote.scope_summary && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                Scope Summary
              </h3>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                {quote.scope_summary}
              </p>
            </div>
          )}

          {/* Assumptions */}
          {quote.assumptions && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                Assumptions & Exclusions
              </h3>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                {quote.assumptions}
              </p>
            </div>
          )}

          {/* Deliverables */}
          {quote.deliverables && Array.isArray(quote.deliverables) && quote.deliverables.length > 0 && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                Deliverables
              </h3>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                {quote.deliverables.map((deliverable, idx) => (
                  <li key={idx}>{deliverable}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Payment Terms */}
          {quote.payment_terms && (
            <div style={{ marginBottom: theme.spacing.lg }}>
              <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.lg }}>
                Payment Terms
              </h3>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                {quote.payment_terms}
              </p>
            </div>
          )}

          {/* Validity */}
          {quote.validity_days && (
            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
              <strong>Validity:</strong> {quote.validity_days} days
            </p>
          )}

          {/* Lender Notes */}
          {quote.lender_notes && (
            <div style={{ marginTop: theme.spacing.lg, padding: theme.spacing.md, background: theme.colors.infoLight, borderRadius: theme.borderRadius.sm }}>
              <h4 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                Your Notes:
              </h4>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                {quote.lender_notes}
              </p>
            </div>
          )}
        </div>

        {/* Actions for Lender */}
        {isLender && (
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Actions</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <Button
                variant="primary"
                onClick={() => setShowRequestInfoModal(true)}
                disabled={actionLoading}
              >
                Request More Information
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForwardModal(true)}
                disabled={actionLoading}
              >
                Forward to Borrower for Review
              </Button>
            </div>
          </div>
        )}

        {/* Messaging Section */}
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Correspondence</h2>
          {loadingMessages ? (
            <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading messages...</p>
          ) : messages.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxHeight: '500px', overflowY: 'auto', marginBottom: theme.spacing.md }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    padding: theme.spacing.md,
                    background: msg.is_own_message ? theme.colors.primaryLight : theme.colors.gray50,
                    borderRadius: theme.borderRadius.sm,
                    alignSelf: msg.is_own_message ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                  }}
                >
                  <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                    {msg.sender_name} - {formatDate(msg.created_at)}
                  </p>
                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.lg }}>
              No messages yet. Start a conversation with the consultant.
            </p>
          )}

          {messageThread && (
            <div style={{ display: 'flex', gap: theme.spacing.sm }}>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                style={{ flex: 1 }}
              />
              <Button
                variant="primary"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
              >
                Send
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Request More Information Modal */}
      {showRequestInfoModal && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '600px' }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Request More Information</h2>
            <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
              What additional information do you need from the consultant?
            </p>
            <Textarea
              value={requestInfoText}
              onChange={(e) => setRequestInfoText(e.target.value)}
              rows={5}
              placeholder="Please specify what information you need..."
              style={{ marginBottom: theme.spacing.lg }}
            />
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setShowRequestInfoModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRequestMoreInfo}
                disabled={actionLoading || !requestInfoText.trim()}
                loading={actionLoading}
              >
                Send Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Forward to Borrower Modal */}
      {showForwardModal && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '600px' }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Forward Quote to Borrower</h2>
            <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
              Add notes for the borrower about this quote:
            </p>
            <Textarea
              value={forwardNotes}
              onChange={(e) => setForwardNotes(e.target.value)}
              rows={5}
              placeholder="Add any notes or recommendations for the borrower..."
              style={{ marginBottom: theme.spacing.lg }}
            />
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => setShowForwardModal(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleForwardToBorrower}
                disabled={actionLoading || !forwardNotes.trim()}
                loading={actionLoading}
              >
                Forward Quote
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuoteDetail;
