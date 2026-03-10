export const iaPrevTheme = {
  colors: {
    background: '#f3f4f6',
    surface: '#ffffff',
    border: '#d1d5db',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    chipActiveBg: '#111827',
    chipActiveText: '#ffffff',
    chipBg: '#e5e7eb',
    successBg: '#d1fae5',
    successText: '#047857',
    warningBg: '#fef3c7',
    warningText: '#b45309',
    infoBg: '#dbeafe',
    infoText: '#1d4ed8',
    buttonDanger: '#dc2626',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
} as const;

export type IaPrevTheme = typeof iaPrevTheme;
