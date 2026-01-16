import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function DealsList() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDeals();
  }, []);

  async function loadDeals() {
    setLoading(true);
    setError(null);
    
    try {
      console.log('[DealsList] Fetching deals from /api/deals/deals/');
      const response = await api.get('/api/deals/deals/');
      
      console.log('[DealsList] Response received:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        data: response.data
      });

      // Handle response data
      let dealsData = [];
      
      if (Array.isArray(response.data)) {
        dealsData = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Handle paginated responses
        dealsData = response.data.results || response.data.data || [];
      }

      console.log('[DealsList] Processed deals data:', {
        count: dealsData.length,
        deals: dealsData.map(d => ({ id: d.id, deal_id: d.deal_id, status: d.status }))
      });

      setDeals(dealsData);
    } catch (err) {
      console.error('[DealsList] Error loading deals:', err);
      console.error('[DealsList] Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data
      });
      
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          err.message || 
                          'Failed to load deals';
      setError(errorMessage);
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { variant: 'success', label: 'Active' },
      completed: { variant: 'info', label: 'Completed' },
      cancelled: { variant: 'error', label: 'Cancelled' },
      on_hold: { variant: 'warning', label: 'On Hold' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
          <p style={{ color: theme.colors.textSecondary }}>Loading deals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={commonStyles.container}>
        <div style={{
          ...commonStyles.card,
          background: theme.colors.errorLight,
          color: theme.colors.errorDark,
          padding: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
        }}>
          <p style={{ margin: `0 0 ${theme.spacing.md} 0`, fontWeight: theme.typography.fontWeight.semibold }}>
            Error loading deals
          </p>
          <p style={{ margin: 0, marginBottom: theme.spacing.md }}>{error}</p>
          <Button onClick={loadDeals} variant="primary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={commonStyles.container}>
      <div style={{ 
        marginBottom: theme.spacing.xl, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <h1 style={{
          margin: 0,
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          Deal Room
        </h1>
        <Button onClick={loadDeals} variant="outline">
          Refresh
        </Button>
      </div>

      {deals.length === 0 ? (
        <div style={{
          ...commonStyles.card,
          textAlign: 'center',
          padding: theme.spacing.xl,
        }}>
          <p style={{ 
            color: theme.colors.textSecondary, 
            fontSize: theme.typography.fontSize.lg,
            margin: 0
          }}>
            No deals found. Deals will appear here once applications are accepted.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: theme.spacing.lg }}>
          {deals.map(deal => (
            <div
              key={deal.id || deal.deal_id}
              style={{
                ...commonStyles.card,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => {
                const dealId = deal.deal_id || deal.id;
                console.log('[DealsList] Navigating to deal:', dealId);
                navigate(`/deals/${dealId}`);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = theme.shadows.lg;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = theme.shadows.md;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: theme.spacing.md 
              }}>
                <div>
                  <h2 style={{
                    margin: `0 0 ${theme.spacing.xs} 0`,
                    fontSize: theme.typography.fontSize['2xl'],
                    fontWeight: theme.typography.fontWeight.semibold,
                  }}>
                    {deal.deal_id || `Deal #${deal.id}`}
                  </h2>
                  <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                    {deal.borrower_name || 'Unknown Borrower'}
                  </p>
                </div>
                {getStatusBadge(deal.status)}
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: theme.spacing.md, 
                marginBottom: theme.spacing.md 
              }}>
                <div>
                  <p style={{ 
                    margin: `${theme.spacing.xs} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm 
                  }}>
                    <strong>Lender:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.lender_name || 'Unknown Lender'}</p>
                </div>
                <div>
                  <p style={{ 
                    margin: `${theme.spacing.xs} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm 
                  }}>
                    <strong>Facility Type:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.facility_type || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ 
                    margin: `${theme.spacing.xs} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm 
                  }}>
                    <strong>Current Stage:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{deal.current_stage_name || 'Not Started'}</p>
                </div>
                <div>
                  <p style={{ 
                    margin: `${theme.spacing.xs} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm 
                  }}>
                    <strong>Accepted:</strong>
                  </p>
                  <p style={{ margin: 0 }}>{formatDate(deal.accepted_at)}</p>
                </div>
              </div>

              {deal.completion_readiness_score !== null && deal.completion_readiness_score !== undefined && (
                <div style={{
                  marginTop: theme.spacing.md,
                  padding: theme.spacing.md,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                }}>
                  <p style={{ 
                    margin: `0 0 ${theme.spacing.xs} 0`, 
                    color: theme.colors.textSecondary, 
                    fontSize: theme.typography.fontSize.sm 
                  }}>
                    <strong>Completion Readiness:</strong> {deal.completion_readiness_score}%
                  </p>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: theme.colors.gray200,
                    borderRadius: theme.borderRadius.full,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${deal.completion_readiness_score}%`,
                      height: '100%',
                      background: deal.completion_readiness_score >= 80 ? theme.colors.success : 
                                 deal.completion_readiness_score >= 50 ? theme.colors.warning : theme.colors.error,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DealsList;
