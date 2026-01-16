import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Badge from '../components/Badge';
import ProfilePreview from '../components/ProfilePreview';

function LenderDashboard({ onboardingProgress, onStartOnboarding, onStartChatbot }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
    totalApplications: 0,
    pendingApplications: 0,
    acceptedApplications: 0,
    totalInvestments: 0,
  });
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentApplications, setRecentApplications] = useState([]);
  const [recentMessages, setRecentMessages] = useState([]);
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
      // Load products (required)
      let products = [];
      try {
        const productsRes = await api.get('/api/products/');
        products = productsRes.data || [];
      } catch (err) {
        console.error('Failed to load products:', err);
        throw new Error(`Failed to load products: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
      
      // Load applications (required)
      let applications = [];
      try {
        const applicationsRes = await api.get('/api/applications/');
        applications = applicationsRes.data || [];
      } catch (err) {
        console.error('Failed to load applications:', err);
        throw new Error(`Failed to load applications: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
      }
      
      // Load investments (optional - don't fail if this fails)
      let investments = [];
      try {
        const investmentsRes = await api.get('/api/private-equity/investments/');
        investments = investmentsRes.data || [];
      } catch (err) {
        console.warn('Failed to load investments (optional):', err);
        // Continue without investments - this is optional
        investments = [];
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
        console.warn('Failed to load messages:', err);
        // Don't fail completely if messages fail
      }

      const activeProducts = products.filter(p => p.status === 'active').length;
      const pendingProducts = products.filter(p => p.status === 'pending').length;
      const pendingApplications = applications.filter(a => a.status === 'pending' || a.status === 'under_review').length;
      const acceptedApplications = applications.filter(a => a.status === 'accepted').length;

      setStats({
        totalProducts: products.length,
        activeProducts,
        pendingProducts,
        totalApplications: applications.length,
        pendingApplications,
        acceptedApplications,
        totalInvestments: investments.length,
      });

      setRecentProducts(products.slice(0, 5));
      setRecentApplications(applications.slice(0, 5));
      setRecentMessages(messages.slice(0, 5));
      setUnreadCount(unread);

    } catch (err) {
      console.error('Dashboard load error:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
      setError(`Failed to load dashboard data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { variant: 'success', label: 'Active' },
      pending: { variant: 'warning', label: 'Pending' },
      accepted: { variant: 'success', label: 'Accepted' },
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
          Overview of your products, applications, and investments
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

      {/* Profile Preview */}
      <div style={{ marginBottom: theme.spacing.lg }}>
        <ProfilePreview role="Lender" profileRoute="/lender/profile" />
      </div>

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: theme.spacing.lg, 
        marginBottom: theme.spacing['2xl'] 
      }}>
        <StatCard title="Total Products" value={stats.totalProducts} icon="💼" color="primary" onClick={() => navigate('/lender/products')} />
        <StatCard title="Active Products" value={stats.activeProducts} icon="✅" color="success" onClick={() => navigate('/lender/products?status=active')} />
        <StatCard title="Pending Approval" value={stats.pendingProducts} icon="⏳" color="warning" onClick={() => navigate('/lender/products?status=pending')} />
        <StatCard title="Total Applications" value={stats.totalApplications} icon="📝" color="secondary" onClick={() => navigate('/lender/applications')} />
        <StatCard title="Pending Review" value={stats.pendingApplications} icon="⏳" color="warning" onClick={() => navigate('/lender/applications?status=pending')} />
        <StatCard title="Accepted" value={stats.acceptedApplications} icon="✅" color="success" onClick={() => navigate('/lender/applications?status=accepted')} />
        <StatCard title="PE Investments" value={stats.totalInvestments} icon="💼" color="accent" onClick={() => navigate('/lender/private-equity')} />
        <StatCard title="Unread Messages" value={unreadCount} icon="💬" color={unreadCount > 0 ? "warning" : "info"} onClick={() => navigate('/lender/messages')} />
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
          <Link to="/lender/products/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              + Create New Product
            </Button>
          </Link>
          <Link to="/lender/applications" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              View Applications
            </Button>
          </Link>
          <Link to="/lender/private-equity" style={{ textDecoration: 'none' }}>
            <Button variant="outline" size="lg">
              Browse PE Opportunities
            </Button>
          </Link>
        </div>
      </div>

      {/* Recent Products */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: 0,
            color: theme.colors.textPrimary,
          }}>
            Recent Products
          </h2>
          <Link to="/lender/products" style={{ 
            color: theme.colors.primary, 
            textDecoration: 'none',
            fontWeight: theme.typography.fontWeight.medium,
          }}>
            View All →
          </Link>
        </div>
        {recentProducts.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ color: theme.colors.textSecondary, margin: `0 0 ${theme.spacing.md} 0` }}>
              No products yet.
            </p>
            <Link to="/lender/products/new" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Create your first product</Button>
            </Link>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: theme.spacing.lg 
          }}>
            {recentProducts.map((product) => (
              <Link
                key={product.id}
                to={`/lender/products/${product.id}`}
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
                    {product.name}
                  </h3>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Type:</strong> {product.funding_type} - {product.property_type}
                  </p>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Loan Range:</strong> £{parseFloat(product.min_loan_amount || 0).toLocaleString()} - £{parseFloat(product.max_loan_amount || 0).toLocaleString()}
                  </p>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                    <strong>Interest:</strong> {product.interest_rate_min}% - {product.interest_rate_max}%
                  </p>
                  <div style={{ marginTop: theme.spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {getStatusBadge(product.status)}
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

      {/* Active Deals */}
      {recentApplications.filter(a => a.status === 'accepted' && a.deal_deal_id).length > 0 && (
        <div style={{ marginBottom: theme.spacing['2xl'] }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
            <h2 style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: theme.typography.fontWeight.semibold,
              margin: 0,
              color: theme.colors.textPrimary,
            }}>
              Active Deals
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: theme.spacing.md }}>
            {recentApplications
              .filter(a => a.status === 'accepted' && a.deal_deal_id)
              .slice(0, 6)
              .map(deal => (
                <Link 
                  key={deal.id}
                  to={`/lender/deals/${deal.deal_deal_id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    ...commonStyles.card,
                    padding: theme.spacing.lg,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: `2px solid ${theme.colors.primary}`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = theme.shadows.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = theme.shadows.sm;
                  }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: theme.spacing.sm }}>
                      <h3 style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                        {deal.deal_deal_id || `Deal #${deal.deal_id}`}
                      </h3>
                      <Badge variant="success">Active</Badge>
                    </div>
                    <p style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {deal.project_details?.address || `Project #${deal.project}`}
                    </p>
                    <p style={{ margin: 0, fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium }}>
                      £{parseFloat(deal.proposed_loan_amount || 0).toLocaleString('en-GB')}
                    </p>
                  </div>
                </Link>
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
            <Link to="/lender/applications" style={{ 
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
                  <th style={commonStyles.tableCell}>Product</th>
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
                    onClick={() => window.location.href = `/lender/applications/${app.id}`}
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
                      {app.product_details?.name || app.product || 'N/A'}
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
          <Link to="/lender/messages" style={{ 
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
            <Link to="/lender/messages" style={{ textDecoration: 'none' }}>
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
                        onClick={() => window.location.href = `/lender/messages?application_id=${message.application}`}
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

export default LenderDashboard;
