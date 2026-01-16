import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from './Button';
import Badge from './Badge';
import Select from './Select';
import Textarea from './Textarea';
import Input from './Input';

function ConsultantsTab({ dealId, deal, onUpdate }) {
  const role = localStorage.getItem('role');
  const isLender = role === 'Lender';
  const isBorrower = role === 'Borrower';
  
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
  const [requestQuotesModal, setRequestQuotesModal] = useState({ open: false, roleType: null, selectedProviders: [] });
  const [loadingMatching, setLoadingMatching] = useState(false);
  const [selectProviderModal, setSelectProviderModal] = useState({ open: false, quote: null, useOwnSolicitor: false, lenderApprovalRequired: false });
  const [ownSolicitorForm, setOwnSolicitorForm] = useState({ firm_name: '', sra_number: '', contact_name: '', contact_email: '', contact_phone: '' });

  useEffect(() => {
    loadParties();
    loadConsultants();
    loadEnquiries();
    loadQuotes();
    loadSelections();
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
      setParties(res.data || []);
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
      setEnquiries(res.data || []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
      setEnquiries([]);
    }
  }

  async function loadQuotes() {
    try {
      const res = await api.get(`/api/deals/provider-quotes/?deal_id=${dealId}`);
      setQuotes(res.data || []);
    } catch (err) {
      console.error('Failed to load quotes:', err);
      setQuotes([]);
    }
  }

  async function loadSelections() {
    try {
      const res = await api.get(`/api/deals/deal-provider-selections/?deal_id=${dealId}`);
      setSelections(res.data || []);
    } catch (err) {
      console.error('Failed to load selections:', err);
      setSelections([]);
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
  ] : [];

  // Borrower sub-tabs
  const borrowerSubTabs = isBorrower ? [
    { id: 'quotes', label: `Quotes (${quotes.length})` },
    { id: 'selection', label: `Selection (${selections.length})` },
    { id: 'appointments', label: 'Appointments' },
    { id: 'deliverables', label: 'Deliverables' },
    { id: 'messages', label: 'Messages' },
  ] : [];

  const subTabs = isLender ? lenderSubTabs : isBorrower ? borrowerSubTabs : [];

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
            <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quotes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {quotes.map((quote) => (
                  <div
                    key={quote.id}
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
                            {quote.scope_summary}
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

      {/* PROGRESS, DELIVERABLES, APPOINTMENTS, MESSAGES - Placeholders for now */}
      {isLender && activeSubTab === 'progress' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Provider Progress</h2>
          <p style={{ color: theme.colors.textSecondary }}>Provider progress tracking (Chunk 6)...</p>
        </div>
      )}

      {(isLender || isBorrower) && activeSubTab === 'deliverables' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Deliverables</h2>
          <p style={{ color: theme.colors.textSecondary }}>Deliverables management (Chunk 7)...</p>
        </div>
      )}

      {(isLender || isBorrower) && activeSubTab === 'appointments' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Appointments</h2>
          <p style={{ color: theme.colors.textSecondary }}>Appointment booking (Chunk 8)...</p>
        </div>
      )}

      {(isLender || isBorrower) && activeSubTab === 'messages' && (
        <div style={commonStyles.card}>
          <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Messages</h2>
          <p style={{ color: theme.colors.textSecondary }}>Private messages (Chunk 9)...</p>
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
    </div>
  );
}

export default ConsultantsTab;
