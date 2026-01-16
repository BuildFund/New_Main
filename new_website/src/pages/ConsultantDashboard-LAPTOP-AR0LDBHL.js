import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import ProfilePreview from '../components/ProfilePreview';

function ConsultantDashboard() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('opportunities'); // opportunities, quotes, appointments, profile

  const [onboardingProgress, setOnboardingProgress] = useState(null);

  useEffect(() => {
    loadDashboardData();
    checkOnboardingProgress();
  }, []);

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

      // Load service opportunities
      const servicesRes = await api.get('/api/consultants/services/');
      setServices(servicesRes.data.results || servicesRes.data || []);

      // Load quotes
      const quotesRes = await api.get('/api/consultants/quotes/');
      setQuotes(quotesRes.data.results || quotesRes.data || []);

      // Load appointments
      const appointmentsRes = await api.get('/api/consultants/appointments/');
      setAppointments(appointmentsRes.data.results || appointmentsRes.data || []);
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

      {/* Profile Preview */}
      <div style={{ marginBottom: theme.spacing.lg }}>
        <ProfilePreview role="Consultant" profileRoute="/consultant/profile" />
      </div>

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
          onClick={() => setActiveTab('opportunities')}
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
            {services.length}
          </h3>
          <p style={{ margin: theme.spacing.xs + ' 0 0 0', color: theme.colors.textSecondary }}>
            Service Opportunities
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
            {quotes.length}
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
          onClick={() => setActiveTab('appointments')}
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
            {appointments.filter(a => a.status === 'in_progress' || a.status === 'appointed').length}
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
        {['opportunities', 'quotes', 'appointments', 'profile'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
          <h2 style={{ marginBottom: theme.spacing.md }}>Service Opportunities</h2>
          {services.length === 0 ? (
            <div style={commonStyles.card}>
              <p>No service opportunities available at this time.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {services.map(service => (
                <div key={service.id} style={commonStyles.card}>
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
              {quotes.map(quote => (
                <div key={quote.id} style={commonStyles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                    <div>
                      <h3 style={{ margin: 0 }}>£{parseFloat(quote.quote_amount).toLocaleString()}</h3>
                      <p style={{ color: theme.colors.textSecondary, margin: theme.spacing.xs + ' 0' }}>
                        {quote.service_type_display || quote.service_type} - Application #{quote.application_id}
                      </p>
                    </div>
                    <Badge color={getStatusColor(quote.status)}>
                      {quote.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  {quote.estimated_completion_date && (
                    <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                      Estimated completion: {new Date(quote.estimated_completion_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
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
