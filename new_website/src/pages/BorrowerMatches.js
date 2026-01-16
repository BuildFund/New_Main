import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Select from '../components/Select';
import Button from '../components/Button';
import Textarea from '../components/Textarea';

function BorrowerMatches() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get('project_id');
  
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(projectIdFromUrl || '');
  const [matches, setMatches] = useState([]);
  const [favourites, setFavourites] = useState([]);
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' or 'saved'
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favouritesLoading, setFavouritesLoading] = useState(false);
  const [submittingEnquiry, setSubmittingEnquiry] = useState({});
  const [enquiryNotes, setEnquiryNotes] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const [favouriteStatus, setFavouriteStatus] = useState({}); // Track which products are favourited

  useEffect(() => {
    fetchProjects();
    if (activeTab === 'saved') {
      loadFavourites();
    }
  }, [activeTab]);

  // Auto-load matches if project_id is provided in URL
  useEffect(() => {
    if (projectIdFromUrl && projects.length > 0 && !matches.length) {
      // Set the selected project and trigger match loading
      setSelectedProject(projectIdFromUrl);
      loadMatchesForProject(projectIdFromUrl);
    }
  }, [projectIdFromUrl, projects]);

  useEffect(() => {
    // Check favourite status for all matches when they load
    if (matches.length > 0 && selectedProject) {
      checkFavouriteStatuses();
    }
  }, [matches, selectedProject]);

  async function fetchProjects() {
    try {
      const res = await api.get('/api/projects/');
      setProjects(res.data || []);
    } catch (err) {
      setError('Failed to load projects');
    }
  }

  async function loadMatchesForProject(projectId) {
    if (!projectId) {
      setMatches([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.get(`/api/projects/${projectId}/matched-products/`);
      setMatches(res.data || []);
    } catch (err) {
      console.error('BorrowerMatches loadMatchesForProject error:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      
      let errorMessage = 'Failed to load matched products';
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          errorMessage = 'Authentication failed. Please log in again.';
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          window.location.href = '/login';
          return;
        }
        errorMessage = err.response.data?.detail || 
                      err.response.data?.error || 
                      `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = 'Network Error: Cannot connect to backend server. Please ensure the Django server is running on http://localhost:8000';
      } else {
        errorMessage = err.message || 'Unknown error';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function loadFavourites() {
    setFavouritesLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/products/favourites/');
      const favs = res.data?.results || res.data || [];
      setFavourites(favs);
    } catch (err) {
      console.error('Failed to load favourites:', err);
      setError('Failed to load saved products');
    } finally {
      setFavouritesLoading(false);
    }
  }

  async function checkFavouriteStatuses() {
    // Check which products are favourited
    const statusChecks = matches.map(async (product) => {
      try {
        const res = await api.get(
          `/api/products/favourites/check/?product_id=${product.id}&project_id=${selectedProject || ''}`
        );
        return { productId: product.id, favourited: res.data.favourited };
      } catch (err) {
        return { productId: product.id, favourited: false };
      }
    });
    
    const results = await Promise.all(statusChecks);
    const statusMap = {};
    results.forEach(({ productId, favourited }) => {
      statusMap[productId] = favourited;
    });
    setFavouriteStatus(statusMap);
  }

  const handleSelectProject = async (e) => {
    const projectId = e.target.value;
    setSelectedProject(projectId);
    // Update URL to include project_id if selected, or remove it if cleared
    if (projectId) {
      navigate(`/borrower/matches?project_id=${projectId}`, { replace: true });
    } else {
      navigate('/borrower/matches', { replace: true });
    }
    loadMatchesForProject(projectId);
  };

  const handleToggleFavourite = async (productId, product) => {
    try {
      const res = await api.post('/api/products/favourites/toggle/', {
        product_id: productId,
        project_id: selectedProject || null,
      });
      
      setFavouriteStatus({
        ...favouriteStatus,
        [productId]: res.data.favourited,
      });
      
      if (res.data.favourited) {
        setSuccessMessage(`"${product.name}" added to saved products`);
      } else {
        setSuccessMessage(`"${product.name}" removed from saved products`);
      }
      
      // Reload favourites if on saved tab
      if (activeTab === 'saved') {
        loadFavourites();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to toggle favourite:', err);
      setError(err.response?.data?.error || 'Failed to save product');
    }
  };

  const handleViewDetails = (productId) => {
    navigate(`/borrower/products/${productId}${selectedProject ? `?project_id=${selectedProject}` : ''}`);
  };

  const handleApply = async (productId) => {
    if (!selectedProject) {
      setError('Please select a project first');
      return;
    }

    setSubmittingEnquiry({ ...submittingEnquiry, [productId]: true });
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await api.post(`/api/projects/${selectedProject}/submit-enquiry/`, {
        product_id: productId,
        notes: enquiryNotes[productId] || '',
      });
      
      setSuccessMessage(`Application submitted successfully! The lender will be notified.`);
      // Remove the product from matches since enquiry is submitted
      setMatches(matches.filter(p => p.id !== productId));
      setEnquiryNotes({ ...enquiryNotes, [productId]: '' });
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit application';
      setError(errorMsg);
    } finally {
      setSubmittingEnquiry({ ...submittingEnquiry, [productId]: false });
    }
  };

  const renderProductRow = (product, isFavourite = false) => {
    const isFavourited = favouriteStatus[product.id] || isFavourite;
    
    return (
      <tr 
        key={product.id} 
        style={{ 
          borderBottom: `1px solid ${theme.colors.gray200}`,
          cursor: 'pointer',
        }}
        onClick={() => handleViewDetails(product.id)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = theme.colors.gray50;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <td style={{ ...commonStyles.tableCell, fontWeight: theme.typography.fontWeight.semibold }}>
          {product.name}
        </td>
        <td style={commonStyles.tableCell}>
          {product.lender_details?.organisation_name || 'N/A'}
        </td>
        <td style={commonStyles.tableCell}>{product.funding_type}</td>
        <td style={commonStyles.tableCell}>{product.property_type}</td>
        <td style={commonStyles.tableCell}>
          £{parseFloat(product.min_loan_amount || 0).toLocaleString()} - £{parseFloat(product.max_loan_amount || 0).toLocaleString()}
        </td>
        <td style={commonStyles.tableCell}>
          {product.interest_rate_min}% - {product.interest_rate_max}%
        </td>
        <td style={commonStyles.tableCell}>{product.max_ltv_ratio}%</td>
        <td 
          style={commonStyles.tableCell} 
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <Button
              onClick={() => handleToggleFavourite(product.id, product)}
              variant={isFavourited ? "primary" : "outline"}
              size="sm"
              title={isFavourited ? "Remove from saved" : "Save for later"}
            >
              {isFavourited ? '★ Saved' : '☆ Save'}
            </Button>
            {selectedProject && (
              <Button
                onClick={() => handleApply(product.id)}
                disabled={submittingEnquiry[product.id]}
                size="sm"
                variant="primary"
              >
                {submittingEnquiry[product.id] ? 'Applying...' : 'Apply'}
              </Button>
            )}
            <Button
              onClick={() => handleViewDetails(product.id)}
              size="sm"
              variant="outline"
            >
              View Details
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={commonStyles.container}>
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h1 style={{
          fontSize: theme.typography.fontSize['4xl'],
          fontWeight: theme.typography.fontWeight.bold,
          margin: `0 0 ${theme.spacing.sm} 0`,
          color: theme.colors.textPrimary,
        }}>
          Matched Products
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          View lender products that match your projects, save favourites, and apply
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

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: theme.spacing.md, 
        marginBottom: theme.spacing.lg,
        borderBottom: `2px solid ${theme.colors.gray200}`,
      }}>
        <button
          onClick={() => setActiveTab('matches')}
          style={{
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'matches' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
            color: activeTab === 'matches' ? theme.colors.primary : theme.colors.textSecondary,
            fontWeight: activeTab === 'matches' ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.base,
          }}
        >
          Matches ({matches.length})
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          style={{
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'saved' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
            color: activeTab === 'saved' ? theme.colors.primary : theme.colors.textSecondary,
            fontWeight: activeTab === 'saved' ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.normal,
            cursor: 'pointer',
            fontSize: theme.typography.fontSize.base,
          }}
        >
          Saved ({favourites.length})
        </button>
      </div>

      {activeTab === 'matches' && (
        <>
          <div style={{ ...commonStyles.card, marginBottom: theme.spacing.xl }}>
            <Select
              label="Select Project"
              value={selectedProject}
              onChange={handleSelectProject}
            >
              <option value="">-- Select a project --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.description || p.address || `Project #${p.id}`}
                </option>
              ))}
            </Select>
          </div>

          {selectedProject && (
            <div>
              {loading ? (
                <div style={{ ...commonStyles.card, textAlign: 'center', padding: theme.spacing['2xl'] }}>
                  <p style={{ color: theme.colors.textSecondary }}>Loading matches...</p>
                </div>
              ) : matches.length === 0 ? (
                <div style={{ ...commonStyles.card, textAlign: 'center', padding: theme.spacing['2xl'] }}>
                  <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.lg }}>
                    No matches found for this project.
                  </p>
                </div>
              ) : (
                <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={commonStyles.table}>
                      <thead style={commonStyles.tableHeader}>
                        <tr>
                          <th style={commonStyles.tableCell}>Product Name</th>
                          <th style={commonStyles.tableCell}>Lender</th>
                          <th style={commonStyles.tableCell}>Funding Type</th>
                          <th style={commonStyles.tableCell}>Property Type</th>
                          <th style={commonStyles.tableCell}>Loan Range (£)</th>
                          <th style={commonStyles.tableCell}>Interest Rate (%)</th>
                          <th style={commonStyles.tableCell}>LTV Ratio (%)</th>
                          <th style={commonStyles.tableCell}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matches.map((product) => renderProductRow(product))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'saved' && (
        <div>
          {favouritesLoading ? (
            <div style={{ ...commonStyles.card, textAlign: 'center', padding: theme.spacing['2xl'] }}>
              <p style={{ color: theme.colors.textSecondary }}>Loading saved products...</p>
            </div>
          ) : favourites.length === 0 ? (
            <div style={{ ...commonStyles.card, textAlign: 'center', padding: theme.spacing['2xl'] }}>
              <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.lg }}>
                No saved products yet. Save products from the Matches tab to view them here.
              </p>
            </div>
          ) : (
            <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={commonStyles.table}>
                  <thead style={commonStyles.tableHeader}>
                    <tr>
                      <th style={commonStyles.tableCell}>Product Name</th>
                      <th style={commonStyles.tableCell}>Lender</th>
                      <th style={commonStyles.tableCell}>Funding Type</th>
                      <th style={commonStyles.tableCell}>Property Type</th>
                      <th style={commonStyles.tableCell}>Loan Range (£)</th>
                      <th style={commonStyles.tableCell}>Interest Rate (%)</th>
                      <th style={commonStyles.tableCell}>LTV Ratio (%)</th>
                      <th style={commonStyles.tableCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {favourites.map((fav) => renderProductRow(fav.product, true))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default BorrowerMatches;
