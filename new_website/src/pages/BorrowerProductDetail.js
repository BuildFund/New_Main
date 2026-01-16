import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Textarea from '../components/Textarea';

function BorrowerProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id');
  
  const [product, setProduct] = useState(null);
  const [lender, setLender] = useState(null);
  const [isFavourited, setIsFavourited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [enquiryNotes, setEnquiryNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadProduct();
    if (projectId) {
      checkFavouriteStatus();
    }
  }, [id, projectId]);

  async function loadProduct() {
    setLoading(true);
    setError(null);
    try {
      const productRes = await api.get(`/api/products/${id}/`);
      setProduct(productRes.data);
      
      // Lender details should be included in product response, but try separate endpoint as fallback
      if (productRes.data.lender_details) {
        setLender(productRes.data.lender_details);
      } else {
        try {
          const lenderRes = await api.get(`/api/products/${id}/lender-details/`);
          setLender(lenderRes.data);
        } catch (lenderErr) {
          console.warn('Failed to load lender details separately:', lenderErr);
          // Continue without separate lender details - product data should have lender info
          if (productRes.data.lender) {
            // If lender is just an ID, we'll show what we have
            setLender({ id: productRes.data.lender });
          }
        }
      }
    } catch (err) {
      console.error('BorrowerProductDetail loadProduct error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      
      let errorMessage = 'Failed to load product details';
      if (err.response) {
        if (err.response.status === 404) {
          errorMessage = 'Product not found';
        } else if (err.response.status === 401 || err.response.status === 403) {
          errorMessage = 'Authentication failed. Please log in again.';
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          window.location.href = '/login';
          return;
        } else {
          errorMessage = err.response.data?.detail || 
                        err.response.data?.error || 
                        `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage = 'Network Error: Cannot connect to backend server';
      } else {
        errorMessage = err.message || 'Unknown error';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function checkFavouriteStatus() {
    try {
      const res = await api.get(
        `/api/products/favourites/check/?product_id=${id}&project_id=${projectId || ''}`
      );
      setIsFavourited(res.data.favourited);
    } catch (err) {
      console.error('Failed to check favourite status:', err);
    }
  }

  const handleToggleFavourite = async () => {
    try {
      const res = await api.post('/api/products/favourites/toggle/', {
        product_id: id,
        project_id: projectId || null,
      });
      
      setIsFavourited(res.data.favourited);
      setSuccessMessage(
        res.data.favourited 
          ? 'Product added to saved products' 
          : 'Product removed from saved products'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to toggle favourite:', err);
      setError(err.response?.data?.error || 'Failed to save product');
    }
  };

  const handleApply = async () => {
    if (!projectId) {
      setError('Please select a project from the Matches page first');
      return;
    }

    setApplying(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post(`/api/projects/${projectId}/submit-enquiry/`, {
        product_id: id,
        notes: enquiryNotes,
      });
      
      setSuccessMessage('Application submitted successfully! The lender will be notified.');
      setEnquiryNotes('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit application';
      setError(errorMsg);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading product...</p>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
        }}>
          <p>{error}</p>
          <Button onClick={() => navigate('/borrower/matches')} variant="primary">
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.lg, display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Button onClick={() => navigate('/borrower/matches')} variant="outline">
          ← Back to Matches
        </Button>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          {product.name}
        </h1>
        <Badge variant={product.status === 'active' ? 'success' : 'warning'}>
          {product.status}
        </Badge>
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

      {successMessage && (
        <div style={{
          background: theme.colors.successLight,
          color: theme.colors.successDark,
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          marginBottom: theme.spacing.lg,
          border: `1px solid ${theme.colors.success}`,
        }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.xl }}>
        {/* Main Details */}
        <div>
          {/* Product Information */}
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Product Information</h2>
            <div style={{ display: 'grid', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Funding Type:</strong>
                </p>
                <p style={{ margin: 0 }}>{product.funding_type}</p>
              </div>
              {product.property_type && product.property_type !== 'n/a' && (
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Property Type:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{product.property_type}</p>
                </div>
              )}
              {product.description && (
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Description:</strong>
                  </p>
                  <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                    {product.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lender Information */}
          {lender && (
            <div style={commonStyles.card}>
              <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Lender Information</h2>
              <div style={{ display: 'grid', gap: theme.spacing.md }}>
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Organisation Name:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{lender.organisation_name}</p>
                </div>
                {lender.contact_email && (
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Contact Email:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{lender.contact_email}</p>
                  </div>
                )}
                {lender.contact_phone && (
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>Contact Phone:</strong>
                    </p>
                    <p style={{ margin: 0 }}>{lender.contact_phone}</p>
                  </div>
                )}
                {lender.description && (
                  <div>
                    <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                      <strong>About:</strong>
                    </p>
                    <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                      {lender.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loan Terms */}
          <div style={commonStyles.card}>
            <h2 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Loan Terms</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Loan Amount Range:</strong>
                </p>
                <p style={{ margin: 0 }}>
                  £{parseFloat(product.min_loan_amount || 0).toLocaleString()} - 
                  £{parseFloat(product.max_loan_amount || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Interest Rate:</strong>
                </p>
                <p style={{ margin: 0 }}>
                  {product.interest_rate_min}% - {product.interest_rate_max}%
                </p>
              </div>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Term:</strong>
                </p>
                <p style={{ margin: 0 }}>
                  {product.term_min_months} - {product.term_max_months} months
                </p>
              </div>
              {product.max_ltv_ratio && (
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Max LTV Ratio:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{product.max_ltv_ratio}%</p>
                </div>
              )}
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Repayment Structure:</strong>
                </p>
                <p style={{ margin: 0 }}>{product.repayment_structure}</p>
              </div>
            </div>
          </div>

          {/* Eligibility Criteria */}
          {product.eligibility_criteria && (
            <div style={commonStyles.card}>
              <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Eligibility Criteria</h3>
              <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                {product.eligibility_criteria}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <Button
                onClick={handleToggleFavourite}
                variant={isFavourited ? "primary" : "outline"}
                style={{ width: '100%' }}
              >
                {isFavourited ? '★ Remove from Saved' : '☆ Save for Later'}
              </Button>
              {projectId && (
                <>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: theme.spacing.xs,
                      fontWeight: theme.typography.fontWeight.medium,
                    }}>
                      Notes (optional):
                    </label>
                    <Textarea
                      value={enquiryNotes}
                      onChange={(e) => setEnquiryNotes(e.target.value)}
                      placeholder="Add any notes or questions for the lender..."
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={handleApply}
                    disabled={applying}
                    variant="primary"
                    style={{ width: '100%' }}
                  >
                    {applying ? 'Submitting...' : 'Apply Now'}
                  </Button>
                </>
              )}
              {!projectId && (
                <p style={{ 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm,
                  margin: 0,
                }}>
                  Select a project from the Matches page to apply for this product.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BorrowerProductDetail;
