import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Badge from '../components/Badge';
import Button from '../components/Button';

function BorrowerApplications() {
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/applications/');
        // Handle both array and paginated responses
        const apps = res.data?.results || res.data || [];
        setApplications(apps);
      } catch (err) {
        console.error('BorrowerApplications fetchApplications error:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response,
          status: err.response?.status,
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to load applications';
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
    fetchApplications();
  }, []);

  const getStatusBadge = (status) => {
    const statusMap = {
      submitted: { variant: 'info', label: 'Submitted' },
      opened: { variant: 'info', label: 'Opened' },
      under_review: { variant: 'warning', label: 'Under Review' },
      further_info_required: { variant: 'warning', label: 'Further Info Required' },
      credit_check: { variant: 'info', label: 'Credit Check' },
      approved: { variant: 'success', label: 'Approved' },
      accepted: { variant: 'success', label: 'Accepted' },
      declined: { variant: 'error', label: 'Declined' },
      withdrawn: { variant: 'info', label: 'Withdrawn' },
      completed: { variant: 'success', label: 'Completed' },
    };
    const statusInfo = statusMap[status] || { variant: 'info', label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <div style={commonStyles.container}>
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading applications...</p>
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
          Applications on My Projects
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          View all applications submitted by lenders on your projects
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

      {applications.length === 0 ? (
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
            No applications have been submitted on your projects yet.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>Project</th>
                  <th style={commonStyles.tableCell}>Lender</th>
                  <th style={commonStyles.tableCell}>Product</th>
                  <th style={commonStyles.tableCell}>Proposed Loan (£)</th>
                  <th style={commonStyles.tableCell}>Interest Rate (%)</th>
                  <th style={commonStyles.tableCell}>Term (months)</th>
                  <th style={commonStyles.tableCell}>LTV Ratio (%)</th>
                  <th style={commonStyles.tableCell}>Status</th>
                  <th style={commonStyles.tableCell}>Submitted</th>
                  <th style={commonStyles.tableCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
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
                      {app.project_details?.address || `Project #${app.project}`}
                    </td>
                    <td style={commonStyles.tableCell}>
                      {app.lender_details?.organisation_name || 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>
                      {app.product_details?.name || app.product || 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>£{parseFloat(app.proposed_loan_amount || 0).toLocaleString()}</td>
                    <td style={commonStyles.tableCell}>
                      {app.proposed_interest_rate ? `${app.proposed_interest_rate}%` : 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>{app.proposed_term_months}</td>
                    <td style={commonStyles.tableCell}>
                      {app.proposed_ltv_ratio ? `${app.proposed_ltv_ratio}%` : 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>{getStatusBadge(app.status)}</td>
                    <td style={{ ...commonStyles.tableCell, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell} onClick={(e) => e.stopPropagation()}>
                      <Link to={`/borrower/applications/${app.id}`} style={{ textDecoration: 'none', marginRight: theme.spacing.xs }}>
                        <Button size="sm" variant="primary">View Details</Button>
                      </Link>
                      <Link to={`/borrower/messages?application_id=${app.id}`} style={{ textDecoration: 'none' }}>
                        <Button size="sm" variant="outline">Message</Button>
                      </Link>
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

export default BorrowerApplications;
