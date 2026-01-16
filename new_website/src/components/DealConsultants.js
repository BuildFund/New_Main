import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import { tokenStorage } from '../utils/tokenStorage';
import Button from './Button';
import Badge from './Badge';
import Select from './Select';
import Textarea from './Textarea';
import Input from './Input';

function ConsultantsTab({ dealId, deal, onUpdate }) {
  const navigate = useNavigate();
  const role = tokenStorage.getRole();
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';
  const isConsultant = role === 'Consultant';
  
  const [parties, setParties] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState({ open: false, partyType: null });
  const [inviteForm, setInviteForm] = useState({ consultant_user_id: '', acting_for_party: 'lender', firm_name: '', sra_number: '', rics_number: '' });
  const [replaceModal, setReplaceModal] = useState({ open: false, solicitorId: null });
  const [replaceReason, setReplaceReason] = useState('');
  
  // Provider workflow state
  const [activeSubTab, setActiveSubTab] = useState('matching');
  const [matchingProviders, setMatchingProviders] = useState({ valuer: [], monitoring_surveyor: [], solicitor: [] });
  const [selectedRole, setSelectedRole] = useState('valuer');
  const [enquiries, setEnquiries] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [selections, setSelections] = useState([]);
  const [providerStages, setProviderStages] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [messageThreads, setMessageThreads] = useState([]);
  const [providerMetrics, setProviderMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [createThreadModal, setCreateThreadModal] = useState({ open: false });
  const [requestQuotesModal, setRequestQuotesModal] = useState({ open: false, roleType: null, selectedProviders: [] });
  const [uploadDeliverableModal, setUploadDeliverableModal] = useState({ open: false, deliverableType: null, roleType: null });
  const [reviewDeliverableModal, setReviewDeliverableModal] = useState({ open: false, deliverable: null });
  const [bookAppointmentModal, setBookAppointmentModal] = useState({ open: false, roleType: null, providerFirm: null });
  const [appointmentActionModal, setAppointmentActionModal] = useState({ open: false, appointment: null, action: null });
  const [loadingMatching, setLoadingMatching] = useState(false);
  const [selectProviderModal, setSelectProviderModal] = useState({ open: false, quote: null, useOwnSolicitor: false, lenderApprovalRequired: false });
  const [ownSolicitorForm, setOwnSolicitorForm] = useState({ firm_name: '', sra_number: '', contact_name: '', contact_email: '', contact_phone: '' });
  
  // Enquiry and Quote detail modals
  const [enquiryDetailModal, setEnquiryDetailModal] = useState({ open: false, enquiry: null });
  const [quoteDetailModal, setQuoteDetailModal] = useState({ open: false, quote: null });
  const [quoteActionModal, setQuoteActionModal] = useState({ open: false, quote: null, action: null, notes: '', counterPrice: '' });
  const [enquiryMessages, setEnquiryMessages] = useState([]);
  const [quoteMessages, setQuoteMessages] = useState([]);
  const [newEnquiryMessage, setNewEnquiryMessage] = useState('');
  const [newQuoteMessage, setNewQuoteMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Forward quotes to borrower
  const [selectedQuotesForForward, setSelectedQuotesForForward] = useState([]);
  const [forwardQuotesModal, setForwardQuotesModal] = useState({ open: false, notes: '' });

  useEffect(() => {
    loadParties();
    loadConsultants();
    loadEnquiries();
    loadQuotes();
    loadSelections();
    loadProviderStages();
    loadDeliverables();
    loadAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Load matching providers when role changes (lender only)
  useEffect(() => {
    if (isLender && activeSubTab === 'matching' && selectedRole) {
      loadMatchingProviders(selectedRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole, activeSubTab]);

  async function loadParties() {
    try {
      const res = await api.get(`/api/deals/deal-parties/?deal_id=${dealId}`);
      setParties(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to load parties:', err);
      setParties([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadConsultants() {
    try {
      const res = await api.get('/api/consultants/consultant-profiles/');
      setConsultants(res.data || []);
    } catch (err) {
      console.error('Failed to load consultants:', err);
      setConsultants([]);
    }
  }

  async function loadEnquiries() {
    try {
      const res = await api.get(`/api/deals/provider-enquiries/?deal_id=${dealId}`);
      setEnquiries(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      setEnquiries([]);
    }
  }

  async function loadQuotes() {
    try {
      const res = await api.get(`/api/deals/provider-quotes/?deal_id=${dealId}`);
      setQuotes(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to load quotes:', err);
      setQuotes([]);
    }
  }

  async function loadSelections() {
    try {
      const res = await api.get(`/api/deals/deal-provider-selections/?deal_id=${dealId}`);
      setSelections(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Failed to load selections:', err);
      setSelections([]);
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

  async function loadDeliverables() {
    try {
      const res = await api.get(`/api/deals/provider-deliverables/?deal_id=${dealId}`);
      setDeliverables(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load deliverables:', err);
      setDeliverables([]);
    }
  }

  async function loadAppointments() {
    try {
      const res = await api.get(`/api/deals/provider-appointments/?deal_id=${dealId}`);
      setAppointments(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load appointments:', err);
      setAppointments([]);
    }
  }

  async function loadMessageThreads() {
    try {
      const res = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}`);
      setMessageThreads(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load message threads:', err);
      setMessageThreads([]);
    }
  }

  async function loadThreadMessages(threadId) {
    try {
      const res = await api.get(`/api/deals/deal-messages/?thread_id=${threadId}`);
      const messages = res.data.results || res.data || [];
      setThreadMessages(messages);
      // Also set enquiry/quote messages if we're in those modals
      if (enquiryDetailModal.open) {
        setEnquiryMessages(messages);
      }
      if (quoteDetailModal.open) {
        setQuoteMessages(messages);
      }
    } catch (err) {
      console.error('Failed to load thread messages:', err);
      setThreadMessages([]);
      if (enquiryDetailModal.open) setEnquiryMessages([]);
      if (quoteDetailModal.open) setQuoteMessages([]);
    }
  }

  async function sendMessage(threadId) {
    if (!newMessageText.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      await api.post('/api/deals/deal-messages/', {
        thread: threadId,
        message: newMessageText,
      });
      setNewMessageText('');
      await loadThreadMessages(threadId);
      await loadMessageThreads(); // Refresh thread list to update last_message_at
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message: ' + (err.response?.data?.error || err.message));
    }
  }

  async function createThread(threadType, subject) {
    try {
      const res = await api.post('/api/deals/deal-message-threads/', {
        deal: dealId,
        thread_type: threadType,
        subject: subject,
      });
      await loadMessageThreads();
      setSelectedThread(res.data);
      setCreateThreadModal({ open: false });
    } catch (err) {
      console.error('Failed to create thread:', err);
      alert('Failed to create thread: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleRequestQuotes() {
    if (requestQuotesModal.selectedProviders.length === 0) {
      alert('Please select at least one provider');
      return;
    }
    
    try {
      const providerIds = requestQuotesModal.selectedProviders.map(p => p.provider.id);
      await api.post('/api/deals/provider-enquiries/request-quotes/', {
        deal_id: dealId,
        role_type: requestQuotesModal.roleType,
        provider_ids: providerIds,
        limit: providerIds.length || 5,
        quote_due_days: 7,
      });
      await loadEnquiries();
      setRequestQuotesModal({ open: false, roleType: null, selectedProviders: [] });
      alert(`Quote requests sent to ${providerIds.length} provider(s)`);
    } catch (err) {
      alert('Failed to request quotes: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleSelectProvider() {
    const { quote, useOwnSolicitor, lenderApprovalRequired } = selectProviderModal;
    
    if (!quote) {
      alert('No quote selected');
      return;
    }

    // For solicitor role with "use own solicitor", we need to create a custom provider
    if (quote.role_type === 'solicitor' && useOwnSolicitor) {
      if (!ownSolicitorForm.firm_name || !ownSolicitorForm.sra_number) {
        alert('Please provide firm name and SRA number for your solicitor');
        return;
      }
      // TODO: Create a custom ConsultantProfile or handle differently
      // For now, we'll still use the quote's provider but note it's borrower's own
      alert('Using own solicitor feature - backend integration needed');
      return;
    }

    try {
      // Get provider_firm ID from the quote's enquiry
      let providerFirmId = null;
      
      if (quote.enquiry) {
        // Fetch enquiry to get provider_firm
        try {
          const enquiryRes = await api.get(`/api/deals/provider-enquiries/${quote.enquiry}/`);
          providerFirmId = enquiryRes.data.provider_firm;
        } catch (enqErr) {
          console.error('Failed to fetch enquiry:', enqErr);
          // Try using enquiry_id directly if it's the ID
          if (quote.enquiry_id) {
            const enquiryRes = await api.get(`/api/deals/provider-enquiries/${quote.enquiry_id}/`);
            providerFirmId = enquiryRes.data.provider_firm;
          } else {
            alert('Failed to get provider information. Please try again.');
            return;
          }
        }
      } else if (quote.enquiry_id) {
        // Fallback: fetch enquiry by ID
        try {
          const enquiryRes = await api.get(`/api/deals/provider-enquiries/${quote.enquiry_id}/`);
          providerFirmId = enquiryRes.data.provider_firm;
        } catch (enqErr) {
          console.error('Failed to fetch enquiry:', enqErr);
          alert('Failed to get provider information. Please try again.');
          return;
        }
      } else {
        alert('Unable to determine provider. Please contact support.');
        return;
      }
      
      if (!providerFirmId) {
        alert('Provider information not found. Please contact support.');
        return;
      }
      
      await api.post('/api/deals/deal-provider-selections/', {
        deal: dealId,
        role_type: quote.role_type,
        provider_firm: providerFirmId,
        quote: quote.id,
        acting_for_party: 'borrower',
        lender_approval_required: lenderApprovalRequired,
      });
      
      await loadSelections();
      await loadQuotes(); // Refresh to show updated statuses
      setSelectProviderModal({ open: false, quote: null, useOwnSolicitor: false, lenderApprovalRequired: false });
      setOwnSolicitorForm({ firm_name: '', sra_number: '', contact_name: '', contact_email: '', contact_phone: '' });
      alert('Provider selected successfully' + (lenderApprovalRequired ? '. Awaiting lender approval.' : ''));
    } catch (err) {
      console.error('Selection error:', err);
      alert('Failed to select provider: ' + (err.response?.data?.error || err.message));
    }
  }

  async function loadMatchingProviders(roleType) {
    setLoadingMatching(true);
    try {
      const res = await api.get(`/api/deals/provider-enquiries/matching-providers/?deal_id=${dealId}&role_type=${roleType}&limit=20`);
      setMatchingProviders(prev => ({
        ...prev,
        [roleType]: res.data.matching_providers || []
      }));
    } catch (err) {
      console.error('Failed to load matching providers:', err);
      setMatchingProviders(prev => ({
        ...prev,
        [roleType]: []
      }));
    } finally {
      setLoadingMatching(false);
    }
  }

  async function loadProviderMetrics() {
    setLoadingMetrics(true);
    try {
      const res = await api.get(`/api/deals/provider-metrics/deal/${dealId}/`);
      setProviderMetrics(res.data);
    } catch (err) {
      console.error('Failed to load provider metrics:', err);
      setProviderMetrics(null);
    } finally {
      setLoadingMetrics(false);
    }
  }

  async function loadEnquiryMessages(enquiryId) {
    setLoadingMessages(true);
    try {
      const enquiry = enquiryDetailModal.enquiry;
      if (!enquiry) return;

      // Determine thread type based on role
      let threadType = 'general';
      if (enquiry.role_type === 'valuer') threadType = 'valuation';
      else if (enquiry.role_type === 'monitoring_surveyor') threadType = 'ims';
      else if (enquiry.role_type === 'solicitor') threadType = 'legal';

      // Try to find existing thread
      const threadsRes = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}&thread_type=${threadType}`);
      const threads = threadsRes.data.results || threadsRes.data || [];
      
      // Find or create thread for this enquiry
      let thread = threads.find(t => t.subject && t.subject.includes(enquiry.provider_firm_name));
      
      if (!thread && threads.length > 0) {
        // Use first thread of this type if exists
        thread = threads[0];
      } else if (!thread) {
        // Create new thread for this enquiry
        try {
          const newThreadRes = await api.post('/api/deals/deal-message-threads/', {
            deal: dealId,
            thread_type: threadType,
            subject: `Quote Request: ${enquiry.provider_firm_name} - ${enquiry.role_type_display}`,
          });
          thread = newThreadRes.data;
        } catch (createErr) {
          console.error('Failed to create thread:', createErr);
        }
      }

      if (thread) {
        await loadThreadMessages(thread.id);
        setSelectedThread(thread);
      } else {
        setEnquiryMessages([]);
      }
    } catch (err) {
      console.error('Failed to load enquiry messages:', err);
      setEnquiryMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function loadQuoteMessages(quoteId) {
    setLoadingMessages(true);
    try {
      const quote = quoteDetailModal.quote;
      if (!quote) return;

      // Determine thread type based on role
      let threadType = 'general';
      if (quote.role_type === 'valuer') threadType = 'valuation';
      else if (quote.role_type === 'monitoring_surveyor') threadType = 'ims';
      else if (quote.role_type === 'solicitor') threadType = 'legal';

      // Try to find existing thread
      const threadsRes = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}&thread_type=${threadType}`);
      const threads = threadsRes.data.results || threadsRes.data || [];
      
      // Find or create thread for this quote
      let thread = threads.find(t => t.subject && t.subject.includes(quote.provider_firm_name));
      
      if (!thread && threads.length > 0) {
        thread = threads[0];
      } else if (!thread) {
        // Create new thread for this quote
        try {
          const newThreadRes = await api.post('/api/deals/deal-message-threads/', {
            deal: dealId,
            thread_type: threadType,
            subject: `Quote Discussion: ${quote.provider_firm_name} - ${quote.role_type_display}`,
          });
          thread = newThreadRes.data;
        } catch (createErr) {
          console.error('Failed to create thread:', createErr);
        }
      }

      if (thread) {
        await loadThreadMessages(thread.id);
        setSelectedThread(thread);
      } else {
        setQuoteMessages([]);
      }
    } catch (err) {
      console.error('Failed to load quote messages:', err);
      setQuoteMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleQuoteAction() {
    const { quote, action, notes, counterPrice } = quoteActionModal;
    if (!quote) return;

    try {
      let endpoint = '';
      let payload = {};

      if (action === 'accept') {
        endpoint = `/api/deals/provider-quotes/${quote.id}/accept/`;
        payload = { notes };
      } else if (action === 'reject') {
        endpoint = `/api/deals/provider-quotes/${quote.id}/reject/`;
        payload = { reason: notes };
      } else if (action === 'negotiate') {
        endpoint = `/api/deals/provider-quotes/${quote.id}/negotiate/`;
        payload = { notes, counter_price: counterPrice || null };
      }

      await api.post(endpoint, payload);
      await loadQuotes();
      await loadSelections();
      setQuoteActionModal({ open: false, quote: null, action: null, notes: '', counterPrice: '' });
      alert(`Quote ${action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'negotiation requested'} successfully`);
      if (onUpdate) onUpdate();
    } catch (err) {
      alert('Failed to ' + action + ' quote: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleInviteConsultant() {
    try {
      await api.post('/api/deals/deal-parties/invite_consultant/', {
        deal_id: dealId,
        consultant_user_id: inviteForm.consultant_user_id,
        party_type: inviteModal.partyType,
        acting_for_party: inviteForm.acting_for_party,
      });
      await loadParties();
      setInviteModal({ open: false, partyType: null });
      setInviteForm({ consultant_user_id: '', acting_for_party: 'lender', firm_name: '', sra_number: '', rics_number: '' });
      alert('Consultant invited successfully');
    } catch (err) {
      alert('Failed to invite consultant: ' + (err.response?.data?.error || err.message));
    }
  }

  async function handleReplaceSolicitor() {
    if (!replaceReason.trim()) {
      alert('Please provide a reason for replacing the solicitor');
      return;
    }

    try {
      await api.post(`/api/deals/deal-parties/${replaceModal.solicitorId}/replace_solicitor/`, {
        reason: replaceReason,
      });
      await loadParties();
      setReplaceModal({ open: false, solicitorId: null });
      setReplaceReason('');
      alert('Solicitor replaced successfully');
    } catch (err) {
      alert('Failed to replace solicitor: ' + (err.response?.data?.error || err.message));
    }
  }

  const consultantParties = parties.filter(p => ['valuer', 'monitoring_surveyor', 'solicitor'].includes(p.party_type));
  const lenderSolicitor = consultantParties.find(p => p.party_type === 'solicitor' && p.acting_for_party === 'lender' && p.is_active_lender_solicitor);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      invited: { variant: 'info', label: 'Invited' },
      pending_confirmation: { variant: 'warning', label: 'Pending Confirmation' },
      confirmed: { variant: 'success', label: 'Confirmed' },
      active: { variant: 'success', label: 'Active' },
      removed: { variant: 'error', label: 'Removed' },
      sent: { variant: 'info', label: 'Sent' },
      viewed: { variant: 'warning', label: 'Viewed' },
      quoted: { variant: 'success', label: 'Quoted' },
      declined: { variant: 'error', label: 'Declined' },
      expired: { variant: 'error', label: 'Expired' },
      submitted: { variant: 'info', label: 'Submitted' },
      under_review: { variant: 'warning', label: 'Under Review' },
      accepted: { variant: 'success', label: 'Accepted' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  // Lender sub-tabs
  const lenderSubTabs = isLender ? [
    { id: 'matching', label: 'Matching' },
    { id: 'enquiries', label: `Enquiries (${enquiries.length})` },
    { id: 'quotes', label: `Quotes (${quotes.length})` },
    { id: 'selection', label: `Selection (${selections.length})` },
    { id: 'progress', label: 'Progress' },
    { id: 'deliverables', label: 'Deliverables' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'messages', label: 'Messages' },
    { id: 'reporting', label: 'Reporting' },
  ] : [];

  // Borrower sub-tabs
  const borrowerSubTabs = isBorrower ? [
    { id: 'quotes', label: `Quotes (${quotes.length})` },
    { id: 'selection', label: `Selection (${selections.length})` },
    { id: 'appointments', label: `Appointments (${appointments.length})` },
    { id: 'deliverables', label: 'Deliverables' },
    { id: 'messages', label: 'Messages' },
  ] : [];

  // Consultant sub-tabs
  const consultantSubTabs = isConsultant ? [
    { id: 'deliverables', label: `Deliverables (${deliverables.length})` },
    { id: 'appointments', label: `Appointments (${appointments.length})` },
    { id: 'messages', label: 'Messages' },
  ] : [];

  const subTabs = isLender ? lenderSubTabs : isBorrower ? borrowerSubTabs : isConsultant ? consultantSubTabs : [];

  if (loading) {
    return (
      <div style={commonStyles.card}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading consultants...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs for Lender/Borrower */}
      {subTabs.length > 0 && (
        <div style={{
          display: 'flex',
          gap: theme.spacing.sm,
          borderBottom: `2px solid ${theme.colors.gray200}`,
          marginBottom: theme.spacing.lg,
        }}>
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                padding: theme.spacing.md,
                background: 'transparent',
                border: 'none',
                borderBottom: activeSubTab === tab.id ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
                color: activeSubTab === tab.id ? theme.colors.primary : theme.colors.textSecondary,
                cursor: 'pointer',
                fontWeight: activeSubTab === tab.id ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* MATCHING TAB (Lender only) */}
      {isLender && activeSubTab === 'matching' && (
        <div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Provider Matching</h2>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{ width: '200px' }}
              >
                <option value="valuer">Valuer</option>
                <option value="monitoring_surveyor">Monitoring Surveyor</option>
                <option value="solicitor">Solicitor</option>
              </Select>
            </div>

            {loadingMatching ? (
              <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading matching providers...</p>
            ) : (
              <div>
                {selectedRole === 'solicitor' && matchingProviders[selectedRole]?.borrower_has_solicitor ? (
                  <div style={{
                    padding: theme.spacing.lg,
                    border: `1px solid ${theme.colors.success}`,
                    borderRadius: theme.borderRadius.md,
                    background: theme.colors.successLight,
                    marginBottom: theme.spacing.md,
                  }}>
                    <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>
                      Borrower Has Preferred Solicitor
                    </h3>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                      <strong>Firm:</strong> {matchingProviders[selectedRole]?.solicitor_info?.firm_name || 'N/A'}
                    </p>
                    {matchingProviders[selectedRole]?.solicitor_info?.contact_email && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                        <strong>Email:</strong> {matchingProviders[selectedRole].solicitor_info.contact_email}
                      </p>
                    )}
                    {matchingProviders[selectedRole]?.solicitor_info?.contact_name && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                        <strong>Contact:</strong> {matchingProviders[selectedRole].solicitor_info.contact_name}
                      </p>
                    )}
                    <p style={{ margin: `${theme.spacing.sm} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {matchingProviders[selectedRole]?.message || 'The borrower\'s preferred solicitor has been invited to this deal.'}
                    </p>
                  </div>
                ) : Array.isArray(matchingProviders[selectedRole]) && matchingProviders[selectedRole].length === 0 ? (
                  <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                    No matching providers found for {selectedRole === 'valuer' ? 'Valuer' : selectedRole === 'monitoring_surveyor' ? 'Monitoring Surveyor' : 'Solicitor'}.
                  </p>
                ) : Array.isArray(matchingProviders[selectedRole]) && matchingProviders[selectedRole].length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                    {matchingProviders[selectedRole].map((match, idx) => (
                      <div
                        key={match.provider.id}
                        style={{
                          padding: theme.spacing.lg,
                          border: `1px solid ${theme.colors.gray300}`,
                          borderRadius: theme.borderRadius.md,
                          background: theme.colors.white,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                              <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                                {match.provider.organisation_name}
                              </h3>
                              <Badge variant="success">Match: {Math.round(match.match_score)}%</Badge>
                            </div>
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              {match.provider.contact_email} | {match.provider.contact_phone || 'N/A'}
                            </p>
                            {match.provider.geographic_coverage && match.provider.geographic_coverage.length > 0 && (
                              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Coverage: {match.provider.geographic_coverage.join(', ')}
                              </p>
                            )}
                            {match.provider.years_of_experience && (
                              <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Experience: {match.provider.years_of_experience} years
                              </p>
                            )}
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Capacity: {match.provider.current_capacity} / {match.provider.max_capacity}
                            </p>
                          </div>
                          <div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRequestQuotesModal({
                                  open: true,
                                  roleType: selectedRole,
                                  selectedProviders: [match],
                                });
                              }}
                            >
                              Request Quote
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ENQUIRIES TAB (Lender only) */}
      {isLender && activeSubTab === 'enquiries' && (
        <div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Quote Requests (Enquiries)</h2>
            </div>

            {enquiries.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No quote requests sent yet. Use the Matching tab to find and request quotes from providers.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {enquiries.map((enquiry) => (
                  <div
                    key={enquiry.id}
                    style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                            {enquiry.provider_firm_name}
                          </h3>
                          <Badge variant="info">{enquiry.role_type_display}</Badge>
                          {getStatusBadge(enquiry.status)}
                        </div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Sent: {formatDate(enquiry.sent_at)}
                          {enquiry.viewed_at && ` | Viewed: ${formatDate(enquiry.viewed_at)}`}
                          {enquiry.quote_due_at && ` | Due: ${formatDate(enquiry.quote_due_at)}`}
                        </p>
                        {enquiry.acknowledged_at && (
                          <div style={{
                            marginTop: theme.spacing.sm,
                            padding: theme.spacing.sm,
                            background: theme.colors.successLight,
                            borderRadius: theme.borderRadius.sm,
                            border: `1px solid ${theme.colors.success}`,
                          }}>
                            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.successDark }}>
                              ✓ Acknowledged: {formatDate(enquiry.acknowledged_at)}
                            </p>
                            {enquiry.expected_quote_date && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.successDark }}>
                                Expected Quote: {formatDate(enquiry.expected_quote_date)}
                              </p>
                            )}
                            {enquiry.acknowledgment_notes && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                                {enquiry.acknowledgment_notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QUOTES TAB */}
      {(isLender || isBorrower) && activeSubTab === 'quotes' && (() => {
        // Group quotes by role for borrower
        const quotesByRole = isBorrower ? quotes.reduce((acc, quote) => {
          const role = quote.role_type;
          if (!acc[role]) acc[role] = [];
          acc[role].push(quote);
          return acc;
        }, {}) : null;

        // Check if a role already has a selection
        const hasSelectionForRole = (roleType) => {
          return selections.some(s => s.role_type === roleType);
        };

        if (quotes.length === 0) {
          return (
            <div>
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quotes</h2>
                <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                  No quotes received yet.
                </p>
              </div>
            </div>
          );
        }

        if (isBorrower) {
          return (
            <div>
              <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quotes</h2>
                {/* Borrower view: grouped by role */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
                  {Object.entries(quotesByRole).map(([roleType, roleQuotes]) => {
                    const roleDisplay = roleQuotes[0]?.role_type_display || roleType;
                    const alreadySelected = hasSelectionForRole(roleType);
                    
                    return (
                      <div key={roleType} style={{ marginBottom: theme.spacing.lg }}>
                        <h3 style={{ margin: `0 0 ${theme.spacing.md} 0`, fontSize: theme.typography.fontSize.xl }}>
                          {roleDisplay}
                          {alreadySelected && (
                            <Badge variant="success" style={{ marginLeft: theme.spacing.sm }}>Selected</Badge>
                          )}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                          {roleQuotes.map((quote) => {
                            const isSelected = selections.some(s => s.quote === quote.id);
                            
                            return (
                              <div
                                key={quote.id}
                                style={{
                                  padding: theme.spacing.lg,
                                  border: `1px solid ${isSelected ? theme.colors.success : theme.colors.gray300}`,
                                  borderRadius: theme.borderRadius.md,
                                  background: isSelected ? theme.colors.successLight : theme.colors.white,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                                      <h4 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                                        {quote.provider_firm_name}
                                      </h4>
                                      {getStatusBadge(quote.status)}
                                      {isSelected && <Badge variant="success">Selected</Badge>}
                                    </div>
                                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                                      £{parseFloat(quote.price_gbp).toLocaleString()}
                                    </p>
                                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                      Lead time: {quote.lead_time_days} days
                                      {quote.earliest_available_date && ` | Available: ${formatDate(quote.earliest_available_date)}`}
                                    </p>
                                    {quote.scope_summary && (
                                      <p style={{ margin: `${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm }}>
                                        {quote.scope_summary}
                                      </p>
                                    )}
                                    {quote.assumptions && (
                                      <p style={{ margin: `${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                        <strong>Assumptions:</strong> {quote.assumptions}
                                      </p>
                                    )}
                                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                      Submitted: {formatDate(quote.submitted_at)}
                                    </p>
                                    {/* Show acknowledgment info if available */}
                                    {quote.enquiry_acknowledged_at && (
                                      <div style={{
                                        marginTop: theme.spacing.sm,
                                        padding: theme.spacing.xs,
                                        background: theme.colors.successLight,
                                        borderRadius: theme.borderRadius.sm,
                                        fontSize: theme.typography.fontSize.sm,
                                      }}>
                                        <span style={{ color: theme.colors.successDark }}>
                                          ✓ Acknowledged {formatDate(quote.enquiry_acknowledged_at)}
                                          {quote.enquiry_expected_quote_date && ` | Expected: ${formatDate(quote.enquiry_expected_quote_date)}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  {isBorrower && !alreadySelected && quote.status === 'submitted' && (
                                    <div>
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setSelectProviderModal({ 
                                          open: true, 
                                          quote, 
                                          useOwnSolicitor: false,
                                          lenderApprovalRequired: false 
                                        })}
                                      >
                                        Select
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        // Lender view: flat list
        return (
          <div>
            {/* Sticky Forward Banner - appears when quotes are selected */}
            {isLender && selectedQuotesForForward.length > 0 && (
              <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                padding: theme.spacing.lg,
                background: theme.colors.primary,
                color: theme.colors.white,
                borderRadius: theme.borderRadius.md,
                marginBottom: theme.spacing.lg,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: theme.spacing.md,
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.xs} 0`, color: theme.colors.white, fontSize: theme.typography.fontSize.lg }}>
                    {selectedQuotesForForward.length} Quote{selectedQuotesForForward.length > 1 ? 's' : ''} Selected
                  </h3>
                  <p style={{ margin: 0, color: theme.colors.white, opacity: 0.9, fontSize: theme.typography.fontSize.sm }}>
                    Ready to forward to borrower for review
                  </p>
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedQuotesForForward([])}
                    style={{
                      background: theme.colors.white,
                      color: theme.colors.primary,
                      borderColor: theme.colors.white,
                    }}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => setForwardQuotesModal({ open: true, notes: '' })}
                    style={{
                      background: theme.colors.success,
                      color: theme.colors.white,
                      borderColor: theme.colors.success,
                      fontWeight: theme.typography.fontWeight.semibold,
                    }}
                  >
                    Forward to Borrower →
                  </Button>
                </div>
              </div>
            )}

            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quotes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {quotes.map((quote) => (
                  <div
                    key={quote.id}
                    style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${selectedQuotesForForward.includes(quote.id) ? theme.colors.primary : theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: selectedQuotesForForward.includes(quote.id) ? theme.colors.primaryLight : theme.colors.white,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'start', gap: theme.spacing.sm }}>
                        <input
                          type="checkbox"
                          checked={selectedQuotesForForward.includes(quote.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedQuotesForForward([...selectedQuotesForForward, quote.id]);
                            } else {
                              setSelectedQuotesForForward(selectedQuotesForForward.filter(id => id !== quote.id));
                            }
                          }}
                          style={{ marginTop: theme.spacing.xs }}
                        />
                        <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                            {quote.provider_firm_name}
                          </h3>
                          <Badge variant="info">{quote.role_type_display}</Badge>
                          {getStatusBadge(quote.status)}
                        </div>
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                          £{parseFloat(quote.price_gbp).toLocaleString()}
                        </p>
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Lead time: {quote.lead_time_days} days
                          {quote.earliest_available_date && ` | Available: ${formatDate(quote.earliest_available_date)}`}
                        </p>
                        {quote.scope_summary && (
                          <p style={{ margin: `${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm }}>
                            {quote.scope_summary.substring(0, 150)}{quote.scope_summary.length > 150 ? '...' : ''}
                          </p>
                        )}
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Submitted: {formatDate(quote.submitted_at)}
                        </p>
                        {/* Show acknowledgment info if available */}
                        {quote.enquiry_acknowledged_at && (
                          <div style={{
                            marginTop: theme.spacing.sm,
                            padding: theme.spacing.xs,
                            background: theme.colors.successLight,
                            borderRadius: theme.borderRadius.sm,
                            fontSize: theme.typography.fontSize.sm,
                          }}>
                            <span style={{ color: theme.colors.successDark }}>
                              ✓ Provider acknowledged {formatDate(quote.enquiry_acknowledged_at)}
                              {quote.enquiry_expected_quote_date && ` | Expected: ${formatDate(quote.enquiry_expected_quote_date)}`}
                            </span>
                          </div>
                        )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            navigate(`/deals/${dealId}/quotes/${quote.id}`);
                          }}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* SELECTION TAB */}
      {(isLender || isBorrower) && activeSubTab === 'selection' && (
        <div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Provider Selection</h2>

            {selections.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No providers selected yet. {isBorrower && 'Go to the Quotes tab to select providers.'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {selections.map((selection) => (
                  <div
                    key={selection.id}
                    style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                      <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                        {selection.provider_firm_name}
                      </h3>
                      <Badge variant="success">{selection.role_type_display}</Badge>
                      {selection.lender_approval_required && !selection.lender_approved_at && (
                        <Badge variant="warning">Pending Lender Approval</Badge>
                      )}
                      {selection.lender_approved_at && (
                        <Badge variant="success">Lender Approved</Badge>
                      )}
                    </div>
                    {selection.quote_amount && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                        £{parseFloat(selection.quote_amount).toLocaleString()}
                      </p>
                    )}
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      Selected: {formatDate(selection.selected_at)}
                      {selection.selected_by_name && ` by ${selection.selected_by_name}`}
                    </p>
                    {selection.acting_for_party && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        Acting for: {selection.acting_for_party === 'lender' ? 'Lender' : 'Borrower'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROGRESS TAB - Provider Stages and Tasks */}
      {isLender && activeSubTab === 'progress' && (
        <div>
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Provider Progress</h2>
            {providerStages.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No providers have been selected yet. Select providers in the Selection tab to track their progress.
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
                          <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Provider: {stage.provider_firm_name || stage.provider_firm}
                          </p>
                          {stage.stage_entered_at && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Stage entered: {formatDate(stage.stage_entered_at)}
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
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await api.post(`/api/deals/provider-stages/${stage.id}/advance_stage/`);
                                await loadProviderStages();
                                await loadParties(); // Refresh to update tasks
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
                            Tasks
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
                                      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
                                        {task.due_date && (
                                          <span style={{ fontSize: theme.typography.fontSize.sm, color: isOverdue ? theme.colors.error : theme.colors.textSecondary }}>
                                            Due: {formatDate(task.due_date)}
                                          </span>
                                        )}
                                        {task.stage && (
                                          <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                            Stage: {task.stage.name || task.stage}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {task.status !== 'completed' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          try {
                                            await api.post(`/api/deals/deal-tasks/${task.id}/complete/`);
                                            await loadProviderStages();
                                            await loadParties();
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

      {(isLender || isBorrower || isConsultant) && activeSubTab === 'deliverables' && (
        <div>
          <div style={commonStyles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Deliverables</h2>
              {isConsultant && (
                <Button
                  variant="primary"
                  onClick={() => {
                    // Get provider's role from selections
                    const providerSelection = selections.find(s => s.provider_firm === consultants.find(c => c.user === localStorage.getItem('userId'))?.id);
                    if (providerSelection) {
                      setUploadDeliverableModal({ open: true, roleType: providerSelection.role_type, deliverableType: null });
                    } else {
                      alert('You must be selected as a provider for this deal to upload deliverables');
                    }
                  }}
                >
                  Upload Deliverable
                </Button>
              )}
            </div>
            
            {deliverables.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No deliverables uploaded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
                {deliverables.map(deliverable => {
                  const statusColors = {
                    uploaded: theme.colors.info,
                    under_review: theme.colors.warning,
                    approved: theme.colors.success,
                    rejected: theme.colors.error,
                    revised: theme.colors.gray500,
                  };
                  
                  return (
                    <div key={deliverable.id} style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.md }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                            <h3 style={{ margin: 0 }}>{deliverable.deliverable_type_display}</h3>
                            <Badge color={statusColors[deliverable.status] || theme.colors.gray500}>
                              {deliverable.status_display}
                            </Badge>
                            <Badge color={theme.colors.primary}>v{deliverable.version}</Badge>
                            {deliverable.has_revisions && (
                              <Badge color={theme.colors.info}>{deliverable.revision_count} revision(s)</Badge>
                            )}
                          </div>
                          <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Provider: {deliverable.provider_firm_name} ({deliverable.role_type_display})
                          </p>
                          {deliverable.document_name && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Document: {deliverable.document_name} ({(deliverable.document_size / 1024).toFixed(2)} KB)
                            </p>
                          )}
                          <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Uploaded: {formatDate(deliverable.uploaded_at)} by {deliverable.uploaded_by_name}
                          </p>
                          {deliverable.reviewed_at && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Reviewed: {formatDate(deliverable.reviewed_at)} by {deliverable.reviewed_by_name}
                            </p>
                          )}
                          {deliverable.review_notes && (
                            <div style={{
                              marginTop: theme.spacing.sm,
                              padding: theme.spacing.md,
                              background: theme.colors.gray100,
                              borderRadius: theme.borderRadius.sm,
                            }}>
                              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                                Review Notes:
                              </p>
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>
                                {deliverable.review_notes}
                              </p>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                          {deliverable.document_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(deliverable.document_url, '_blank')}
                            >
                              Download
                            </Button>
                          )}
                          {isLender && deliverable.status === 'uploaded' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setReviewDeliverableModal({ open: true, deliverable })}
                            >
                              Review
                            </Button>
                          )}
                          {isConsultant && (deliverable.status === 'rejected' || deliverable.status === 'under_review') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setUploadDeliverableModal({ 
                                open: true, 
                                roleType: deliverable.role_type, 
                                deliverableType: deliverable.deliverable_type 
                              })}
                            >
                              Upload Revision
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Upload Deliverable Modal */}
          {uploadDeliverableModal.open && (
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
                padding: theme.spacing.xl,
                borderRadius: theme.borderRadius.md,
                maxWidth: 600,
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Upload Deliverable</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const file = formData.get('file');
                  
                  if (!file) {
                    alert('Please select a file');
                    return;
                  }
                  
                  try {
                    const uploadData = new FormData();
                    uploadData.append('file', file);
                    uploadData.append('deal', dealId);
                    uploadData.append('role_type', uploadDeliverableModal.roleType);
                    uploadData.append('deliverable_type', formData.get('deliverable_type'));
                    
                    await api.post('/api/deals/provider-deliverables/', uploadData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    
                    await loadDeliverables();
                    setUploadDeliverableModal({ open: false, deliverableType: null, roleType: null });
                    alert('Deliverable uploaded successfully');
                  } catch (err) {
                    console.error('Failed to upload deliverable:', err);
                    alert('Failed to upload deliverable: ' + (err.response?.data?.error || err.message));
                  }
                }}>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Deliverable Type
                    </label>
                    <Select
                      name="deliverable_type"
                      required
                      defaultValue={uploadDeliverableModal.deliverableType || ''}
                      options={[
                        { value: 'valuation_report', label: 'Valuation Report' },
                        { value: 'reliance_letter', label: 'Reliance Letter' },
                        { value: 'ims_initial_report', label: 'IMS Initial Report' },
                        { value: 'monitoring_report', label: 'Monitoring Report' },
                        { value: 'drawdown_certificate', label: 'Drawdown Certificate' },
                        { value: 'legal_doc_pack', label: 'Legal Document Pack' },
                        { value: 'cp_evidence', label: 'CP Evidence' },
                        { value: 'completion_statement', label: 'Completion Statement' },
                      ]}
                    />
                  </div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      File
                    </label>
                    <input type="file" name="file" required style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setUploadDeliverableModal({ open: false, deliverableType: null, roleType: null })}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      Upload
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          
          {/* Review Deliverable Modal */}
          {reviewDeliverableModal.open && reviewDeliverableModal.deliverable && (
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
                padding: theme.spacing.xl,
                borderRadius: theme.borderRadius.md,
                maxWidth: 600,
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Review Deliverable</h2>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  {reviewDeliverableModal.deliverable.deliverable_type_display} v{reviewDeliverableModal.deliverable.version}
                </p>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const action = formData.get('action');
                  const reviewNotes = formData.get('review_notes');
                  
                  try {
                    await api.post(`/api/deals/provider-deliverables/${reviewDeliverableModal.deliverable.id}/review/`, {
                      action,
                      review_notes: reviewNotes,
                    });
                    
                    await loadDeliverables();
                    setReviewDeliverableModal({ open: false, deliverable: null });
                    alert('Review submitted successfully');
                  } catch (err) {
                    console.error('Failed to review deliverable:', err);
                    alert('Failed to submit review: ' + (err.response?.data?.error || err.message));
                  }
                }}>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Action
                    </label>
                    <Select
                      name="action"
                      required
                      options={[
                        { value: 'approve', label: 'Approve' },
                        { value: 'reject', label: 'Reject' },
                        { value: 'request_revision', label: 'Request Revision' },
                      ]}
                    />
                  </div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Review Notes
                    </label>
                    <Textarea
                      name="review_notes"
                      rows={5}
                      placeholder="Enter review comments..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReviewDeliverableModal({ open: false, deliverable: null })}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      Submit Review
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {(isLender || isBorrower || isConsultant) && activeSubTab === 'appointments' && (
        <div>
          <div style={commonStyles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Appointments</h2>
              {(isBorrower || isConsultant) && selections.length > 0 && (
                <Button
                  variant="primary"
                  onClick={() => {
                    // Get first selected provider for booking
                    const firstSelection = selections[0];
                    setBookAppointmentModal({ 
                      open: true, 
                      roleType: firstSelection.role_type, 
                      providerFirm: firstSelection.provider_firm 
                    });
                  }}
                >
                  Book Appointment
                </Button>
              )}
            </div>
            
            {appointments.length === 0 ? (
              <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
                No appointments scheduled yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
                {appointments.map(appointment => {
                  const statusColors = {
                    proposed: theme.colors.info,
                    confirmed: theme.colors.success,
                    rescheduled: theme.colors.warning,
                    cancelled: theme.colors.error,
                    completed: theme.colors.gray500,
                  };
                  
                  return (
                    <div key={appointment.id} style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.md }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                            <h3 style={{ margin: 0 }}>{appointment.role_type_display}</h3>
                            <Badge color={statusColors[appointment.status] || theme.colors.gray500}>
                              {appointment.status_display}
                            </Badge>
                          </div>
                          <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Provider: {appointment.provider_firm_name}
                          </p>
                          {appointment.date_time && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Date & Time: {new Date(appointment.date_time).toLocaleString()}
                            </p>
                          )}
                          {appointment.location && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Location: {appointment.location}
                            </p>
                          )}
                          {appointment.notes && (
                            <div style={{
                              marginTop: theme.spacing.sm,
                              padding: theme.spacing.md,
                              background: theme.colors.gray100,
                              borderRadius: theme.borderRadius.sm,
                            }}>
                              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                                {appointment.notes}
                              </p>
                            </div>
                          )}
                          {appointment.proposed_slots && appointment.proposed_slots.length > 0 && appointment.status === 'proposed' && (
                            <div style={{ marginTop: theme.spacing.sm }}>
                              <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                                Proposed Time Slots:
                              </p>
                              {appointment.proposed_slots.map((slot, idx) => (
                                <div key={idx} style={{
                                  padding: theme.spacing.sm,
                                  marginTop: theme.spacing.xs,
                                  border: `1px solid ${theme.colors.gray300}`,
                                  borderRadius: theme.borderRadius.sm,
                                }}>
                                  <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                                    {new Date(slot.date_time).toLocaleString()}
                                  </p>
                                  {slot.notes && (
                                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                      {slot.notes}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {appointment.proposed_by_name && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Proposed by: {appointment.proposed_by_name}
                            </p>
                          )}
                          {appointment.confirmed_by_name && (
                            <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Confirmed by: {appointment.confirmed_by_name} on {formatDate(appointment.confirmed_at)}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                          {appointment.can_confirm && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setAppointmentActionModal({ open: true, appointment, action: 'confirm' })}
                            >
                              Confirm
                            </Button>
                          )}
                          {appointment.can_reschedule && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAppointmentActionModal({ open: true, appointment, action: 'reschedule' })}
                            >
                              Reschedule
                            </Button>
                          )}
                          {appointment.can_cancel && (
                            <Button
                              variant="error"
                              size="sm"
                              onClick={() => setAppointmentActionModal({ open: true, appointment, action: 'cancel' })}
                            >
                              Cancel
                            </Button>
                          )}
                          {appointment.can_complete && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => setAppointmentActionModal({ open: true, appointment, action: 'complete' })}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Book Appointment Modal */}
          {bookAppointmentModal.open && (
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
                padding: theme.spacing.xl,
                borderRadius: theme.borderRadius.md,
                maxWidth: 600,
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Book Appointment</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const dateTime = formData.get('date_time');
                  const location = formData.get('location');
                  const notes = formData.get('notes');
                  
                  try {
                    await api.post('/api/deals/provider-appointments/', {
                      deal: dealId,
                      role_type: bookAppointmentModal.roleType,
                      provider_firm: bookAppointmentModal.providerFirm,
                      date_time: dateTime,
                      location: location,
                      notes: notes,
                    });
                    
                    await loadAppointments();
                    setBookAppointmentModal({ open: false, roleType: null, providerFirm: null });
                    alert('Appointment booked successfully');
                  } catch (err) {
                    console.error('Failed to book appointment:', err);
                    alert('Failed to book appointment: ' + (err.response?.data?.error || err.message));
                  }
                }}>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Date & Time *
                    </label>
                    <Input
                      type="datetime-local"
                      name="date_time"
                      required
                    />
                  </div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Location
                    </label>
                    <Input
                      type="text"
                      name="location"
                      placeholder="Appointment location/address"
                    />
                  </div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Notes
                    </label>
                    <Textarea
                      name="notes"
                      rows={4}
                      placeholder="Appointment notes/agenda..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBookAppointmentModal({ open: false, roleType: null, providerFirm: null })}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      Book Appointment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          
          {/* Appointment Action Modal (Confirm/Reschedule/Cancel/Complete) */}
          {appointmentActionModal.open && appointmentActionModal.appointment && (
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
                padding: theme.spacing.xl,
                borderRadius: theme.borderRadius.md,
                maxWidth: 600,
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
                  {appointmentActionModal.action === 'confirm' ? 'Confirm Appointment' :
                   appointmentActionModal.action === 'reschedule' ? 'Reschedule Appointment' :
                   appointmentActionModal.action === 'cancel' ? 'Cancel Appointment' :
                   'Mark as Completed'}
                </h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const appointment = appointmentActionModal.appointment;
                  
                  try {
                    let endpoint = '';
                    let data = {};
                    
                    if (appointmentActionModal.action === 'confirm') {
                      endpoint = `/api/deals/provider-appointments/${appointment.id}/confirm/`;
                      const selectedSlot = formData.get('selected_slot');
                      data = {
                        selected_slot: selectedSlot ? parseInt(selectedSlot) : appointment.proposed_slots?.[0] ? 0 : null,
                        location: formData.get('location') || appointment.location,
                        notes: formData.get('notes') || '',
                      };
                    } else if (appointmentActionModal.action === 'reschedule') {
                      endpoint = `/api/deals/provider-appointments/${appointment.id}/reschedule/`;
                      data = {
                        date_time: formData.get('date_time'),
                        location: formData.get('location') || appointment.location,
                        notes: formData.get('notes') || '',
                      };
                    } else if (appointmentActionModal.action === 'cancel') {
                      endpoint = `/api/deals/provider-appointments/${appointment.id}/cancel/`;
                      data = { reason: formData.get('reason') || '' };
                    } else if (appointmentActionModal.action === 'complete') {
                      endpoint = `/api/deals/provider-appointments/${appointment.id}/complete/`;
                      data = { notes: formData.get('notes') || '' };
                    }
                    
                    await api.post(endpoint, data);
                    await loadAppointments();
                    setAppointmentActionModal({ open: false, appointment: null, action: null });
                    alert('Appointment updated successfully');
                  } catch (err) {
                    console.error('Failed to update appointment:', err);
                    alert('Failed to update appointment: ' + (err.response?.data?.error || err.message));
                  }
                }}>
                  {appointmentActionModal.action === 'confirm' && appointmentActionModal.appointment.proposed_slots && appointmentActionModal.appointment.proposed_slots.length > 0 && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                        Select Time Slot *
                      </label>
                      <Select
                        name="selected_slot"
                        required
                        options={appointmentActionModal.appointment.proposed_slots.map((slot, idx) => ({
                          value: idx.toString(),
                          label: `${new Date(slot.date_time).toLocaleString()}${slot.notes ? ' - ' + slot.notes : ''}`,
                        }))}
                      />
                    </div>
                  )}
                  {appointmentActionModal.action === 'reschedule' && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                        New Date & Time *
                      </label>
                      <Input
                        type="datetime-local"
                        name="date_time"
                        required
                        defaultValue={appointmentActionModal.appointment.date_time ? new Date(appointmentActionModal.appointment.date_time).toISOString().slice(0, 16) : ''}
                      />
                    </div>
                  )}
                  {(appointmentActionModal.action === 'confirm' || appointmentActionModal.action === 'reschedule') && (
                    <>
                      <div style={{ marginBottom: theme.spacing.md }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                          Location
                        </label>
                        <Input
                          type="text"
                          name="location"
                          defaultValue={appointmentActionModal.appointment.location || ''}
                          placeholder="Appointment location/address"
                        />
                      </div>
                      <div style={{ marginBottom: theme.spacing.md }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                          Notes
                        </label>
                        <Textarea
                          name="notes"
                          rows={4}
                          placeholder="Additional notes..."
                        />
                      </div>
                    </>
                  )}
                  {appointmentActionModal.action === 'cancel' && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                        Reason (optional)
                      </label>
                      <Textarea
                        name="reason"
                        rows={4}
                        placeholder="Reason for cancellation..."
                      />
                    </div>
                  )}
                  {appointmentActionModal.action === 'complete' && (
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                        Completion Notes (optional)
                      </label>
                      <Textarea
                        name="notes"
                        rows={4}
                        placeholder="Completion notes..."
                      />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAppointmentActionModal({ open: false, appointment: null, action: null })}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      {appointmentActionModal.action === 'confirm' ? 'Confirm' :
                       appointmentActionModal.action === 'reschedule' ? 'Reschedule' :
                       appointmentActionModal.action === 'cancel' ? 'Cancel Appointment' :
                       'Mark Complete'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {(isLender || isBorrower || isConsultant) && activeSubTab === 'messages' && (
        <div>
          <div style={{ display: 'flex', gap: theme.spacing.lg, height: '600px' }}>
            {/* Thread List */}
            <div style={{ 
              width: '300px', 
              border: `1px solid ${theme.colors.gray300}`, 
              borderRadius: theme.borderRadius.md,
              background: theme.colors.white,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ 
                padding: theme.spacing.md, 
                borderBottom: `1px solid ${theme.colors.gray300}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <h3 style={{ margin: 0 }}>Threads</h3>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setCreateThreadModal({ open: true })}
                >
                  New Thread
                </Button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {messageThreads.length === 0 ? (
                  <div style={{ padding: theme.spacing.lg, textAlign: 'center', color: theme.colors.textSecondary }}>
                    No message threads yet. Create one to start communicating.
                  </div>
                ) : (
                  messageThreads.map(thread => (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      style={{
                        padding: theme.spacing.md,
                        borderBottom: `1px solid ${theme.colors.gray300}`,
                        cursor: 'pointer',
                        background: selectedThread?.id === thread.id ? theme.colors.primaryLight : 'transparent',
                        ':hover': { background: theme.colors.gray50 },
                      }}
                      onMouseEnter={(e) => {
                        if (selectedThread?.id !== thread.id) {
                          e.currentTarget.style.background = theme.colors.gray50;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedThread?.id !== thread.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.xs }}>
                        <Badge color={theme.colors.primary} style={{ fontSize: theme.typography.fontSize.xs }}>
                          {thread.thread_type_display}
                        </Badge>
                        {thread.is_private && (
                          <Badge color={theme.colors.warning} style={{ fontSize: theme.typography.fontSize.xs }}>
                            Private
                          </Badge>
                        )}
                      </div>
                      <h4 style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.md }}>
                        {thread.subject || `Thread ${thread.id}`}
                      </h4>
                      {thread.visible_to_party_names && thread.visible_to_party_names.length > 0 && (
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          {thread.visible_to_party_names.join(', ')}
                        </p>
                      )}
                      {thread.last_message_at && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                          {new Date(thread.last_message_at).toLocaleString()}
                        </p>
                      )}
                      {thread.message_count > 0 && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.xs, color: theme.colors.textSecondary }}>
                          {thread.message_count} message{thread.message_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Message View */}
            <div style={{ 
              flex: 1, 
              border: `1px solid ${theme.colors.gray300}`, 
              borderRadius: theme.borderRadius.md,
              background: theme.colors.white,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {selectedThread ? (
                <>
                  <div style={{ 
                    padding: theme.spacing.md, 
                    borderBottom: `1px solid ${theme.colors.gray300}`,
                  }}>
                    <h3 style={{ margin: 0 }}>{selectedThread.subject || `Thread ${selectedThread.id}`}</h3>
                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {selectedThread.thread_type_display}
                      {selectedThread.visible_to_party_names && ` • ${selectedThread.visible_to_party_names.join(', ')}`}
                    </p>
                  </div>
                  <div style={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    padding: theme.spacing.md,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: theme.spacing.sm,
                  }}>
                    {threadMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: theme.colors.textSecondary, padding: theme.spacing.xl }}>
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      threadMessages.map(msg => (
                        <div
                          key={msg.id}
                          style={{
                            alignSelf: msg.is_own_message ? 'flex-end' : 'flex-start',
                            maxWidth: '70%',
                            padding: theme.spacing.md,
                            background: msg.is_own_message ? theme.colors.primary : theme.colors.gray100,
                            color: msg.is_own_message ? theme.colors.white : theme.colors.text,
                            borderRadius: theme.borderRadius.md,
                          }}
                        >
                          <div style={{ 
                            marginBottom: theme.spacing.xs, 
                            fontSize: theme.typography.fontSize.sm,
                            opacity: 0.8,
                          }}>
                            {msg.sender_name} {msg.sender_role && `(${msg.sender_role})`}
                          </div>
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                          <div style={{ 
                            marginTop: theme.spacing.xs, 
                            fontSize: theme.typography.fontSize.xs,
                            opacity: 0.7,
                          }}>
                            {new Date(msg.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ 
                    padding: theme.spacing.md, 
                    borderTop: `1px solid ${theme.colors.gray300}`,
                  }}>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage(selectedThread.id);
                    }}>
                      <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                        <Textarea
                          value={newMessageText}
                          onChange={(e) => setNewMessageText(e.target.value)}
                          placeholder="Type your message..."
                          rows={3}
                          style={{ flex: 1 }}
                        />
                        <Button type="submit" variant="primary" style={{ alignSelf: 'flex-end' }}>
                          Send
                        </Button>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: theme.colors.textSecondary,
                }}>
                  Select a thread to view messages
                </div>
              )}
            </div>
          </div>

          {/* Create Thread Modal */}
          {createThreadModal.open && (
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
                padding: theme.spacing.xl,
                borderRadius: theme.borderRadius.md,
                maxWidth: 500,
                width: '90%',
              }}>
                <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Create New Thread</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const threadType = formData.get('thread_type');
                  const subject = formData.get('subject');
                  await createThread(threadType, subject);
                }}>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Thread Type *
                    </label>
                    <Select
                      name="thread_type"
                      required
                      options={[
                        { value: 'general', label: 'General (Borrower-Lender)' },
                        { value: 'legal', label: 'Legal (Lender + Solicitors)' },
                        { value: 'valuation', label: 'Valuation (Lender + Valuer)' },
                        { value: 'ims', label: 'IMS (Lender + Monitoring Surveyor)' },
                      ]}
                    />
                  </div>
                  <div style={{ marginBottom: theme.spacing.md }}>
                    <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.semibold }}>
                      Subject *
                    </label>
                    <Input
                      type="text"
                      name="subject"
                      required
                      placeholder="Thread subject..."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateThreadModal({ open: false })}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary">
                      Create Thread
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request Quotes Modal */}
      {requestQuotesModal.open && (
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
              Request Quotes - {requestQuotesModal.roleType === 'valuer' ? 'Valuer' : requestQuotesModal.roleType === 'monitoring_surveyor' ? 'Monitoring Surveyor' : 'Solicitor'}
            </h2>
            
            <div style={{ marginBottom: theme.spacing.md }}>
              <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
                Selected providers will receive a quote request. They will be notified and can submit quotes through their dashboard.
              </p>
              
              {requestQuotesModal.selectedProviders.length > 0 && (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Selected Providers ({requestQuotesModal.selectedProviders.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                    {requestQuotesModal.selectedProviders.map((match, idx) => (
                      <div
                        key={match.provider.id}
                        style={{
                          padding: theme.spacing.md,
                          border: `1px solid ${theme.colors.gray300}`,
                          borderRadius: theme.borderRadius.md,
                          background: theme.colors.gray50,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{match.provider.organisation_name}</strong>
                            <Badge variant="success" style={{ marginLeft: theme.spacing.sm }}>
                              {Math.round(match.match_score)}% match
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="error"
                            onClick={() => {
                              setRequestQuotesModal(prev => ({
                                ...prev,
                                selectedProviders: prev.selectedProviders.filter((_, i) => i !== idx),
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setRequestQuotesModal({ open: false, roleType: null, selectedProviders: [] });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRequestQuotes}
                disabled={requestQuotesModal.selectedProviders.length === 0}
              >
                Send Quote Requests
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Select Provider Modal (Borrower) */}
      {selectProviderModal.open && selectProviderModal.quote && (
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
              Select Provider - {selectProviderModal.quote.role_type_display}
            </h2>
            
            <div style={{ marginBottom: theme.spacing.md }}>
              <div style={{
                padding: theme.spacing.md,
                border: `1px solid ${theme.colors.gray300}`,
                borderRadius: theme.borderRadius.md,
                background: theme.colors.gray50,
                marginBottom: theme.spacing.md,
              }}>
                <h3 style={{ margin: `0 0 ${theme.spacing.sm} 0` }}>
                  {selectProviderModal.quote.provider_firm_name}
                </h3>
                <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  £{parseFloat(selectProviderModal.quote.price_gbp).toLocaleString()}
                </p>
                <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  Lead time: {selectProviderModal.quote.lead_time_days} days
                </p>
                {selectProviderModal.quote.scope_summary && (
                  <p style={{ margin: `${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm }}>
                    {selectProviderModal.quote.scope_summary}
                  </p>
                )}
              </div>

              {/* Use Own Solicitor (only for solicitor role) */}
              {selectProviderModal.quote.role_type === 'solicitor' && (
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectProviderModal.useOwnSolicitor}
                      onChange={(e) => setSelectProviderModal(prev => ({ ...prev, useOwnSolicitor: e.target.checked }))}
                    />
                    <span style={{ fontWeight: theme.typography.fontWeight.medium }}>
                      Use my own solicitor
                    </span>
                  </label>
                  
                  {selectProviderModal.useOwnSolicitor && (
                    <div style={{
                      marginTop: theme.spacing.md,
                      padding: theme.spacing.md,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}>
                      <div style={{ marginBottom: theme.spacing.sm }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                          Firm Name *
                        </label>
                        <Input
                          value={ownSolicitorForm.firm_name}
                          onChange={(e) => setOwnSolicitorForm(prev => ({ ...prev, firm_name: e.target.value }))}
                          placeholder="Solicitor firm name"
                        />
                      </div>
                      <div style={{ marginBottom: theme.spacing.sm }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                          SRA Number *
                        </label>
                        <Input
                          value={ownSolicitorForm.sra_number}
                          onChange={(e) => setOwnSolicitorForm(prev => ({ ...prev, sra_number: e.target.value }))}
                          placeholder="SRA registration number"
                        />
                      </div>
                      <div style={{ marginBottom: theme.spacing.sm }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                          Contact Name
                        </label>
                        <Input
                          value={ownSolicitorForm.contact_name}
                          onChange={(e) => setOwnSolicitorForm(prev => ({ ...prev, contact_name: e.target.value }))}
                          placeholder="Primary contact name"
                        />
                      </div>
                      <div style={{ marginBottom: theme.spacing.sm }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                          Contact Email
                        </label>
                        <Input
                          type="email"
                          value={ownSolicitorForm.contact_email}
                          onChange={(e) => setOwnSolicitorForm(prev => ({ ...prev, contact_email: e.target.value }))}
                          placeholder="contact@firm.com"
                        />
                      </div>
                      <div style={{ marginBottom: theme.spacing.sm }}>
                        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                          Contact Phone
                        </label>
                        <Input
                          value={ownSolicitorForm.contact_phone}
                          onChange={(e) => setOwnSolicitorForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                          placeholder="+44 20 1234 5678"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lender Approval Toggle */}
              <div style={{ marginBottom: theme.spacing.md }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectProviderModal.lenderApprovalRequired}
                    onChange={(e) => setSelectProviderModal(prev => ({ ...prev, lenderApprovalRequired: e.target.checked }))}
                  />
                  <span style={{ fontWeight: theme.typography.fontWeight.medium }}>
                    Require lender approval
                  </span>
                </label>
                <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                  If checked, the lender must approve this selection before the provider is instructed.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectProviderModal({ open: false, quote: null, useOwnSolicitor: false, lenderApprovalRequired: false });
                  setOwnSolicitorForm({ firm_name: '', sra_number: '', contact_name: '', contact_email: '', contact_phone: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSelectProvider}
              >
                Confirm Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Consultant Modal (existing) */}
      {inviteModal.open && (
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
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
              Invite {inviteModal.partyType === 'valuer' ? 'Valuer' : inviteModal.partyType === 'monitoring_surveyor' ? 'Monitoring Surveyor' : 'Solicitor'}
            </h2>
            
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Consultant
              </label>
              <Select
                value={inviteForm.consultant_user_id}
                onChange={(e) => setInviteForm({ ...inviteForm, consultant_user_id: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">Select consultant...</option>
                {consultants
                  .filter(c => {
                    if (inviteModal.partyType === 'valuer') return c.services_offered?.includes('valuation_surveyor') || c.services_offered?.includes('valuation_and_monitoring_surveyor');
                    if (inviteModal.partyType === 'monitoring_surveyor') return c.services_offered?.includes('monitoring_surveyor') || c.services_offered?.includes('valuation_and_monitoring_surveyor');
                    if (inviteModal.partyType === 'solicitor') return c.services_offered?.includes('solicitor');
                    return true;
                  })
                  .map(consultant => (
                    <option key={consultant.id} value={consultant.user || consultant.id}>
                      {consultant.organisation_name || 'Consultant'} - {consultant.user_email || consultant.email || 'N/A'}
                    </option>
                  ))}
              </Select>
            </div>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Acting For
              </label>
              <Select
                value={inviteForm.acting_for_party}
                onChange={(e) => setInviteForm({ ...inviteForm, acting_for_party: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="lender">Lender</option>
                <option value="borrower">Borrower</option>
              </Select>
            </div>

            {inviteModal.partyType === 'solicitor' && inviteForm.acting_for_party === 'lender' && lenderSolicitor && (
              <div style={{
                padding: theme.spacing.md,
                background: theme.colors.warningLight,
                borderRadius: theme.borderRadius.md,
                marginBottom: theme.spacing.md,
              }}>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                  ⚠️ There is already an active lender solicitor ({lenderSolicitor.user_name}). 
                  Inviting a new one will require replacing the existing solicitor.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteModal({ open: false, partyType: null });
                  setInviteForm({ consultant_user_id: '', acting_for_party: 'lender', firm_name: '', sra_number: '', rics_number: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleInviteConsultant}
                disabled={!inviteForm.consultant_user_id}
              >
                Invite
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Solicitor Modal (existing) */}
      {replaceModal.open && (
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
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Replace Lender Solicitor</h2>
            <p style={{ color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
              Please provide a reason for replacing the current solicitor. This action will be logged in the audit trail.
            </p>
            
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Reason (Required)
              </label>
              <Textarea
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                rows={4}
                placeholder="e.g., Solicitor requested replacement due to conflict of interest..."
              />
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setReplaceModal({ open: false, solicitorId: null });
                  setReplaceReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="error"
                onClick={handleReplaceSolicitor}
                disabled={!replaceReason.trim()}
              >
                Replace Solicitor
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Consultants List (existing - shown when no sub-tabs or as fallback) */}
      {subTabs.length === 0 && (
        <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h2 style={{ margin: 0 }}>Consultants & Solicitors</h2>
            <div style={{ display: 'flex', gap: theme.spacing.sm }}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteModal({ open: true, partyType: 'valuer' })}
              >
                + Invite Valuer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteModal({ open: true, partyType: 'monitoring_surveyor' })}
              >
                + Invite IMS
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteModal({ open: true, partyType: 'solicitor' })}
              >
                + Invite Solicitor
              </Button>
            </div>
          </div>

          {consultantParties.length === 0 ? (
            <p style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: theme.spacing.xl }}>
              No consultants invited yet. Click the buttons above to invite consultants.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {consultantParties.map((party) => (
                <div
                  key={party.id}
                  style={{
                    padding: theme.spacing.lg,
                    border: `1px solid ${
                      party.appointment_status === 'active' ? theme.colors.success :
                      party.appointment_status === 'removed' ? theme.colors.error :
                      theme.colors.gray300
                    }`,
                    borderRadius: theme.borderRadius.md,
                    background: theme.colors.white,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                        <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg }}>
                          {party.user_name || 'Unknown'}
                        </h3>
                        <Badge variant="info">
                          {party.party_type_display || party.party_type}
                        </Badge>
                        {party.is_active_lender_solicitor && (
                          <Badge variant="success">Active Lender Solicitor</Badge>
                        )}
                        {getStatusBadge(party.appointment_status)}
                      </div>
                      {party.firm_name && (
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Firm: {party.firm_name}
                        </p>
                      )}
                      {party.acting_for_party && (
                        <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          Acting for: {party.acting_for_party === 'lender' ? 'Lender' : 'Borrower'}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
                        {party.invited_at && (
                          <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Invited: {formatDate(party.invited_at)}
                          </span>
                        )}
                        {party.confirmed_at && (
                          <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Confirmed: {formatDate(party.confirmed_at)}
                          </span>
                        )}
                        {party.access_granted_at && (
                          <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Access granted: {formatDate(party.access_granted_at)}
                          </span>
                        )}
                      </div>
                      {party.sra_number && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          SRA: {party.sra_number}
                        </p>
                      )}
                      {party.rics_number && (
                        <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          RICS: {party.rics_number}
                        </p>
                      )}
                      {party.appointment_status === 'invited' && (
                        <div style={{
                          marginTop: theme.spacing.md,
                          padding: theme.spacing.md,
                          background: theme.colors.warningLight,
                          borderRadius: theme.borderRadius.md,
                        }}>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                            ⏳ Awaiting consultant confirmation. Consultant must confirm acting party before access is granted.
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                      {party.party_type === 'solicitor' && 
                       party.acting_for_party === 'lender' && 
                       party.is_active_lender_solicitor && 
                       party.appointment_status === 'active' && (
                        <Button
                          size="sm"
                          variant="error"
                          onClick={() => setReplaceModal({ open: true, solicitorId: party.id })}
                        >
                          Replace
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REPORTING TAB - Provider Performance Metrics */}
      {isLender && activeSubTab === 'reporting' && (
        <div>
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Provider Performance Metrics</h2>
            {loadingMetrics ? (
              <p style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textSecondary }}>
                Loading metrics...
              </p>
            ) : providerMetrics && providerMetrics.metrics_by_provider && Object.keys(providerMetrics.metrics_by_provider).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xl }}>
                {Object.values(providerMetrics.metrics_by_provider).map((providerData, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: theme.spacing.lg,
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: theme.borderRadius.md,
                      background: theme.colors.white,
                    }}
                  >
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.xl }}>
                        {providerData.provider_firm?.name || 'Unknown Provider'}
                      </h3>
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        {providerData.role_type_display || providerData.role_type}
                      </p>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: theme.spacing.md,
                    }}>
                      {/* Quote Response Time */}
                      {providerData.quote_response_time_hours !== null && providerData.quote_response_time_hours !== undefined && (
                        <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Quote Response Time
                          </p>
                          <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                            {providerData.quote_response_time_hours < 24
                              ? `${Math.round(providerData.quote_response_time_hours)} hours`
                              : `${Math.round(providerData.quote_response_time_hours / 24)} days`}
                          </p>
                        </div>
                      )}

                      {/* Quote Acceptance */}
                      {providerData.quote_submitted !== undefined && (
                        <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                          <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            Quote Status
                          </p>
                          <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                            {providerData.quote_accepted ? 'Accepted' : providerData.quote_submitted ? 'Submitted' : 'Not Submitted'}
                          </p>
                        </div>
                      )}

                      {/* Deliverable Metrics */}
                      {providerData.deliverables_total !== undefined && (
                        <>
                          <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Deliverables
                            </p>
                            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                              {providerData.deliverables_approved || 0} / {providerData.deliverables_total || 0} Approved
                            </p>
                            {providerData.deliverables_rejected > 0 && (
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.error }}>
                                {providerData.deliverables_rejected} Rejected
                              </p>
                            )}
                          </div>

                          {providerData.average_delivery_time_days !== null && providerData.average_delivery_time_days !== undefined && (
                            <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Avg. Delivery Time
                              </p>
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                                {Math.round(providerData.average_delivery_time_days)} days
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Appointment Metrics */}
                      {providerData.appointments_total !== undefined && (
                        <>
                          <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                            <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                              Appointments
                            </p>
                            <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                              {providerData.appointments_confirmed || 0} / {providerData.appointments_total || 0} Confirmed
                            </p>
                          </div>

                          {providerData.average_appointment_lead_time_hours !== null && providerData.average_appointment_lead_time_hours !== undefined && (
                            <div style={{ padding: theme.spacing.md, background: theme.colors.gray50, borderRadius: theme.borderRadius.sm }}>
                              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                Avg. Appointment Lead Time
                              </p>
                              <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                                {providerData.average_appointment_lead_time_hours < 24
                                  ? `${Math.round(providerData.average_appointment_lead_time_hours)} hours`
                                  : `${Math.round(providerData.average_appointment_lead_time_hours / 24)} days`}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textSecondary }}>
                No provider metrics available for this deal. Metrics will appear once providers are selected and start working on the deal.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SLA Metrics Placeholder */}
      {subTabs.length === 0 && (
        <div style={commonStyles.card}>
          <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>SLA Metrics</h3>
          <p style={{ color: theme.colors.textSecondary }}>
            SLA metrics (time to accept instruction, time to deliver deliverable) will be displayed here.
            Metrics are calculated based on appointment dates and task completions.
          </p>
        </div>
      )}

      {/* ENQUIRY DETAIL MODAL */}
      {enquiryDetailModal.open && enquiryDetailModal.enquiry && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Quote Request Details</h2>
              <Button variant="outline" onClick={() => setEnquiryDetailModal({ open: false, enquiry: null })}>Close</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
              {/* Enquiry Info */}
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Enquiry Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Provider:</strong> {enquiryDetailModal.enquiry.provider_firm_name}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Role:</strong> {enquiryDetailModal.enquiry.role_type_display}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Status:</strong> {getStatusBadge(enquiryDetailModal.enquiry.status)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Sent:</strong> {formatDate(enquiryDetailModal.enquiry.sent_at)}
                    </p>
                    {enquiryDetailModal.enquiry.viewed_at && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        <strong>Viewed:</strong> {formatDate(enquiryDetailModal.enquiry.viewed_at)}
                      </p>
                    )}
                    {enquiryDetailModal.enquiry.quote_due_at && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        <strong>Quote Due:</strong> {formatDate(enquiryDetailModal.enquiry.quote_due_at)}
                      </p>
                    )}
                  </div>
                </div>

                {enquiryDetailModal.enquiry.acknowledged_at && (
                  <div style={{
                    marginTop: theme.spacing.md,
                    padding: theme.spacing.md,
                    background: theme.colors.successLight,
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.success}`,
                  }}>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.successDark }}>
                      ✓ Acknowledged: {formatDate(enquiryDetailModal.enquiry.acknowledged_at)}
                    </p>
                    {enquiryDetailModal.enquiry.expected_quote_date && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.successDark }}>
                        Expected Quote: {formatDate(enquiryDetailModal.enquiry.expected_quote_date)}
                      </p>
                    )}
                    {enquiryDetailModal.enquiry.acknowledgment_notes && (
                      <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                        {enquiryDetailModal.enquiry.acknowledgment_notes}
                      </p>
                    )}
                  </div>
                )}

                {enquiryDetailModal.enquiry.lender_notes && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Your Notes:
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {enquiryDetailModal.enquiry.lender_notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Messages Section */}
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Correspondence</h3>
                {loadingMessages ? (
                  <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading messages...</p>
                ) : selectedThread && threadMessages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxHeight: '400px', overflowY: 'auto' }}>
                    {threadMessages.map((msg) => (
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
                    No messages yet. Start a conversation with the provider.
                  </p>
                )}

                {selectedThread && (
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm }}>
                    <Textarea
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="primary"
                      onClick={() => {
                        sendMessage(selectedThread.id);
                        setNewMessageText('');
                      }}
                      disabled={!newMessageText.trim()}
                    >
                      Send
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUOTE DETAIL MODAL */}
      {quoteDetailModal.open && quoteDetailModal.quote && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0 }}>Quote Details</h2>
              <Button variant="outline" onClick={() => setQuoteDetailModal({ open: false, quote: null })}>Close</Button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
              {/* Quote Information */}
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Quote Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Provider:</strong> {quoteDetailModal.quote.provider_firm_name}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Role:</strong> {quoteDetailModal.quote.role_type_display}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Status:</strong> {getStatusBadge(quoteDetailModal.quote.status)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Price:</strong> £{parseFloat(quoteDetailModal.quote.price_gbp).toLocaleString()}
                    </p>
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Lead Time:</strong> {quoteDetailModal.quote.lead_time_days} days
                    </p>
                    {quoteDetailModal.quote.earliest_available_date && (
                      <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                        <strong>Available:</strong> {formatDate(quoteDetailModal.quote.earliest_available_date)}
                      </p>
                    )}
                    <p style={{ margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      <strong>Submitted:</strong> {formatDate(quoteDetailModal.quote.submitted_at)}
                    </p>
                  </div>
                </div>

                {quoteDetailModal.quote.scope_summary && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Scope Summary:
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {quoteDetailModal.quote.scope_summary}
                    </p>
                  </div>
                )}

                {quoteDetailModal.quote.assumptions && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Assumptions & Exclusions:
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {quoteDetailModal.quote.assumptions}
                    </p>
                  </div>
                )}

                {quoteDetailModal.quote.deliverables && Array.isArray(quoteDetailModal.quote.deliverables) && quoteDetailModal.quote.deliverables.length > 0 && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Deliverables:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                      {quoteDetailModal.quote.deliverables.map((deliverable, idx) => (
                        <li key={idx}>{deliverable}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {quoteDetailModal.quote.payment_terms && (
                  <div style={{ marginTop: theme.spacing.md }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Payment Terms:
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {quoteDetailModal.quote.payment_terms}
                    </p>
                  </div>
                )}

                {quoteDetailModal.quote.validity_days && (
                  <p style={{ margin: `${theme.spacing.md} 0 0 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                    <strong>Validity:</strong> {quoteDetailModal.quote.validity_days} days
                  </p>
                )}

                {quoteDetailModal.quote.lender_notes && (
                  <div style={{ marginTop: theme.spacing.md, padding: theme.spacing.md, background: theme.colors.infoLight, borderRadius: theme.borderRadius.sm }}>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                      Your Notes:
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, whiteSpace: 'pre-wrap' }}>
                      {quoteDetailModal.quote.lender_notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Quote Actions */}
              {isLender && (quoteDetailModal.quote.status === 'submitted' || quoteDetailModal.quote.status === 'under_review') && (
                <div style={commonStyles.card}>
                  <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Actions</h3>
                  <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                    <Button
                      variant="success"
                      onClick={() => setQuoteActionModal({ open: true, quote: quoteDetailModal.quote, action: 'accept', notes: '', counterPrice: '' })}
                    >
                      Accept Quote
                    </Button>
                    <Button
                      variant="warning"
                      onClick={() => setQuoteActionModal({ open: true, quote: quoteDetailModal.quote, action: 'negotiate', notes: '', counterPrice: '' })}
                    >
                      Request Negotiation
                    </Button>
                    <Button
                      variant="error"
                      onClick={() => setQuoteActionModal({ open: true, quote: quoteDetailModal.quote, action: 'reject', notes: '', counterPrice: '' })}
                    >
                      Reject Quote
                    </Button>
                  </div>
                </div>
              )}

              {/* Messages Section */}
              <div style={commonStyles.card}>
                <h3 style={{ margin: `0 0 ${theme.spacing.md} 0` }}>Correspondence</h3>
                {loadingMessages ? (
                  <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading messages...</p>
                ) : selectedThread && threadMessages.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxHeight: '400px', overflowY: 'auto' }}>
                    {threadMessages.map((msg) => (
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
                    No messages yet. Start a conversation with the provider.
                  </p>
                )}

                {selectedThread && (
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm }}>
                    <Textarea
                      value={newMessageText}
                      onChange={(e) => setNewMessageText(e.target.value)}
                      placeholder="Type your message..."
                      rows={3}
                      style={{ flex: 1 }}
                    />
                    <Button
                      variant="primary"
                      onClick={() => {
                        sendMessage(selectedThread.id);
                        setNewMessageText('');
                      }}
                      disabled={!newMessageText.trim()}
                    >
                      Send
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUOTE ACTION MODAL */}
      {quoteActionModal.open && quoteActionModal.quote && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '600px' }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>
              {quoteActionModal.action === 'accept' ? 'Accept Quote' : 
               quoteActionModal.action === 'reject' ? 'Reject Quote' : 
               'Request Negotiation'}
            </h2>

            {quoteActionModal.action === 'accept' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Are you sure you want to accept this quote? This will select the provider for this role.
                </p>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Notes (Optional)
                  </label>
                  <Textarea
                    value={quoteActionModal.notes}
                    onChange={(e) => setQuoteActionModal({ ...quoteActionModal, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any notes about accepting this quote..."
                  />
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => setQuoteActionModal({ open: false, quote: null, action: null, notes: '', counterPrice: '' })}>
                    Cancel
                  </Button>
                  <Button variant="success" onClick={handleQuoteAction}>
                    Accept Quote
                  </Button>
                </div>
              </div>
            )}

            {quoteActionModal.action === 'reject' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Please provide a reason for rejecting this quote.
                </p>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Reason (Required)
                  </label>
                  <Textarea
                    value={quoteActionModal.notes}
                    onChange={(e) => setQuoteActionModal({ ...quoteActionModal, notes: e.target.value })}
                    rows={4}
                    placeholder="Explain why you are rejecting this quote..."
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => setQuoteActionModal({ open: false, quote: null, action: null, notes: '', counterPrice: '' })}>
                    Cancel
                  </Button>
                  <Button 
                    variant="error" 
                    onClick={handleQuoteAction}
                    disabled={!quoteActionModal.notes.trim()}
                  >
                    Reject Quote
                  </Button>
                </div>
              </div>
            )}

            {quoteActionModal.action === 'negotiate' && (
              <div>
                <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
                  Request negotiation on this quote. The provider will be notified and can respond with a revised quote.
                </p>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Negotiation Notes (Required)
                  </label>
                  <Textarea
                    value={quoteActionModal.notes}
                    onChange={(e) => setQuoteActionModal({ ...quoteActionModal, notes: e.target.value })}
                    rows={4}
                    placeholder="What would you like to negotiate? (e.g., price, terms, scope)..."
                    required
                  />
                </div>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                    Counter Price (Optional)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={quoteActionModal.counterPrice}
                    onChange={(e) => setQuoteActionModal({ ...quoteActionModal, counterPrice: e.target.value })}
                    placeholder="e.g., 5000.00"
                  />
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
                  <Button variant="outline" onClick={() => setQuoteActionModal({ open: false, quote: null, action: null, notes: '', counterPrice: '' })}>
                    Cancel
                  </Button>
                  <Button 
                    variant="warning" 
                    onClick={handleQuoteAction}
                    disabled={!quoteActionModal.notes.trim()}
                  >
                    Request Negotiation
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forward Quotes to Borrower Modal */}
      {forwardQuotesModal.open && (
        <div style={commonStyles.modalBackdrop}>
          <div style={{ ...commonStyles.modalContent, maxWidth: '600px' }}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Forward Quotes to Borrower</h2>
            <p style={{ margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textSecondary }}>
              You are forwarding {selectedQuotesForForward.length} quote{selectedQuotesForForward.length > 1 ? 's' : ''} to the borrower for review.
            </p>
            <div style={{ marginBottom: theme.spacing.md }}>
              <p style={{ margin: `0 0 ${theme.spacing.sm} 0`, fontSize: theme.typography.fontSize.sm, fontWeight: theme.typography.fontWeight.semibold }}>
                Selected Quotes:
              </p>
              <ul style={{ margin: 0, paddingLeft: theme.spacing.lg, fontSize: theme.typography.fontSize.sm }}>
                {quotes.filter(q => selectedQuotesForForward.includes(q.id)).map(q => (
                  <li key={q.id}>
                    {q.provider_firm_name} - {q.role_type_display} - £{parseFloat(q.price_gbp).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ marginBottom: theme.spacing.lg }}>
              <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: theme.typography.fontWeight.medium }}>
                Notes for Borrower:
              </label>
              <Textarea
                value={forwardQuotesModal.notes}
                onChange={(e) => setForwardQuotesModal({ ...forwardQuotesModal, notes: e.target.value })}
                rows={5}
                placeholder="Add any notes or recommendations for the borrower..."
              />
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  setForwardQuotesModal({ open: false, notes: '' });
                  setSelectedQuotesForForward([]);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    // Create or get general message thread with borrower
                    const threadsRes = await api.get(`/api/deals/deal-message-threads/?deal_id=${dealId}&thread_type=general`);
                    const threads = threadsRes.data.results || threadsRes.data || [];
                    let borrowerThread = threads[0];
                    
                    if (!borrowerThread) {
                      const newThreadRes = await api.post('/api/deals/deal-message-threads/', {
                        deal: dealId,
                        thread_type: 'general',
                        subject: 'Quotes for Review',
                      });
                      borrowerThread = newThreadRes.data;
                    }

                    // Create message with quote details
                    const selectedQuotesData = quotes.filter(q => selectedQuotesForForward.includes(q.id));
                    const quotesList = selectedQuotesData.map(q => 
                      `• ${q.provider_firm_name} (${q.role_type_display}) - £${parseFloat(q.price_gbp).toLocaleString()} - Lead time: ${q.lead_time_days} days`
                    ).join('\n');

                    await api.post('/api/deals/deal-messages/', {
                      thread: borrowerThread.id,
                      message: `[Quotes Forwarded for Review]\n\nI have forwarded the following quote(s) for your review:\n\n${quotesList}\n\n${forwardQuotesModal.notes ? `Notes: ${forwardQuotesModal.notes}` : ''}\n\nPlease review and select your preferred consultant(s).`,
                    });

                    setForwardQuotesModal({ open: false, notes: '' });
                    setSelectedQuotesForForward([]);
                    alert(`Successfully forwarded ${selectedQuotesForForward.length} quote(s) to borrower`);
                  } catch (err) {
                    alert('Failed to forward quotes: ' + (err.response?.data?.error || err.message));
                  }
                }}
              >
                Forward Quotes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsultantsTab;
