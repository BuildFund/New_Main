import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Textarea({ label, error, helperText, rows = 4, ...props }) {
  return (
    <div style={commonStyles.formGroup}>
      {label && <label style={commonStyles.label}>{label}</label>}
      <textarea
        {...props}
        rows={rows}
        style={{
          ...commonStyles.input,
          borderColor: error ? theme.colors.error : theme.colors.gray300,
          minHeight: `${rows * 1.5}rem`,
          resize: 'vertical',
          fontFamily: theme.typography.fontFamily,
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

export default Textarea;
