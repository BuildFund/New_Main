import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function Badge({ children, variant = 'info', ...props }) {
  const variantStyles = {
    success: commonStyles.badgeSuccess,
    warning: commonStyles.badgeWarning,
    error: commonStyles.badgeError,
    info: commonStyles.badgeInfo,
  };

  return (
    <span
      style={{
        ...commonStyles.badge,
        ...variantStyles[variant],
        ...props.style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
