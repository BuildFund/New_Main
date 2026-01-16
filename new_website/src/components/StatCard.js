import React from 'react';
import { theme, commonStyles } from '../styles/theme';

function StatCard({ title, value, icon, color = 'primary', onClick }) {
  const colorMap = {
    primary: { bg: theme.colors.primary + '10', text: theme.colors.primary, border: theme.colors.primary },
    secondary: { bg: theme.colors.secondary + '10', text: theme.colors.secondary, border: theme.colors.secondary },
    success: { bg: theme.colors.successLight, text: theme.colors.successDark, border: theme.colors.success },
    warning: { bg: theme.colors.warningLight, text: theme.colors.warningDark, border: theme.colors.warning },
    info: { bg: theme.colors.infoLight, text: theme.colors.infoDark, border: theme.colors.info },
    accent: { bg: theme.colors.accent + '10', text: theme.colors.accent, border: theme.colors.accent },
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <div
      onClick={onClick}
      style={{
        ...commonStyles.statCard,
        background: colors.bg,
        borderColor: colors.border + '40',
        cursor: onClick ? 'pointer' : 'default',
        transition: `all ${theme.transitions.normal}`,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = theme.shadows.lg;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = theme.shadows.sm;
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.medium,
          color: theme.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {title}
        </h3>
        {icon && (
          <span style={{ fontSize: theme.typography.fontSize.xl, opacity: 0.7 }}>
            {icon}
          </span>
        )}
      </div>
      <p style={{
        margin: 0,
        fontSize: theme.typography.fontSize['3xl'],
        fontWeight: theme.typography.fontWeight.bold,
        color: colors.text,
        lineHeight: theme.typography.lineHeight.tight,
      }}>
        {value}
      </p>
    </div>
  );
}

export default StatCard;
