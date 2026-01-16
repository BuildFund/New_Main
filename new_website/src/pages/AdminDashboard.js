import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import StatCard from '../components/StatCard';
import Button from '../components/Button';
import Badge from '../components/Badge';

function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingProjects: 0,
    approvedProjects: 0,
    totalProducts: 0,
    pendingProducts: 0,
    activeProducts: 0,
    totalApplications: 0,
  });
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    setError(null);
    setLoading(true);
    try {
      const [projRes, prodRes, appRes] = await Promise.all([
        api.get('/api/projects/'),
        api.get('/api/products/'),
        api.get('/api/applications/'),
      ]);
      
      const allProjects = projRes.data || [];
      const allProducts = prodRes.data || [];
      const allApplications = appRes.data || [];

      setProjects(allProjects);
      setProducts(allProducts);
      setApplications(allApplications);

      const pendingProjects = allProjects.filter((p) => p.status === 'pending_review').length;
      const approvedProjects = allProjects.filter((p) => p.status === 'approved').length;
      const pendingProducts = allProducts.filter((p) => p.status === 'pending').length;
      const activeProducts = allProducts.filter((p) => p.status === 'active').length;

      setStats({
        totalProjects: allProjects.length,
        pendingProjects,
        approvedProjects,
        totalProducts: allProducts.length,
        pendingProducts,
        activeProducts,
        totalApplications: allApplications.length,
      });
    } catch (err) {
      console.error('AdminDashboard loadData error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        config: err.config,
      });
      
      let errorMsg = 'Failed to load data';
      
      if (err.response) {
        // Server responded with error status
        errorMsg = err.response.data?.detail || 
                   err.response.data?.error || 
                   `Server error: ${err.response.status} ${err.response.statusText}`;
      } else if (err.request) {
        // Request made but no response (network error, CORS, etc.)
        errorMsg = 'Network Error: Unable to connect to server. Please check: 1) Backend is running on http://localhost:8000, 2) CORS is configured correctly, 3) You are logged in with a valid token.';
      } else {
        // Error setting up request
        errorMsg = err.message || 'Failed to load data';
      }
      
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveProject = async (id) => {
    try {
      await api.post(`/api/projects/${id}/approve/`);
      await loadData();
    } catch (err) {
      setError('Failed to approve project');
    }
  };

  const approveProduct = async (id) => {
    try {
      await api.post(`/api/products/${id}/approve/`);
      await loadData();
    } catch (err) {
      setError('Failed to approve product');
    }
  };

  const pendingProjects = projects.filter((p) => p.status === 'pending_review');
  const pendingProducts = products.filter((p) => p.status === 'pending');

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.sm} 0`,
          color: theme.colors.textPrimary,
        }}>
          Admin Dashboard
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          System overview and pending approvals
        </p>
      </div>

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
        <StatCard title="Pending Projects" value={stats.pendingProjects} icon="⏳" color="warning" onClick={() => navigate('/borrower/projects?status=pending_review')} />
        <StatCard title="Approved Projects" value={stats.approvedProjects} icon="✅" color="success" onClick={() => navigate('/borrower/projects?status=approved')} />
        <StatCard title="Total Products" value={stats.totalProducts} icon="💼" color="primary" onClick={() => navigate('/lender/products')} />
        <StatCard title="Pending Products" value={stats.pendingProducts} icon="⏳" color="warning" onClick={() => navigate('/lender/products?status=pending')} />
        <StatCard title="Active Products" value={stats.activeProducts} icon="✅" color="success" onClick={() => navigate('/lender/products?status=active')} />
        <StatCard title="Total Applications" value={stats.totalApplications} icon="📝" color="secondary" onClick={() => navigate('/lender/applications')} />
      </div>

      {/* Pending Projects */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <h2 style={{
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          Pending Projects ({pendingProjects.length})
        </h2>
        {pendingProjects.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ color: theme.colors.textSecondary }}>
              No pending projects to review.
            </p>
          </div>
        ) : (
          <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={commonStyles.table}>
                <thead style={commonStyles.tableHeader}>
                  <tr>
                    <th style={commonStyles.tableCell}>Description</th>
                    <th style={commonStyles.tableCell}>Address</th>
                    <th style={commonStyles.tableCell}>Loan Amount</th>
                    <th style={commonStyles.tableCell}>Term (months)</th>
                    <th style={commonStyles.tableCell}>Borrower</th>
                    <th style={commonStyles.tableCell}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProjects.map((p) => (
                    <tr 
                      key={p.id} 
                      style={{ 
                        borderBottom: `1px solid ${theme.colors.gray200}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => window.location.href = `/borrower/projects/${p.id}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme.colors.gray50;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={commonStyles.tableCell}>
                        {p.description || p.development_extent || 'N/A'}
                        {p.project_reference && (
                          <Badge variant="info" style={{ marginLeft: theme.spacing.xs }}>
                            {p.project_reference}
                          </Badge>
                        )}
                      </td>
                      <td style={commonStyles.tableCell}>{p.address || 'N/A'}</td>
                      <td style={commonStyles.tableCell}>£{parseFloat(p.loan_amount_required || 0).toLocaleString()}</td>
                      <td style={commonStyles.tableCell}>{p.term_required_months || 'N/A'}</td>
                      <td style={commonStyles.tableCell}>{p.borrower || 'N/A'}</td>
                      <td style={commonStyles.tableCell} onClick={(e) => e.stopPropagation()}>
                        <Button variant="success" size="sm" onClick={() => approveProject(p.id)}>
                          Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pending Products */}
      <div style={{ marginBottom: theme.spacing['2xl'] }}>
        <h2 style={{
          fontSize: theme.typography.fontSize['2xl'],
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.lg} 0`,
          color: theme.colors.textPrimary,
        }}>
          Pending Products ({pendingProducts.length})
        </h2>
        {pendingProducts.length === 0 ? (
          <div style={{
            ...commonStyles.card,
            textAlign: 'center',
            padding: theme.spacing['2xl'],
          }}>
            <p style={{ color: theme.colors.textSecondary }}>
              No pending products to review.
            </p>
          </div>
        ) : (
          <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={commonStyles.table}>
                <thead style={commonStyles.tableHeader}>
                  <tr>
                    <th style={commonStyles.tableCell}>Name</th>
                    <th style={commonStyles.tableCell}>Funding Type</th>
                    <th style={commonStyles.tableCell}>Property Type</th>
                    <th style={commonStyles.tableCell}>Loan Range (£)</th>
                    <th style={commonStyles.tableCell}>Interest (%)</th>
                    <th style={commonStyles.tableCell}>LTV (%)</th>
                    <th style={commonStyles.tableCell}>Lender</th>
                    <th style={commonStyles.tableCell}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProducts.map((prod) => (
                    <tr 
                      key={prod.id} 
                      style={{ 
                        borderBottom: `1px solid ${theme.colors.gray200}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => window.location.href = `/lender/products/${prod.id}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme.colors.gray50;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={commonStyles.tableCell}>{prod.name}</td>
                      <td style={commonStyles.tableCell}>{prod.funding_type}</td>
                      <td style={commonStyles.tableCell}>{prod.property_type}</td>
                      <td style={commonStyles.tableCell}>
                        £{parseFloat(prod.min_loan_amount || 0).toLocaleString()} - £{parseFloat(prod.max_loan_amount || 0).toLocaleString()}
                      </td>
                      <td style={commonStyles.tableCell}>
                        {prod.interest_rate_min}% - {prod.interest_rate_max}%
                      </td>
                      <td style={commonStyles.tableCell}>{prod.max_ltv_ratio}%</td>
                      <td style={commonStyles.tableCell}>{prod.lender || 'N/A'}</td>
                      <td style={commonStyles.tableCell} onClick={(e) => e.stopPropagation()}>
                        <Button variant="success" size="sm" onClick={() => approveProduct(prod.id)}>
                          Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div style={{
        ...commonStyles.card,
        background: theme.colors.gray50,
      }}>
        <h3 style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          margin: `0 0 ${theme.spacing.md} 0`,
        }}>
          Admin Navigation
        </h3>
        <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <Link to="/admin/private-equity" style={{ textDecoration: 'none' }}>
            <Button variant="outline">
              Private Equity Management
            </Button>
          </Link>
          <a href="http://localhost:8000/admin/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="outline">
              Django Admin Panel
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
