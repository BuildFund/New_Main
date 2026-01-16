import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Select({ label, error, helperText, children, ...props }) {
  return (
    <div style={commonStyles.formGroup}>
      {label && <label style={commonStyles.label}>{label}</label>}
      <select
        {...props}
        style={{
          ...commonStyles.input,
          borderColor: error ? theme.colors.error : theme.colors.gray300,
          ...props.style,
        }}
      >
        {children}
      </select>
      {error && (
        <div style={{
          color: theme.colors.error,
          fontSize: theme.typography.fontSize.sm,
          marginTop: theme.spacing.xs,
        }}>
          {error}
        </div>
      )}
      {helperText && !error && (
        <div style={{
          color: theme.colors.textSecondary,
          fontSize: theme.typography.fontSize.sm,
          marginTop: theme.spacing.xs,
        }}>
          {helperText}
        </div>
      )}
    </div>
  );
}

export default Select;
