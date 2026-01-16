import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Badge from '../components/Badge';
import Button from '../components/Button';

function LenderApplications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/api/applications/');
        setApplications(res.data || []);
      } catch (err) {
        console.error('LenderApplications fetchApplications error:', err);
        setError('Failed to load applications');
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

  const handleAccept = async (applicationId) => {
    // TODO: Implement in Chunk 4 - Create Deal and redirect
    if (window.confirm('Accept this application and create a deal?')) {
      try {
        // Placeholder - will be implemented in Chunk 4
        console.log('Accept application:', applicationId);
        alert('Accept functionality will be implemented in Chunk 4');
      } catch (err) {
        console.error('Failed to accept application:', err);
        alert('Failed to accept application');
      }
    }
  };

  const handleDecline = async (applicationId) => {
    // TODO: Implement in Chunk 4 - Decline with reason
    const reason = window.prompt('Please provide a reason for declining:');
    if (reason) {
      try {
        // Placeholder - will be implemented in Chunk 4
        console.log('Decline application:', applicationId, 'Reason:', reason);
        alert('Decline functionality will be implemented in Chunk 4');
      } catch (err) {
        console.error('Failed to decline application:', err);
        alert('Failed to decline application');
      }
    }
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
          Applications & Enquiries
        </h1>
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.base,
          margin: 0,
        }}>
          View and manage funding applications
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
            No applications found.
          </p>
        </div>
      ) : (
        <div style={{ ...commonStyles.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={commonStyles.table}>
              <thead style={commonStyles.tableHeader}>
                <tr>
                  <th style={commonStyles.tableCell}>Type</th>
                  <th style={commonStyles.tableCell}>Project</th>
                  <th style={commonStyles.tableCell}>Product</th>
                  <th style={commonStyles.tableCell}>Loan Amount (£)</th>
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
                      cursor: 'pointer' 
                    }}
                    onClick={() => navigate(`/lender/applications/${app.id}`)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.colors.gray50;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <td style={commonStyles.tableCell}>
                      <Badge variant={app.initiated_by === 'borrower' ? 'info' : 'secondary'}>
                        {app.initiated_by === 'borrower' ? 'Enquiry' : 'Application'}
                      </Badge>
                    </td>
                    <td style={commonStyles.tableCell}>
                      {app.project_details?.address || `Project #${app.project}`}
                    </td>
                    <td style={commonStyles.tableCell}>
                      {app.product_details?.name || app.product || 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>
                      £{parseFloat(app.proposed_loan_amount || 0).toLocaleString()}
                    </td>
                    <td style={commonStyles.tableCell}>{getStatusBadge(app.status)}</td>
                    <td style={{ ...commonStyles.tableCell, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                      {app.created_at ? new Date(app.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={commonStyles.tableCell}>
                      <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
                        <Button 
                          size="sm" 
                          variant="primary"
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            navigate(`/lender/applications/${app.id}`); 
                          }}
                        >
                          Open Review
                        </Button>
                        {app.status !== 'accepted' && app.status !== 'declined' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                // TODO: Open Request Info modal or navigate to requests tab (Chunk 3)
                                navigate(`/lender/applications/${app.id}?tab=requests`); 
                              }}
                            >
                              Request Info
                            </Button>
                            {app.status === 'approved' && (
                              <Button 
                                size="sm" 
                                variant="success"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  // TODO: Handle accept (Chunk 4)
                                  handleAccept(app.id);
                                }}
                              >
                                Accept
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="error"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                // TODO: Handle decline (Chunk 4)
                                handleDecline(app.id);
                              }}
                            >
                              Decline
                            </Button>
                          </>
                        )}
                      </div>
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

export default LenderApplications;
