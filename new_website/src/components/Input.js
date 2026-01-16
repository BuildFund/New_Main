import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Input({ label, error, helperText, ...props }) {
  return (
    <div style={commonStyles.formGroup}>
      {label && <label style={commonStyles.label}>{label}</label>}
      <input
        {...props}
        style={{
          ...commonStyles.input,
          borderColor: error ? theme.colors.error : theme.colors.gray300,
          ...props.style,
        }}
      />
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

export default Input;
