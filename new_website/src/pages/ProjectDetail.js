import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [savedProducts, setSavedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSavedProducts, setLoadingSavedProducts] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (project) {
      loadSavedProducts();
    }
  }, [project]);

  async function loadProject() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/projects/${id}/`);
      setProject(res.data);
    } catch (err) {
      console.error('ProjectDetail loadProject error:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedProducts() {
    setLoadingSavedProducts(true);
    try {
      const res = await api.get(`/api/products/favourites/?project_id=${id}`);
      const favs = res.data?.results || res.data || [];
      setSavedProducts(favs);
    } catch (err) {
      console.error('Failed to load saved products:', err);
      // Don't show error, just continue without saved products
    } finally {
      setLoadingSavedProducts(false);
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      approved: { variant: 'success', label: 'Approved' },
      pending_review: { variant: 'warning', label: 'Pending Review' },
      draft: { variant: 'info', label: 'Draft' },
      declined: { variant: 'error', label: 'Declined' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
        }}>
          <p>{error || 'Project not found'}</p>
          <Button onClick={() => navigate('/borrower/projects')} variant="primary">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.lg, display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <Button onClick={() => navigate('/borrower/projects')} variant="outline">
          ← Back
        </Button>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          Project Details
          {project.project_reference && (
            <Badge variant="info" style={{ marginLeft: theme.spacing.md }}>
              {project.project_reference}
            </Badge>
          )}
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.xl }}>
        {/* Main Details */}
        <div>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
              <h2 style={{ margin: 0, fontSize: theme.typography.fontSize['2xl'] }}>
                {project.description || project.address || `Project #${project.id}`}
              </h2>
              {getStatusBadge(project.status)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Address:</strong>
                </p>
                <p style={{ margin: 0 }}>
                  {project.address}<br />
                  {project.town}, {project.county}<br />
                  {project.postcode}
                </p>
              </div>

              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Funding Type:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.funding_type}</p>

                <p style={{ margin: `${theme.spacing.md} 0 ${theme.spacing.xs}`, color: theme.colors.textSecondary }}>
                  <strong>Property Type:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.property_type}</p>
              </div>
            </div>

            {project.description && (
              <div style={{ marginTop: theme.spacing.lg }}>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Description:</strong>
                </p>
                <p style={{ margin: 0, lineHeight: theme.typography.lineHeight.relaxed }}>
                  {project.description}
                </p>
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.lg }}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Financial Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Loan Amount Required:</strong>
                </p>
                <p style={{ margin: 0, fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold }}>
                  £{parseFloat(project.loan_amount_required || 0).toLocaleString()}
                </p>
              </div>

              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Term Required:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.term_required_months} months</p>
              </div>

              {project.current_market_value && (
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Current Market Value:</strong>
                  </p>
                  <p style={{ margin: 0 }}>
                    £{parseFloat(project.current_market_value).toLocaleString()}
                  </p>
                </div>
              )}

              {project.gross_development_value && (
                <div>
                  <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                    <strong>Gross Development Value:</strong>
                  </p>
                  <p style={{ margin: 0 }}>
                    £{parseFloat(project.gross_development_value).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Development Details */}
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Development Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Development Extent:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.development_extent}</p>
              </div>

              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Tenure:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.tenure}</p>
              </div>

              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Planning Permission:</strong>
                </p>
                <p style={{ margin: 0 }}>
                  {project.planning_permission ? 'Yes' : 'No'}
                </p>
              </div>

              <div>
                <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary }}>
                  <strong>Repayment Method:</strong>
                </p>
                <p style={{ margin: 0 }}>{project.repayment_method}</p>
              </div>
            </div>
          </div>

          {/* Saved Products for this Project */}
          {savedProducts.length > 0 && (
            <div style={commonStyles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
                <h3 style={{ margin: 0 }}>Saved Products for this Project</h3>
                <Badge variant="warning">{savedProducts.length} saved</Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
                {savedProducts.map((fav) => (
                  <div 
                    key={fav.id}
                    style={{
                      padding: theme.spacing.md,
                      border: `1px solid ${theme.colors.gray200}`,
                      borderRadius: theme.borderRadius.md,
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/borrower/products/${fav.product?.id}?project_id=${id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.colors.gray50;
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = theme.colors.gray200;
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: `0 0 ${theme.spacing.xs} 0`, fontSize: theme.typography.fontSize.lg }}>
                          {fav.product?.name || 'Product'}
                        </h4>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Lender:</strong> {fav.product?.lender_details?.organisation_name || 'N/A'}
                        </p>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Loan Range:</strong> £{parseFloat(fav.product?.min_loan_amount || 0).toLocaleString()} - £{parseFloat(fav.product?.max_loan_amount || 0).toLocaleString()}
                        </p>
                        <p style={{ margin: `${theme.spacing.xs} 0`, color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          <strong>Interest Rate:</strong> {fav.product?.interest_rate_min}% - {fav.product?.interest_rate_max}%
                        </p>
                      </div>
                      <Badge variant="warning" style={{ marginLeft: theme.spacing.md }}>⭐ Saved</Badge>
                    </div>
                    {fav.notes && (
                      <div style={{ marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTop: `1px solid ${theme.colors.gray200}` }}>
                        <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                          "{fav.notes}"
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.gray200}` }}>
                <Link to={`/borrower/matches?project_id=${id}`} style={{ textDecoration: 'none' }}>
                  <Button variant="outline" style={{ width: '100%' }}>
                    View All Matches for this Project
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={commonStyles.card}>
            <h3 style={{ margin: `0 0 ${theme.spacing.lg} 0` }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <Link to={`/borrower/matches?project_id=${project.id}`} style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ width: '100%' }}>
                  View Matches
                </Button>
              </Link>
              <Link to={`/borrower/applications?project_id=${project.id}`} style={{ textDecoration: 'none' }}>
                <Button variant="outline" style={{ width: '100%' }}>
                  View Applications
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;
