import React, { useEffect, useState } from 'react';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function AdminPrivateEquity() {
  const [opportunities, setOpportunities] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchOpportunities() {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('/api/private-equity/opportunities/');
      setOpportunities(res.data || []);
    } catch (err) {
      console.error('AdminPrivateEquity fetchOpportunities error:', err);
      const errorMsg = err.response?.data?.detail || 
                      err.response?.data?.error || 
                      err.message || 
                      'Failed to load opportunities';
      setError(`Failed to load opportunities: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (id) => {
    setError(null);
    try {
      await api.post(`/api/private-equity/opportunities/${id}/approve/`);
      fetchOpportunities();
    } catch (err) {
      setError('Failed to approve opportunity');
    }
  };

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

  const pendingOpportunities = opportunities.filter(o => o.status === 'pending_review');

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading opportunities...</p>
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
          Private Equity Management
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          Review and approve private equity opportunities
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

      {pendingOpportunities.length > 0 && (
        <div style={{
          ...commonStyles.card,
          marginBottom: theme.spacing.xl,
          background: theme.colors.warningLight,
          borderColor: theme.colors.warning,
        }}>
          <h2 style={{
            fontSize: theme.typography.fontSize['2xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            margin: `0 0 ${theme.spacing.md} 0`,
            color: theme.colors.warningDark,
          }}>
            Pending Review ({pendingOpportunities.length})
          </h2>
        </div>
      )}

      {opportunities.length === 0 ? (
        <div style={{
          ...commonStyles.card,
          textAlign: 'center',
          padding: theme.spacing['3xl'],
        }}>
          <p style={{ 
            color: theme.colors.textSecondary, 
            fontSize: theme.typography.fontSize.lg,
            margin: 0,
          }}>
            No private equity opportunities found.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>Title</th>
                  <th style={commonStyles.tableCell}>Borrower</th>
                  <th style={commonStyles.tableCell}>Industry</th>
                  <th style={commonStyles.tableCell}>Funding Required (£)</th>
                  <th style={commonStyles.tableCell}>Valuation (£)</th>
                  <th style={commonStyles.tableCell}>Share Offered (%)</th>
                  <th style={commonStyles.tableCell}>Status</th>
                  <th style={commonStyles.tableCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((opp) => (
                  <tr key={opp.id} style={{ borderBottom: `1px solid ${theme.colors.gray200}` }}>
                    <td style={{ ...commonStyles.tableCell, fontWeight: theme.typography.fontWeight.semibold }}>
                      {opp.title}
                    </td>
                    <td style={commonStyles.tableCell}>{opp.borrower || 'N/A'}</td>
                    <td style={commonStyles.tableCell}>{opp.industry || '—'}</td>
                    <td style={commonStyles.tableCell}>£{parseFloat(opp.funding_required || 0).toLocaleString()}</td>
                    <td style={commonStyles.tableCell}>{opp.valuation ? `£${parseFloat(opp.valuation).toLocaleString()}` : '—'}</td>
                    <td style={commonStyles.tableCell}>{opp.share_offered}%</td>
                    <td style={commonStyles.tableCell}>{getStatusBadge(opp.status)}</td>
                    <td style={commonStyles.tableCell}>
                      {opp.status === 'approved' ? (
                        <span style={{ color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm }}>
                          Approved
                        </span>
                      ) : (
                        <Button variant="success" size="sm" onClick={() => handleApprove(opp.id)}>
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPrivateEquity;
