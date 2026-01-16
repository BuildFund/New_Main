import React from 'react';
import { theme, commonStyles } from '../styles/theme';
import Badge from './Badge';

function ApplicationProgress({ application, statusHistory = [] }) {
  // Define the status progression order
  const statusOrder = [
    'submitted',
    'opened',
    'under_review',
    'further_info_required',
    'credit_check',
    'approved',
    'accepted',
    'declined',
    'withdrawn',
    'completed',
  ];

  const statusLabels = {
    submitted: 'Submitted',
    opened: 'Opened',
    under_review: 'Under Review',
    further_info_required: 'Further Info Required',
    credit_check: 'Credit Check',
    approved: 'Approved',
    accepted: 'Accepted',
    declined: 'Declined',
    withdrawn: 'Withdrawn',
    completed: 'Completed',
  };

  const statusColors = {
    submitted: theme.colors.info,
    opened: theme.colors.info,
    under_review: theme.colors.warning,
    further_info_required: theme.colors.warning,
    credit_check: theme.colors.info,
    approved: theme.colors.success,
    accepted: theme.colors.success,
    declined: theme.colors.error,
    withdrawn: theme.colors.textSecondary,
    completed: theme.colors.success,
  };

  const currentStatus = application?.status || 'submitted';
  const currentIndex = statusOrder.indexOf(currentStatus);
  
  // Determine which statuses are relevant based on current status
  const relevantStatuses = statusOrder.slice(0, currentIndex + 1);
  
  // If declined or withdrawn, show those as final
  if (currentStatus === 'declined' || currentStatus === 'withdrawn') {
    relevantStatuses.push(currentStatus);
  }

  // Get the most recent status history entry
  const latestFeedback = application?.status_feedback || '';
  const statusChangedAt = application?.status_changed_at 
    ? new Date(application.status_changed_at).toLocaleDateString()
    : null;

  const cardStyle = {
    background: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    boxShadow: theme.shadows.md,
    border: `1px solid ${theme.colors.gray200}`,
  };

  return (
    <div style={{
      ...cardStyle,
      marginBottom: theme.spacing.lg,
    }}>
      <h3 style={{
        margin: `0 0 ${theme.spacing.lg} 0`,
        fontSize: theme.typography.fontSize.xl,
        fontWeight: theme.typography.fontWeight.semibold,
      }}>
        Application Progress
      </h3>

      {/* Progress Timeline */}
      <div style={{
        position: 'relative',
        paddingLeft: theme.spacing.xl,
        marginBottom: theme.spacing.lg,
      }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute',
          left: '12px',
          top: 0,
          bottom: 0,
          width: '2px',
          background: theme.colors.gray200,
        }} />

        {relevantStatuses.map((status, index) => {
          const isActive = status === currentStatus;
          const isPast = index < currentIndex;
          const statusColor = isActive || isPast 
            ? statusColors[status] || theme.colors.primary
            : theme.colors.gray300;

          return (
            <div
              key={status}
              style={{
                position: 'relative',
                marginBottom: theme.spacing.lg,
                display: 'flex',
                alignItems: 'flex-start',
                gap: theme.spacing.md,
              }}
            >
              {/* Status dot */}
              <div style={{
                position: 'absolute',
                left: '-20px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: isActive || isPast ? statusColor : theme.colors.white,
                border: `3px solid ${statusColor}`,
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {(isActive || isPast) && (
                  <span style={{
                    fontSize: '12px',
                    color: theme.colors.white,
                  }}>
                    ✓
                  </span>
                )}
              </div>

              {/* Status content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  marginBottom: theme.spacing.xs,
                }}>
                  <span style={{
                    fontWeight: isActive 
                      ? theme.typography.fontWeight.semibold 
                      : theme.typography.fontWeight.normal,
                    color: isActive ? theme.colors.textPrimary : theme.colors.textSecondary,
                  }}>
                    {statusLabels[status]}
                  </span>
                  {isActive && (
                    <Badge 
                      variant={
                        currentStatus === 'accepted' || currentStatus === 'approved' || currentStatus === 'completed'
                          ? 'success'
                          : currentStatus === 'declined'
                          ? 'error'
                          : 'info'
                      }
                    >
                      Current
                    </Badge>
                  )}
                </div>
                
                {/* Show feedback for current status */}
                {isActive && latestFeedback && (
                  <div style={{
                    marginTop: theme.spacing.xs,
                    padding: theme.spacing.sm,
                    background: theme.colors.gray50,
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.textSecondary,
                  }}>
                    <strong>Feedback:</strong> {latestFeedback}
                  </div>
                )}

                {/* Show date if available */}
                {isActive && statusChangedAt && (
                  <div style={{
                    marginTop: theme.spacing.xs,
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.textMuted,
                  }}>
                    Updated: {statusChangedAt}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status History Timeline */}
      {statusHistory && statusHistory.length > 0 && (
        <div style={{
          marginTop: theme.spacing.xl,
          paddingTop: theme.spacing.lg,
          borderTop: `1px solid ${theme.colors.gray200}`,
        }}>
          <h4 style={{
            margin: `0 0 ${theme.spacing.md} 0`,
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.semibold,
          }}>
            Status History
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
          }}>
            {statusHistory.map((entry, index) => (
              <div
                key={index}
                style={{
                  padding: theme.spacing.sm,
                  background: theme.colors.gray50,
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: theme.spacing.xs,
                }}>
                  <Badge variant="info">{entry.status_display}</Badge>
                  <span style={{ color: theme.colors.textMuted }}>
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {entry.feedback && (
                  <p style={{ margin: 0, color: theme.colors.textSecondary }}>
                    {entry.feedback}
                  </p>
                )}
                <p style={{
                  margin: `${theme.spacing.xs} 0 0`,
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.textMuted,
                }}>
                  Changed by: {entry.changed_by}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApplicationProgress;
