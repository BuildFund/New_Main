import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { theme, commonStyles } from '../styles/theme';
import Button from '../components/Button';
import Badge from '../components/Badge';

function BorrowerProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      setLoading(true);
      try {
        const response = await api.get('/api/projects/');
        setProjects(response.data || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

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
        <p style={{ textAlign: 'center', color: theme.colors.textSecondary }}>Loading projects...</p>
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
            My Projects
          </h1>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.typography.fontSize.base,
            margin: 0,
          }}>
            Manage your property development projects
          </p>
        </div>
        <Link to="/borrower/projects/new" style={{ textDecoration: 'none' }}>
          <Button variant="primary" size="lg">
            + Create New Project
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

      {projects.length === 0 ? (
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
            No projects found.
          </p>
          <Link to="/borrower/projects/new" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              Create Your First Project
            </Button>
          </Link>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
          gap: theme.spacing.lg 
        }}>
          {projects.map((project) => (
            <div 
              key={project.id} 
              style={{
                ...commonStyles.card,
                ...commonStyles.cardHover,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: theme.typography.fontSize.xl,
                  fontWeight: theme.typography.fontWeight.semibold,
                  color: theme.colors.textPrimary,
                  flex: 1,
                }}>
                  {project.description || project.address || `Project #${project.id}`}
                </h3>
                {getStatusBadge(project.status || 'draft')}
              </div>

              <div style={{ marginBottom: theme.spacing.sm }}>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Address:</strong> {project.address || 'N/A'}, {project.town || ''}
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Type:</strong> {project.property_type} - {project.funding_type}
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Loan Amount:</strong> £{parseFloat(project.loan_amount_required || 0).toLocaleString()}
                </p>
                <p style={{ 
                  margin: `${theme.spacing.xs} 0`, 
                  color: theme.colors.textSecondary, 
                  fontSize: theme.typography.fontSize.sm 
                }}>
                  <strong>Term:</strong> {project.term_required_months || 'N/A'} months
                </p>
              </div>

              <div style={{ 
                marginTop: theme.spacing.md, 
                paddingTop: theme.spacing.md, 
                borderTop: `1px solid ${theme.colors.gray200}`,
                display: 'flex',
                justifyContent: 'flex-end',
              }}>
                <Link 
                  to={`/borrower/projects/${project.id}`}
                  style={{ 
                    color: theme.colors.primary, 
                    textDecoration: 'none',
                    fontSize: theme.typography.fontSize.sm,
                    fontWeight: theme.typography.fontWeight.medium,
                  }}
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BorrowerProjects;
