import React, { useState } from 'react';
import { theme } from '../styles/theme';
import Button from './Button';

/**
 * LinkedIn-style profile card component
 * Displays information in a read-only card with an edit button
 */
function ProfileCard({ title, icon, children, onEdit, isEditing, editComponent, sensitive = false, onRequestAccess }) {
  const [showContent, setShowContent] = useState(!sensitive);

  const handleEdit = () => {
    if (sensitive && !showContent) {
      if (onRequestAccess) {
        onRequestAccess(() => setShowContent(true));
      }
    } else if (onEdit) {
      onEdit();
    }
  };

  return (
    <div style={{
      background: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      boxShadow: theme.shadows.sm,
      padding: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
      border: `1px solid ${theme.colors.gray200}`,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        paddingBottom: theme.spacing.md,
        borderBottom: `1px solid ${theme.colors.gray200}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          {icon && <span style={{ fontSize: '24px' }}>{icon}</span>}
          <h2 style={{
            margin: 0,
            fontSize: theme.typography.fontSize['xl'],
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
          }}>
            {title}
          </h2>
          {sensitive && !showContent && (
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.textSecondary,
              marginLeft: theme.spacing.sm,
            }}>
              🔒 Protected
            </span>
          )}
        </div>
        {(onEdit || onRequestAccess) && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
          >
            {sensitive && !showContent ? '🔓 View' : '✏️ Edit'}
          </Button>
        )}
      </div>

      {isEditing && editComponent ? (
        editComponent
      ) : (
        <div style={{
          color: theme.colors.textPrimary,
          lineHeight: theme.typography.lineHeight.relaxed,
        }}>
          {sensitive && !showContent ? (
            <div style={{
              textAlign: 'center',
              padding: theme.spacing.xl,
              color: theme.colors.textSecondary,
            }}>
              <p style={{ margin: 0, fontSize: theme.typography.fontSize.sm }}>
                🔒 This section contains sensitive information.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEdit}
                style={{ marginTop: theme.spacing.md }}
              >
                Authenticate to View
              </Button>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileCard;
