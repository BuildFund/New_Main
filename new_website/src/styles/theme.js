/**
 * BuildFund Design System
 * Inspired by modern financial platforms with clean, professional styling
 */

export const theme = {
  colors: {
    // Primary brand colors
    primary: '#1a4e8a',
    primaryDark: '#0f3a5f',
    primaryLight: '#2d6ba8',
    
    // Secondary colors
    secondary: '#17a2b8',
    secondaryDark: '#0c5460',
    secondaryLight: '#20c997',
    
    // Accent colors
    accent: '#6f42c1',
    accentDark: '#4e2a8a',
    accentLight: '#8b5fbf',
    
    // Status colors
    success: '#28a745',
    successLight: '#d4edda',
    successDark: '#155724',
    
    warning: '#ffc107',
    warningLight: '#fff3cd',
    warningDark: '#856404',
    
    error: '#dc3545',
    errorLight: '#f8d7da',
    errorDark: '#721c24',
    
    info: '#17a2b8',
    infoLight: '#d1ecf1',
    infoDark: '#0c5460',
    
    // Neutral colors
    white: '#ffffff',
    gray50: '#f8f9fa',
    gray100: '#e9ecef',
    gray200: '#dee2e6',
    gray300: '#ced4da',
    gray400: '#adb5bd',
    gray500: '#6c757d',
    gray600: '#495057',
    gray700: '#343a40',
    gray800: '#212529',
    gray900: '#1a1a1a',
    
    // Text colors
    textPrimary: '#212529',
    textSecondary: '#6c757d',
    textMuted: '#adb5bd',
    
    // Background colors
    bgPrimary: '#ffffff',
    bgSecondary: '#f8f9fa',
    bgTertiary: '#e9ecef',
  },
  
  typography: {
    // GitHub's system font stack - modern, native fonts that look great on all platforms
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
    },
    
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',  // 48px
    '3xl': '4rem',  // 64px
  },
  
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    '2xl': '1rem',  // 16px
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// Helper function to create consistent component styles
export const createStyles = (customStyles) => ({
  ...customStyles,
});

// Common component styles
export const commonStyles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: theme.spacing.xl,
  },
  
  card: {
    background: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.md,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.gray200}`,
  },
  
  cardHover: {
    transition: `all ${theme.transitions.normal}`,
    '&:hover': {
      boxShadow: theme.shadows.lg,
      transform: 'translateY(-2px)',
    },
  },
  
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: theme.typography.fontSize.base,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  
  buttonPrimary: {
    background: theme.colors.primary,
    color: theme.colors.white,
    '&:hover': {
      background: theme.colors.primaryDark,
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
  
  buttonSecondary: {
    background: theme.colors.secondary,
    color: theme.colors.white,
    '&:hover': {
      background: theme.colors.secondaryDark,
    },
  },
  
  buttonOutline: {
    background: 'transparent',
    color: theme.colors.primary,
    border: `2px solid ${theme.colors.primary}`,
    '&:hover': {
      background: theme.colors.primary,
      color: theme.colors.white,
    },
  },
  
  input: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.gray300}`,
    fontSize: theme.typography.fontSize.base,
    fontFamily: theme.typography.fontFamily,
    transition: `all ${theme.transitions.fast}`,
    '&:focus': {
      outline: 'none',
      borderColor: theme.colors.primary,
      boxShadow: `0 0 0 3px ${theme.colors.primary}20`,
    },
    '&:disabled': {
      background: theme.colors.gray100,
      cursor: 'not-allowed',
    },
  },
  
  label: {
    display: 'block',
    marginBottom: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  
  statCard: {
    background: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.colors.gray200}`,
    boxShadow: theme.shadows.sm,
    transition: `all ${theme.transitions.normal}`,
    '&:hover': {
      boxShadow: theme.shadows.md,
    },
  },
  
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  
  tableHeader: {
    background: theme.colors.gray50,
    borderBottom: `2px solid ${theme.colors.gray200}`,
  },
  
  tableCell: {
    padding: theme.spacing.md,
    textAlign: 'left',
    borderBottom: `1px solid ${theme.colors.gray200}`,
  },
  
  badge: {
    display: 'inline-block',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  
  badgeSuccess: {
    background: theme.colors.successLight,
    color: theme.colors.successDark,
  },
  
  badgeWarning: {
    background: theme.colors.warningLight,
    color: theme.colors.warningDark,
  },
  
  badgeError: {
    background: theme.colors.errorLight,
    color: theme.colors.errorDark,
  },
  
  badgeInfo: {
    background: theme.colors.infoLight,
    color: theme.colors.infoDark,
  },
};

export default theme;
