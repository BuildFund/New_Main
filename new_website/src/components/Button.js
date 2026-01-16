import React, { useState } from 'react';
import { theme, commonStyles } from '../styles/theme';

function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  ...props 
}) {
  const [hovered, setHovered] = useState(false);

  const variantStyles = {
    primary: {
      background: hovered && !disabled && !loading ? theme.colors.primaryDark : theme.colors.primary,
      color: theme.colors.white,
      border: 'none',
    },
    secondary: {
      background: hovered && !disabled && !loading ? theme.colors.secondaryDark : theme.colors.secondary,
      color: theme.colors.white,
      border: 'none',
    },
    outline: {
      background: hovered && !disabled && !loading ? theme.colors.primary : 'transparent',
      color: hovered && !disabled && !loading ? theme.colors.white : theme.colors.primary,
      border: `2px solid ${theme.colors.primary}`,
    },
    success: {
      background: hovered && !disabled && !loading ? theme.colors.successDark : theme.colors.success,
      color: theme.colors.white,
      border: 'none',
    },
    danger: {
      background: hovered && !disabled && !loading ? theme.colors.errorDark : theme.colors.error,
      color: theme.colors.white,
      border: 'none',
    },
  };

  const sizeStyles = {
    sm: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, fontSize: theme.typography.fontSize.sm },
    md: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, fontSize: theme.typography.fontSize.base },
    lg: { padding: `${theme.spacing.md} ${theme.spacing.xl}`, fontSize: theme.typography.fontSize.lg },
  };

  const style = {
    ...commonStyles.button,
    ...variantStyles[variant],
    ...sizeStyles[size],
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled || loading ? 0.6 : 1,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: `all ${theme.transitions.fast}`,
    ...props.style,
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}

export default Button;
