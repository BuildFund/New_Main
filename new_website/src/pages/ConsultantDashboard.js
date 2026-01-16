import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function ConsultantDashboard({ defaultTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [services, setServices] = useState([]);
  const [enquiries, setEnquiries] = useState([]); // ProviderEnquiry records (deal-based)
  const [quotes, setQuotes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [myDeals, setMyDeals] = useState([]); // Deals consultant is involved with
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Determine initial tab from URL path or defaultTab prop
  const getInitialTab = () => {
    if (defaultTab) return defaultTab;
    if (location.pathname === '/consultant/services') return 'opportunities';
    if (location.pathname === '/consultant/quotes') return 'quotes';
    if (location.pathname === '/consultant/appointments') return 'appointments';
    return 'opportunities';
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [onboardingProgress, setOnboardingProgress] = useState(null);

  useEffect(() => {
    loadDashboardData();
    checkOnboardingProgress();
  }, []);

  // Update active tab when URL changes
  useEffect(() => {
    const newTab = getInitialTab();
    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  async function checkOnboardingProgress() {
    try {
      const res = await api.get('/api/onboarding/progress/');
      setOnboardingProgress(res.data);
    } catch (err) {
      console.error('Failed to check onboarding progress:', err);
    }
  }

  function handleStartOnboarding() {
    window.location.href = '/consultant/profile/wizard';
  }

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // Load profile
      const profileRes = await api.get('/api/consultants/profiles/');
      if (profileRes.data && profileRes.data.length > 0) {
        setProfile(profileRes.data[0]);
      }

      // Load service opportunities (legacy - application-based)
      try {
        const servicesRes = await api.get('/api/consultants/services/');
        setServices(servicesRes.data.results || servicesRes.data || []);
      } catch (err) {
        console.warn('Failed to load legacy services:', err);
        setServices([]);
      }

      // Load enquiries (deal-based quote requests) - NEW SYSTEM
      try {
        const enquiriesRes = await api.get('/api/deals/provider-enquiries/');
        setEnquiries(enquiriesRes.data.results || enquiriesRes.data || []);
      } catch (err) {
        console.warn('Failed to load enquiries:', err);
        setEnquiries([]);
      }

      // Load quotes (deal-based ProviderQuote records)
      try {
        const quotesRes = await api.get('/api/deals/provider-quotes/');
        setQuotes(quotesRes.data.results || quotesRes.data || []);
      } catch (err) {
        console.warn('Failed to load deal quotes, trying legacy endpoint:', err);
        // Fallback to legacy quotes endpoint
        try {
          const legacyQuotesRes = await api.get('/api/consultants/quotes/');
          setQuotes(legacyQuotesRes.data.results || legacyQuotesRes.data || []);
        } catch (legacyErr) {
          console.warn('Failed to load legacy quotes:', legacyErr);
          setQuotes([]);
        }
      }

      // Load appointments
      const appointmentsRes = await api.get('/api/consultants/appointments/');
      setAppointments(appointmentsRes.data.results || appointmentsRes.data || []);

      // Load my deals (deals consultant is involved with)
      try {
        const dealsRes = await api.get('/api/deals/deals/my-deals/');
        setMyDeals(dealsRes.data || []);
      } catch (err) {
        console.warn('Failed to load my deals:', err);
        setMyDeals([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status) {
    const colors = {
      pending: theme.colors.warning,
      quotes_received: theme.colors.info,
      consultant_selected: theme.colors.success,
      in_progress: theme.colors.primary,
      completed: theme.colors.success,
      submitted: theme.colors.info,
      accepted: theme.colors.success,
      declined: theme.colors.error,
      appointed: theme.colors.primary,
    };
    return colors[status] || theme.colors.gray500;
  }

  if (loading) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing.xl }}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
        }}>
          <h3>Error</h3>
          <p>{error}</p>
          <Button onClick={loadDashboardData} variant="primary">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: theme.spacing.xl }}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{ ...theme.typography.h1, marginBottom: theme.spacing.sm }}>
          Consultant Dashboard
        </h1>
        <p style={{ color: theme.colors.textSecondary }}>
          Manage your service opportunities, quotes, and appointments
        </p>
      </div>

      {/* Onboarding Progress Bar - Clickable */}
      {onboardingProgress && !onboardingProgress.is_complete && onboardingProgress.completion_percentage < 100 && (
        <div 
          style={{
            background: theme.colors.gray50,
            padding: theme.spacing.lg,
            borderRadius: theme.borderRadius.md,
            marginBottom: theme.spacing.lg,
            border: `2px solid ${theme.colors.warning}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={handleStartOnboarding}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.colors.warningLight;
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.1)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = theme.colors.gray50;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: theme.spacing.sm,
          }}>
            <div>
              <strong style={{ fontSize: theme.typography.fontSize.lg }}>
                Complete Your Profile
              </strong>
              <div style={{ 
                fontSize: theme.typography.fontSize.sm, 
                color: theme.colors.textSecondary,
                marginTop: theme.spacing.xs,
              }}>
                {onboardingProgress.completion_percentage}% complete • {100 - onboardingProgress.completion_percentage}% remaining
              </div>
            </div>
            <div style={{ 
              fontSize: theme.typography.fontSize['2xl'], 
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.primary,
            }}>
              {onboardingProgress.completion_percentage}%
            </div>
          </div>
          
          {/* Progress Bar */}
          <div style={{
            width: '100%',
            height: '8px',
            background: theme.colors.gray200,
            borderRadius: theme.borderRadius.full,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${onboardingProgress.completion_percentage}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
              borderRadius: theme.borderRadius.full,
              transition: 'width 0.3s ease',
            }} />
          </div>
          
          <p style={{ 
            margin: `${theme.spacing.sm} 0 0 0`, 
            fontSize: theme.typography.fontSize.sm, 
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
          }}>
            Click to continue your profile setup
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.xl,
      }}>
        <div 
          style={{
            ...commonStyles.card,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            setActiveTab('opportunities');
            navigate('/consultant/services');
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.primary }}>
            {enquiries.filter(e => !['declined', 'quoted', 'expired'].includes(e.status)).length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            Active Quote Requests
          </p>
        </div>
        <div 
          style={{
            ...commonStyles.card,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setActiveTab('enquiries')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.warning }}>
            {enquiries.filter(e => ['sent', 'received', 'acknowledged', 'preparing_quote', 'queries_raised', 'ready_to_submit'].includes(e.status)).length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            Pending Enquiries
          </p>
        </div>
        <div 
          style={{
            ...commonStyles.card,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setActiveTab('quotes')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.info }}>
            {quotes.filter(q => !['withdrawn', 'expired'].includes(q.status)).length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            Quotes Submitted
          </p>
        </div>
        <div 
          style={{
            ...commonStyles.card,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setActiveTab('my-deals')}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.success }}>
            {myDeals.length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            My Deals
          </p>
        </div>
        <div 
          style={{
            ...commonStyles.card,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            setActiveTab('appointments');
            navigate('/consultant/appointments');
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = theme.shadows.lg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = theme.shadows.sm;
          }}
        >
          <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.success }}>
            {appointments.filter(a => ['proposed', 'confirmed', 'in_progress', 'appointed'].includes(a.status)).length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            Active Appointments
          </p>
        </div>
        {profile && (
          <div 
            style={{
              ...commonStyles.card,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setActiveTab('profile')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = theme.shadows.lg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadows.sm;
            }}
          >
            <h3 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'], color: theme.colors.warning }}>
              {profile.current_capacity} / {profile.max_capacity}
            </h3>
            <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
              Current Capacity
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.sm,
        borderBottom: `2px solid ${theme.colors.gray200}`,
        marginBottom: theme.spacing.lg,
      }}>
        {['opportunities', 'quotes', 'my-deals', 'appointments', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'opportunities') navigate('/consultant/services');
              else if (tab === 'quotes') navigate('/consultant/quotes');
              else if (tab === 'my-deals') { /* Stay on dashboard */ }
              else if (tab === 'appointments') navigate('/consultant/appointments');
              else if (tab === 'profile') navigate('/consultant/profile');
            }}
            style={{
              padding: theme.spacing.md,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              color: activeTab === tab ? theme.colors.primary : theme.colors.textSecondary,
              cursor: 'pointer',
              fontWeight: activeTab === tab ? theme.typography.fontWeight.bold : theme.typography.fontWeight.normal,
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'opportunities' && (
        <div>
          <h2 style={{ marginBottom: theme.spacing.md }}>New Opportunities</h2>
          
          {/* Show deal-based enquiries (NEW SYSTEM) - Only active opportunities */}
          {enquiries.filter(e => !['quoted', 'declined', 'expired'].includes(e.status)).length > 0 && (
            <div style={{ marginBottom: theme.spacing.xl }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {enquiries
                  .filter(e => !['quoted', 'declined', 'expired'].includes(e.status)) // Only show active opportunities
                  .sort((a, b) => new Date(b.sent_at || b.created_at) - new Date(a.sent_at || a.created_at)) // Sort by newest first
                  .map(enquiry => {
                  const isExpired = enquiry.quote_due_at && new Date(enquiry.quote_due_at) < new Date();
                  const hasQuote = enquiry.has_quote;
                  const dealSummary = enquiry.deal_summary_snapshot || {};
                  const project = dealSummary.project || {};
                  const commercialIndicators = dealSummary.commercial_indicators || {};
                  
                  return (
                    <div key={enquiry.id} style={commonStyles.card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs, flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.xl }}>
                              {enquiry.role_type_display || enquiry.role_type} - Deal {enquiry.deal_id_display || enquiry.deal}
                            </h3>
                            <Badge color={getStatusColor(enquiry.status)}>
                              {enquiry.status_display || enquiry.status}
                            </Badge>
                            {isExpired && <Badge color={theme.colors.error}>Expired</Badge>}
                            {enquiry.acknowledged_at && <Badge color={theme.colors.success}>Acknowledged</Badge>}
                          </div>
                          
                          {/* Project Location */}
                          {project.address && (
                            <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                              📍 {project.address}
                              {project.town && `, ${project.town}`}
                              {project.county && `, ${project.county}`}
                            </p>
                          )}
                          
                          {/* Deal Summary - Key Information */}
                          {(dealSummary.facility_type_display || commercialIndicators.loan_amount_range || commercialIndicators.ltv_range || commercialIndicators.interest_rate_range) && (
                            <div style={{
                              marginTop: theme.spacing.sm,
                              padding: theme.spacing.md,
                              background: theme.colors.gray50,
                              borderRadius: theme.borderRadius.sm,
                            }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                gap: theme.spacing.sm,
                              }}>
                                {dealSummary.facility_type_display && (
                                  <div>
                                    <strong style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Facility Type:</strong>
                                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>{dealSummary.facility_type_display}</p>
                                  </div>
                                )}
                                {commercialIndicators.loan_amount_range && (
                                  <div>
                                    <strong style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Loan Amount:</strong>
                                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>{commercialIndicators.loan_amount_range}</p>
                                  </div>
                                )}
                                {commercialIndicators.ltv_range && (
                                  <div>
                                    <strong style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>LTV:</strong>
                                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>{commercialIndicators.ltv_range}</p>
                                  </div>
                                )}
                                {commercialIndicators.interest_rate_range && (
                                  <div>
                                    <strong style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>Interest Rate:</strong>
                                    <p style={{ margin: `${theme.spacing.xs} 0 0 0`, fontSize: theme.typography.fontSize.sm }}>{commercialIndicators.interest_rate_range}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Dates */}
                          <div style={{ marginTop: theme.spacing.sm, display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                            {enquiry.sent_at && (
                              <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                                📅 Received: {new Date(enquiry.sent_at).toLocaleDateString()}
                              </span>
                            )}
                            {enquiry.quote_due_at && (
                              <span style={{ 
                                fontSize: theme.typography.fontSize.sm, 
                                color: isExpired ? theme.colors.error : theme.colors.textSecondary,
                                fontWeight: isExpired ? theme.typography.fontWeight.semibold : 'normal'
                              }}>
                                ⏰ Due: {new Date(enquiry.quote_due_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {/* Lender Notes */}
                          {enquiry.lender_notes && (
                            <div style={{
                              marginTop: theme.spacing.sm,
                              padding: theme.spacing.sm,
                              background: theme.colors.infoLight,
                              borderRadius: theme.borderRadius.sm,
                              fontSize: theme.typography.fontSize.sm,
                            }}>
                              <strong>Lender Notes:</strong> {enquiry.lender_notes}
                            </div>
                          )}
                          
                          {/* Acknowledgment Info */}
                          {enquiry.acknowledged_at && (
                            <div style={{
                              marginTop: theme.spacing.sm,
                              padding: theme.spacing.sm,
                              background: theme.colors.successLight,
                              borderRadius: theme.borderRadius.sm,
                              fontSize: theme.typography.fontSize.sm,
                            }}>
                              <span style={{ color: theme.colors.successDark }}>
                                ✓ Acknowledged: {new Date(enquiry.acknowledged_at).toLocaleDateString()}
                                {enquiry.expected_quote_date && ` | Expected Quote: ${new Date(enquiry.expected_quote_date).toLocaleDateString()}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md, flexWrap: 'wrap' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/consultant/enquiries/${enquiry.id}`)}
                        >
                          View Details
                        </Button>
                        {!hasQuote && enquiry.status !== 'declined' && !isExpired && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/consultant/enquiries/${enquiry.id}/quote`)}
                          >
                            Submit Quote
                          </Button>
                        )}
                        {hasQuote && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/consultant/dashboard', { state: { activeTab: 'quotes' } })}
                          >
                            View Quote
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Show legacy application-based services (if any) */}
          {services.length > 0 && (
            <div>
              <h3 style={{ marginBottom: theme.spacing.md, fontSize: theme.typography.fontSize.lg, color: theme.colors.textSecondary }}>
                Legacy Service Opportunities (Application-Based)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {services.map(service => (
                  <div key={service.id} style={{ ...commonStyles.card, opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{service.service_type_display || service.service_type}</h3>
                        <p style={{ color: theme.colors.textSecondary, margin: theme.spacing.xs + ' 0' }}>
                          Application #{service.application_id}
                        </p>
                      </div>
                      <Badge color={getStatusColor(service.status)}>
                        {service.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    {service.description && (
                      <p style={{ marginBottom: theme.spacing.sm }}>{service.description}</p>
                    )}
                    {service.required_by_date && (
                      <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                        Required by: {new Date(service.required_by_date).toLocaleDateString()}
                      </p>
                    )}
                    <div style={{ marginTop: theme.spacing.md }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => window.location.href = `/consultant/services/${service.id}/quote`}
                      >
                        Submit Quote
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Show message if no opportunities at all */}
          {enquiries.filter(e => !['quoted', 'declined', 'expired'].includes(e.status)).length === 0 && services.length === 0 && (
            <div style={commonStyles.card}>
              <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>
                No new opportunities available at this time.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'my-deals' && (
        <div>
          <h2 style={{ marginBottom: theme.spacing.md }}>My Deals</h2>
          {myDeals.length === 0 ? (
            <div style={commonStyles.card}>
              <p>You're not currently involved in any deals.</p>
              <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.sm }}>
                Deals will appear here when you're selected as a provider, have quote requests, or are assigned to a deal.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {myDeals.map(deal => {
                const involvement = deal.consultant_involvement || {};
                const roleType = deal.consultant_role_type;
                
                return (
                  <div key={deal.id} style={commonStyles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                          <h3 style={{ margin: 0 }}>Deal {deal.deal_id}</h3>
                          {roleType && (
                            <Badge color={theme.colors.primary}>
                              {roleType === 'valuer' ? 'Valuer' : 
                               roleType === 'monitoring_surveyor' ? 'Monitoring Surveyor' :
                               roleType === 'solicitor' ? 'Solicitor' : roleType}
                            </Badge>
                          )}
                          <Badge color={deal.status === 'active' ? theme.colors.success : theme.colors.gray500}>
                            {deal.status}
                          </Badge>
                        </div>
                        <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                          {deal.borrower_name && `Borrower: ${deal.borrower_name}`}
                          {deal.lender_name && ` | Lender: ${deal.lender_name}`}
                        </p>
                        {deal.facility_type && (
                          <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                            Facility: {deal.facility_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                        )}
                        {deal.current_stage_name && (
                          <p style={{ color: theme.colors.textSecondary, margin: `${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm }}>
                            Stage: {deal.current_stage_name}
                          </p>
                        )}
                        <div style={{ marginTop: theme.spacing.sm, display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                          {involvement.via_party && (
                            <Badge color={theme.colors.success} style={{ fontSize: theme.typography.fontSize.xs }}>
                              Active Party
                            </Badge>
                          )}
                          {involvement.via_enquiry && (
                            <Badge color={theme.colors.info} style={{ fontSize: theme.typography.fontSize.xs }}>
                              Quote Request
                            </Badge>
                          )}
                          {involvement.via_quote && (
                            <Badge color={theme.colors.primary} style={{ fontSize: theme.typography.fontSize.xs }}>
                              Quote Submitted
                            </Badge>
                          )}
                          {involvement.via_selection && (
                            <Badge color={theme.colors.success} style={{ fontSize: theme.typography.fontSize.xs }}>
                              Selected
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/deals/${deal.deal_id}`)}
                      >
                        Open Deal Room
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'quotes' && (
        <div>
          <h2 style={{ marginBottom: theme.spacing.md }}>My Quotes</h2>
          {quotes.length === 0 ? (
            <div style={commonStyles.card}>
              <p>You haven't submitted any quotes yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {quotes.map(quote => {
                // Handle both legacy ConsultantQuote and new ProviderQuote formats
                const isProviderQuote = quote.enquiry_id !== undefined;
                const quoteAmount = isProviderQuote ? quote.price_gbp : quote.quote_amount;
                const roleType = isProviderQuote ? quote.role_type_display : (quote.service_type_display || quote.service_type);
                const dealId = isProviderQuote ? quote.deal_id : null;
                const applicationId = quote.application_id;
                const submittedDate = isProviderQuote ? quote.submitted_at : quote.created_at;
                
                return (
                  <div key={quote.id} style={commonStyles.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0 }}>£{parseFloat(quoteAmount).toLocaleString()}</h3>
                        <p style={{ color: theme.colors.textSecondary, margin: theme.spacing.xs + ' 0' }}>
                          {roleType}
                          {dealId && ` - Deal ${dealId}`}
                          {applicationId && ` - Application #${applicationId}`}
                        </p>
                        {isProviderQuote && quote.scope_summary && (
                          <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs }}>
                            {quote.scope_summary.substring(0, 100)}...
                          </p>
                        )}
                        {submittedDate && (
                          <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing.xs }}>
                            Submitted: {new Date(submittedDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, alignItems: 'flex-end' }}>
                        <Badge color={getStatusColor(quote.status)}>
                          {quote.status_display || quote.status.replace('_', ' ')}
                        </Badge>
                        {isProviderQuote && quote.lead_time_days && (
                          <span style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                            {quote.lead_time_days} days
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (isProviderQuote) {
                            navigate(`/consultant/quotes/${quote.id}`);
                          } else {
                            // Legacy quote - handle differently if needed
                            console.log('Legacy quote:', quote.id);
                          }
                        }}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'appointments' && (
        <div>
          <h2 style={{ marginBottom: theme.spacing.md }}>My Appointments</h2>
          {appointments.length === 0 ? (
            <div style={commonStyles.card}>
              <p>You don't have any active appointments.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {appointments.map(appointment => (
                <div key={appointment.id} style={commonStyles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{appointment.service_type_display || appointment.service_type}</h3>
                      <p style={{ color: theme.colors.textSecondary, margin: theme.spacing.xs + ' 0' }}>
                        Application #{appointment.application_id} - Quote: £{parseFloat(appointment.quote_amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <Badge color={getStatusColor(appointment.status)}>
                      {appointment.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {appointment.expected_completion_date && (
                    <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                      Expected completion: {new Date(appointment.expected_completion_date).toLocaleDateString()}
                    </p>
                  )}
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', gap: theme.spacing.sm }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/consultant/appointments/${appointment.id}`}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div>
          <h2 style={{ marginBottom: theme.spacing.md }}>My Profile</h2>
          {profile ? (
            <div style={commonStyles.card}>
              <h3>{profile.organisation_name}</h3>
              <p><strong>Primary Service:</strong> {profile.primary_service_display || profile.primary_service}</p>
              <p><strong>Services Offered:</strong> {profile.services_offered?.join(', ') || 'None'}</p>
              <p><strong>Contact:</strong> {profile.contact_email} | {profile.contact_phone}</p>
              <p><strong>Capacity:</strong> {profile.current_capacity} / {profile.max_capacity}</p>
              <p><strong>Status:</strong> {profile.is_verified ? 'Verified' : 'Pending Verification'}</p>
              <div style={{ marginTop: theme.spacing.md }}>
                <Button variant="primary" onClick={() => window.location.href = '/consultant/profile/edit'}>
                  Edit Profile
                </Button>
              </div>
            </div>
          ) : (
            <div style={commonStyles.card}>
              <p>No profile found. Please complete your profile setup.</p>
              <Button variant="primary" onClick={() => window.location.href = '/consultant/profile/create'}>
                Create Profile
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsultantDashboard;
