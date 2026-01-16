import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function LenderProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState({});

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    setLoading(true);
    try {
      const response = await api.get('/api/products/');
      setProducts(response.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (productId, newStatus) => {
    setUpdatingStatus({ ...updatingStatus, [productId]: true });
    try {
      await api.patch(`/api/products/${productId}/`, { status: newStatus });
      // Update local state
      setProducts(products.map(p => 
        p.id === productId ? { ...p, status: newStatus } : p
      ));
    } catch (err) {
      console.error('Failed to update product status:', err);
      setError(err.response?.data?.error || 'Failed to update product status');
    } finally {
      setUpdatingStatus({ ...updatingStatus, [productId]: false });
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { variant: 'info', label: 'Draft' },
      active: { variant: 'success', label: 'Active' },
      pending: { variant: 'warning', label: 'Pending' },
      inactive: { variant: 'info', label: 'Inactive' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading products...</p>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl }}>
        <div>
          <h1 style={{
            fontSize: theme.typography.fontSize['4xl'],
            fontWeight: theme.typography.fontWeight.bold,
            margin: `0 0 ${theme.spacing.sm} 0`,
            color: theme.colors.textPrimary,
          }}>
            My Products
          </h1>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.base,
            margin: 0,
          }}>
            Manage your finance products
          </p>
        </div>
        <Link to="/lender/products/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="lg">
            + Create New Product
          </Button>
        </Link>
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

      {products.length === 0 ? (
        <div style={{
          ...commonStyles.card,
          textAlign: 'center',
          padding: theme.spacing['3xl'],
        }}>
          <p style={{ 
            color: theme.colors.textSecondary, 
            fontSize: theme.typography.fontSize.lg,
            margin: `0 0 ${theme.spacing.lg} 0`,
          }}>
            No products found.
          </p>
          <Link to="/lender/products/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              Create Your First Product
            </Button>
          </Link>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: theme.spacing.lg 
        }}>
          {products.map((product) => (
            <div 
              key={product.id} 
              style={{
                ...commonStyles.card,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md }}>
                <h3 
                  style={{ 
                    margin: 0, 
                    fontSize: theme.typography.fontSize.xl,
                    fontWeight: theme.typography.fontWeight.semibold,
                    color: theme.colors.textPrimary,
                    flex: 1,
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/lender/products/${product.id}`)}
                >
                  {product.name}
                </h3>
                {getStatusBadge(product.status)}
              </div>

              <div 
                style={{ 
                  marginBottom: theme.spacing.md,
                  cursor: 'pointer',
                  flex: 1,
                }}
                onClick={() => navigate(`/lender/products/${product.id}`)}
              >
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Type:</strong> {product.funding_type} - {product.property_type}
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Loan Range:</strong> £{parseFloat(product.min_loan_amount || 0).toLocaleString()} - £{parseFloat(product.max_loan_amount || 0).toLocaleString()}
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Interest Rate:</strong> {product.interest_rate_min}% - {product.interest_rate_max}%
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Term:</strong> {product.term_min_months} - {product.term_max_months} months
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Max LTV:</strong> {product.max_ltv_ratio}%
                </p>

                {product.description && (
                  <p style={{ 
                    margin: `${theme.spacing.md} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm,
                    fontStyle: 'italic',
                  }}>
                    {product.description.substring(0, 100)}{product.description.length > 100 ? '...' : ''}
                  </p>
                )}
              </div>

              <div style={{ 
                display: 'flex', 
                gap: theme.spacing.sm, 
                marginTop: theme.spacing.md,
                paddingTop: theme.spacing.md,
                borderTop: `1px solid ${theme.colors.gray200}`,
              }}
              onClick={(e) => e.stopPropagation()}
              >
                <select
                  value={product.status}
                  onChange={(e) => handleStatusChange(product.id, e.target.value)}
                  disabled={updatingStatus[product.id]}
                  style={{ 
                    flex: 1, 
                    fontSize: theme.typography.fontSize.sm,
                    padding: theme.spacing.sm,
                    border: `1px solid ${theme.colors.gray300}`,
                    borderRadius: theme.borderRadius.md,
                    background: theme.colors.white,
                    color: theme.colors.textPrimary,
                    cursor: updatingStatus[product.id] ? 'not-allowed' : 'pointer',
                  }}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/lender/products/${product.id}/edit`);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/lender/products/${product.id}`);
                  }}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LenderProducts;
