export const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  textSecondary: '#6b7280',
  primaryText: '#B9640F',
  surface: '#FDFDFC',
  surfaceTint: '#FDF1E6',
  hairline: '#EDF1F2',
  track: '#DDE3E5',
  trackStrong: '#DDE3E5',
  primary: '#6200ee',
  primaryLight: '#e8d9ff',
  buttonText: '#ffffff',
  success: '#16a34a',
  error: '#dc2626',
  cardBackground: '#f9fafb',
  shadow: '#00000050',
  icon: '#6b7280',
  border: '#e5e7eb',
};

export const darkTheme = {
  background: '#000000',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  primaryText: '#F0913C',
  surface: '#364C62',
  surfaceTint: '#46362E',
  hairline: '#42596F',
  track: '#3D556D',
  trackStrong: '#4A6076',
  primary: '#bb86fc',
  primaryLight: '#3d2859',
  buttonText: '#000000',
  success: '#22c55e',
  error: '#ef4444',
  cardBackground: '#1f2937',
  shadow: '#ffffff20',
  icon: '#d1d5db',
  border: '#374151',
};

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark' | 'system';

export function isDarkTheme(theme: Theme): boolean {
  return theme.background === darkTheme.background;
}
