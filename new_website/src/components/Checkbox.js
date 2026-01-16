import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Checkbox({ label, error, helperText, ...props }) {
  return (
    <div style={commonStyles.formGroup}>
      <label style={{
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        fontSize: theme.typography.fontSize.base,
        color: theme.colors.textPrimary,
      }}>
        <input
          type="checkbox"
          {...props}
          style={{
            width: '18px',
            height: '18px',
            marginRight: theme.spacing.sm,
            cursor: 'pointer',
            accentColor: theme.colors.primary,
          }}
        />
        <span>{label}</span>
      </label>
      {error && (
        <div style={{
          color: theme.colors.error,
          fontSize: theme.typography.fontSize.sm,
          marginTop: theme.spacing.xs,
          marginLeft: '26px',
        }}>
          {error}
        </div>
      )}
      {helperText && !error && (
        <div style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.sm,
          marginTop: theme.spacing.xs,
          marginLeft: '26px',
        }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

export default Checkbox;
