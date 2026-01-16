import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Badge from '../components/Badge';

function BorrowerDashboard({ onboardingProgress, onStartOnboarding, onStartChatbot }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingProjects: 0,
    approvedProjects: 0,
    totalMatches: 0,
    totalApplications: 0,
    pendingApplications: 0,
    privateEquityOpportunities: 0,
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
  const [recentSavedProducts, setRecentSavedProducts] = useState([]);
  const [savedProductsCount, setSavedProductsCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      // Don't check token here - let the API interceptor handle authentication
      // If token is missing, the API call will fail and interceptor will handle it
      console.log('Loading dashboard data');
      console.log('API base URL:', api.defaults.baseURL);
      
      // Load projects
      let projects = [];
      try {
        console.log('Fetching projects from:', `${api.defaults.baseURL}/api/projects/`);
        const projectsRes = await api.get('/api/projects/');
        projects = projectsRes.data || [];
        console.log('Projects loaded successfully:', projects.length);
      } catch (err) {
        console.error('Failed to load projects:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response,
          request: err.request,
          code: err.code,
          config: err.config,
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to load projects';
        if (err.response) {
          // Server responded with error
          // Don't log out from dashboard - let the api interceptor handle it
          // Just show the error message
          if (err.response.status === 401) {
            errorMessage = 'Authentication failed. Please check your login.';
            console.warn('401 error on dashboard - not logging out here, letting interceptor handle it');
            // Don't log out here - let api.js interceptor handle it
          } else if (err.response.status === 403) {
            errorMessage = 'You do not have permission to access this resource.';
            console.warn('Permission denied (403) - not logging out');
          } else {
            errorMessage = err.response.data?.detail || 
                          err.response.data?.error || 
                          `Server error: ${err.response.status}`;
          }
        } else if (err.request) {
          // Request made but no response (network error, CORS, etc.)
          // Check if it's a CORS error specifically
          if (err.message && err.message.includes('CORS') || err.code === 'ERR_BLOCKED_BY_CLIENT') {
            errorMessage = `CORS Error: The backend server is blocking requests from the frontend. Please check CORS configuration in Django settings (CORS_ALLOWED_ORIGINS should include http://localhost:3000).`;
          } else {
            errorMessage = `Network Error: Cannot connect to backend server. Please check: 1) Backend is running on http://localhost:8000, 2) CORS is configured correctly, 3) You are logged in with a valid token. Error: ${err.message || 'Unknown'}`;
          }
          // Don't log out on network errors - just show the error
          // Network errors are usually temporary and don't mean the token is invalid
          console.error('Network error loading projects:', err);
          setError(errorMessage);
          setLoading(false);
          return; // Don't throw - allow user to stay logged in
        } else {
          // Error setting up request
          errorMessage = err.message || 'Unknown error';
        }
        console.error('Dashboard load error details:', {
          message: err.message,
          code: err.code,
          response: err.response?.data,
          status: err.response?.status,
          request: err.request,
        });
        throw new Error(errorMessage);
      }
      
      // Load applications
      let applications = [];
      try {
        const applicationsRes = await api.get('/api/applications/');
        applications = applicationsRes.data || [];
      } catch (err) {
        console.error('Failed to load applications:', err);
        // Don't fail completely if applications fail, just log it
        console.warn('Applications failed to load, continuing without them');
      }
      
      // Load private equity opportunities (optional)
      let opportunities = [];
      try {
        const peRes = await api.get('/api/private-equity/opportunities/');
        opportunities = peRes.data || [];
      } catch (err) {
        // Don't fail completely if PE fails, just continue with 0
        // Don't log out on 401/403 - these are optional
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.warn('Permission/authentication error loading PE opportunities - continuing without them');
        } else {
          console.warn('Failed to load private equity opportunities:', err);
        }
      }

      // Load recent messages and unread count (optional)
      let messages = [];
      let unread = 0;
      try {
        const messagesRes = await api.get('/api/messaging/messages/');
        // Handle paginated or non-paginated responses
        const allMessages = messagesRes.data?.results || messagesRes.data || [];
        messages = allMessages.slice(0, 5); // Get first 5
        const unreadRes = await api.get('/api/messaging/messages/unread_count/');
        unread = unreadRes.data?.unread_count || 0;
      } catch (err) {
        // Don't fail completely if messages fail
        // Don't log out on 401/403 - these are optional
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.warn('Permission/authentication error loading messages - continuing without them');
        } else {
          console.warn('Failed to load messages:', err);
        }
      }

      const pendingProjects = projects.filter(p => p.status === 'pending_review' || p.status === 'draft').length;
      const approvedProjects = projects.filter(p => p.status === 'approved').length;
      
      let totalMatches = 0;
      for (const project of projects.filter(p => p.status === 'approved')) {
        try {
          const matchesRes = await api.get(`/api/projects/${project.id}/matched-products/`);
          totalMatches += (matchesRes.data || []).length;
        } catch (e) {
          // Continue if matches fail for a specific project
          console.warn(`Failed to load matches for project ${project.id}:`, e);
        }
      }

      const pendingApplications = applications.filter(a => a.status === 'pending' || a.status === 'under_review').length;

      // Load saved products (favourites)
      let savedProducts = [];
      let savedCount = 0;
      try {
        const favouritesRes = await api.get('/api/products/favourites/');
        savedProducts = favouritesRes.data?.results || favouritesRes.data || [];
        savedCount = savedProducts.length;
      } catch (err) {
        // Continue without saved products
        // Don't log out on 401/403 - these are optional
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.warn('Permission/authentication error loading saved products - continuing without them');
        } else {
          console.warn('Failed to load saved products:', err);
        }
      }

      setStats({
        totalProjects: projects.length,
        pendingProjects,
        approvedProjects,
        totalMatches,
        totalApplications: applications.length,
        pendingApplications,
        privateEquityOpportunities: opportunities.length,
        savedProducts: savedCount,
      });

      setRecentProjects(projects.slice(0, 5));
      setRecentApplications(applications.slice(0, 5));
      setRecentMessages(messages.slice(0, 5));
      setRecentSavedProducts(savedProducts.slice(0, 5));
      setSavedProductsCount(savedCount);
      setUnreadCount(unread);

    } catch (err) {
      console.error('Dashboard load error:', err);
      const errorMsg = err.response?.data?.detail || 
                      err.response?.data?.error || 
                      err.message || 
                      'Failed to load dashboard data';
      setError(`Failed to load dashboard data: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      approved: { variant: 'success', label: 'Approved' },
      pending_review: { variant: 'warning', label: 'Pending' },
      draft: { variant: 'info', label: 'Draft' },
      accepted: { variant: 'success', label: 'Accepted' },
      pending: { variant: 'warning', label: 'Pending' },
      under_review: { variant: 'info', label: 'Under Review' },
      declined: { variant: 'error', label: 'Declined' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div style={{ ...commonStyles.container, textAlign: 'center', padding: theme.spacing['3xl'] }}>
        <p style={{ color: theme.colors.textSecondary }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.textPrimary,
          margin: `0 0 ${theme.spacing.sm} 0`,
        }}>
          Dashboard
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          Overview of your projects, matches, and applications
        </p>
      </div>

      {/* Onboarding Progress Bar - Clickable */}
      {onboardingProgress && (!onboardingProgress.is_complete || onboardingProgress.completion_percentage < 100) && (
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
          onClick={onStartOnboarding}
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
            height: '12px',
            background: theme.colors.gray200,
            borderRadius: theme.borderRadius.full,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${onboardingProgress.completion_percentage}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
              borderRadius: theme.borderRadius.full,
              transition: 'width 0.3s ease',
            }} />
          </div>
          
          <div style={{
            marginTop: theme.spacing.sm,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary,
            fontStyle: 'italic',
          }}>
            Click to continue your onboarding →
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.error}`,
        }}>
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: theme.spacing.lg, 
        marginBottom: theme.spacing['2xl'] 
      }}>
        <StatCard title="Total Projects" value={stats.totalProjects} icon="🏗️" color="primary" onClick={() => navigate('/borrower/projects')} />
        <StatCard title="Pending Review" value={stats.pendingProjects} icon="⏳" color="warning" onClick={() => navigate('/borrower/projects?status=pending_review')} />
        <StatCard title="Approved" value={stats.approvedProjects} icon="✅" color="success" onClick={() => navigate('/borrower/projects?status=approved')} />
        <StatCard title="Matched Products" value={stats.totalMatches} icon="🔍" color="info" onClick={() => navigate('/borrower/matches')} />
        <StatCard title="Saved Products" value={stats.savedProducts || 0} icon="⭐" color="warning" onClick={() => navigate('/borrower/matches')} />
        <StatCard title="Applications" value={stats.totalApplications} icon="📝" color="secondary" onClick={() => navigate('/borrower/applications')} />
        <StatCard title="PE Opportunities" value={stats.privateEquityOpportunities} icon="💼" color="accent" onClick={() => navigate('/borrower/private-equity')} />
        <StatCard title="Unread Messages" value={unreadCount} icon="💬" color={unreadCount > 0 ? "warning" : "info"} onClick={() => navigate('/borrower/messages')} />
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <h2 style={{
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <Link to="/borrower/projects/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              + Create New Project
            </Button>
          </Link>
          <Link to="/borrower/private-equity" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              + Create PE Opportunity
            </Button>
          </Link>
          <Link to="/borrower/matches" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="lg">
              View Matched Products
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Projects */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: 0,
            color: theme.colors.textPrimary,
          }}>
            Recent Projects
          </h2>
          <Link to="/borrower/projects" style={{ 
            color: theme.colors.primary, 
            textDecoration: 'none',
            fontWeight: theme.typography.fontWeight.medium,
          }}>
            View All →
          </Link>
        </div>
        {recentProjects.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ color: theme.colors.textSecondary, margin: `0 0 ${theme.spacing.md} 0` }}>
              No projects yet.
            </p>
            <Link to="/borrower/projects/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Create your first project</Button>
            </Link>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: theme.spacing.lg 
          }}>
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/borrower/projects/${project.id}`}
                style={{ textDecoration: 'none' }}
              >
                <div 
                  style={{
                    ...commonStyles.card,
                    ...commonStyles.cardHover,
                    cursor: 'pointer',
                  }}
                >
                  <h3 style={{ 
                    margin: `0 0 ${theme.spacing.sm} 0`, 
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.textPrimary,
                  }}>
                    {project.description || project.address || `Project #${project.id}`}
                    {project.project_reference && (
                      <Badge variant="info" style={{ marginLeft: theme.spacing.sm }}>
                        {project.project_reference}
                      </Badge>
                    )}
                  </h3>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Address:</strong> {project.address}, {project.town}
                  </p>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Loan Amount:</strong> £{parseFloat(project.loan_amount_required || 0).toLocaleString()}
                  </p>
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {getStatusBadge(project.status || 'draft')}
                    <span style={{ 
                      color: theme.colors.primary, 
                      fontSize: theme.typography.fontSize.sm,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}>
                      View Details →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Saved Products */}
      {recentSavedProducts.length > 0 && (
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: 0,
              color: theme.colors.textPrimary,
            }}>
              Recent Saved Products
            </h2>
            <Link to="/borrower/matches" style={{ 
              color: theme.colors.primary, 
              textDecoration: 'none',
              fontWeight: theme.typography.fontWeight.medium,
            }}>
              View All →
            </Link>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: theme.spacing.lg,
          }}>
            {recentSavedProducts.map((fav) => (
              <div key={fav.id} style={commonStyles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.md }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.semibold,
                  }}>
                    {fav.product?.name || 'Product'}
                  </h3>
                  <Badge variant="warning">⭐ Saved</Badge>
                </div>
                <div style={{ marginBottom: theme.spacing.md }}>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Lender:</strong> {fav.product?.lender_details?.organisation_name || 'N/A'}
                  </p>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Funding Type:</strong> {fav.product?.funding_type || 'N/A'}
                  </p>
                  {fav.project && (
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                      <strong>For Project:</strong> {fav.project?.description || fav.project?.address || `Project #${fav.project?.id}`}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: theme.spacing.xs }}>
                  {fav.product && (
                    <Link to={`/borrower/products/${fav.product.id}${fav.project ? `?project_id=${fav.project.id}` : ''}`} style={{ textDecoration: 'none', flex: 1 }}>
                      <Button variant="outline" size="sm" style={{ width: '100%' }}>
                        View Details
                      </Button>
                    </Link>
                  )}
                  <Link to="/borrower/matches" style={{ textDecoration: 'none', flex: 1 }}>
                    <Button variant="primary" size="sm" style={{ width: '100%' }}>
                      View All Saved
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Applications */}
      {recentApplications.length > 0 && (
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: 0,
              color: theme.colors.textPrimary,
            }}>
              Recent Applications
            </h2>
            <Link to="/borrower/applications" style={{ 
              color: theme.colors.primary, 
              textDecoration: 'none',
              fontWeight: theme.typography.fontWeight.medium,
            }}>
              View All →
            </Link>
          </div>
          <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>Project</th>
                  <th style={commonStyles.tableCell}>Lender</th>
                  <th style={commonStyles.tableCell}>Loan Amount</th>
                  <th style={commonStyles.tableCell}>Interest Rate</th>
                  <th style={commonStyles.tableCell}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApplications.map((app) => (
                  <tr 
                    key={app.id} 
                    style={{ 
                      borderBottom: `1px solid ${theme.colors.gray200}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => window.location.href = `/borrower/applications/${app.id}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={commonStyles.tableCell}>
                      {app.project_details?.address || app.project || `Project #${app.project}`}
                    </td>
                    <td style={commonStyles.tableCell}>
                      {app.lender_details?.organisation_name || app.lender || 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>£{parseFloat(app.proposed_loan_amount || 0).toLocaleString()}</td>
                    <td style={commonStyles.tableCell}>
                      {app.proposed_interest_rate ? `${app.proposed_interest_rate}%` : 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>{getStatusBadge(app.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Messages */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: 0,
            color: theme.colors.textPrimary,
          }}>
            Recent Messages {unreadCount > 0 && (
              <Badge variant="warning" style={{ marginLeft: theme.spacing.sm }}>
                {unreadCount} unread
              </Badge>
            )}
          </h2>
          <Link to="/borrower/messages" style={{ 
            color: theme.colors.primary, 
            textDecoration: 'none',
            fontWeight: theme.typography.fontWeight.medium,
          }}>
            View All →
          </Link>
        </div>
        {recentMessages.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ color: theme.colors.textSecondary, margin: `0 0 ${theme.spacing.md} 0` }}>
              No messages yet.
            </p>
            <Link to="/borrower/messages" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Go to Messages</Button>
            </Link>
          </div>
        ) : (
          <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={commonStyles.table}>
                <thead style={commonStyles.tableHeader}>
                  <tr>
                    <th style={commonStyles.tableCell}>From/To</th>
                    <th style={commonStyles.tableCell}>Subject</th>
                    <th style={commonStyles.tableCell}>Project Ref</th>
                    <th style={commonStyles.tableCell}>Application</th>
                    <th style={commonStyles.tableCell}>Date</th>
                    <th style={commonStyles.tableCell}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMessages.map((message) => {
                    const isSent = message.sender_username === localStorage.getItem('username');
                    const otherParty = isSent ? message.recipient_username : message.sender_username;
                    return (
                      <tr 
                        key={message.id} 
                        style={{ 
                          borderBottom: `1px solid ${theme.colors.gray200}`,
                          cursor: 'pointer',
                          background: !message.is_read && !isSent ? theme.colors.primaryLight : 'transparent',
                        }}
                        onClick={() => window.location.href = `/borrower/messages?application_id=${message.application}`}
                        onMouseEnter={(e) => {
                          if (message.is_read || isSent) {
                            e.currentTarget.style.background = theme.colors.gray50;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (message.is_read || isSent) {
                            e.currentTarget.style.background = 'transparent';
                          } else {
                            e.currentTarget.style.background = theme.colors.primaryLight;
                          }
                        }}
                      >
                        <td style={commonStyles.tableCell}>
                          {isSent ? 'To: ' : 'From: '}{otherParty}
                        </td>
                        <td style={commonStyles.tableCell}>
                          {message.subject || '(No subject)'}
                          {!message.is_read && !isSent && (
                            <Badge variant="warning" style={{ marginLeft: theme.spacing.xs }}>New</Badge>
                          )}
                        </td>
                        <td style={commonStyles.tableCell}>
                          {message.project_reference ? (
                            <Badge variant="info">{message.project_reference}</Badge>
                          ) : (
                            'N/A'
                          )}
                        </td>
                        <td style={commonStyles.tableCell}>
                          Application #{message.application}
                        </td>
                        <td style={{ ...commonStyles.tableCell, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                          {new Date(message.created_at).toLocaleDateString()}
                        </td>
                        <td style={commonStyles.tableCell}>
                          {message.is_read ? (
                            <Badge variant="info">Read</Badge>
                          ) : isSent ? (
                            <Badge variant="info">Sent</Badge>
                          ) : (
                            <Badge variant="warning">Unread</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BorrowerDashboard;
