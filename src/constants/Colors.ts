// Colors.ts — the single source of every app color. Styles and components
// read these tokens; nothing else may hardcode a palette hex or detect the
// scheme by comparing color values.

const light = {
  background: '#ECF0F1',
  text: '#1C2833',
  textSecondary: '#5D6D7E',
  primaryText: '#B9640F',
  surface: '#FDFDFC',
  surfaceTint: '#FDF1E6',
  hairline: '#EDF1F2',
  track: '#DDE3E5',
  trackStrong: '#DDE3E5',
  // Same hues, darkened to meet WCAG AA 4.5:1 for the text they carry or
  // sit under (white button/Play labels, feedback and highlight text).
  success: '#1E864A',
  error: '#C0392B',
  primary: '#A05512',
  // Pressed/playing state of a primary fill; darker than `primary` so the
  // white label keeps AA contrast.
  primaryActive: '#8D4C0B',
  primaryLight: '#FADCC6',
  // Brand warm accent for non-text marks: level fill, tap flash, button shadow.
  accent: '#E67E22',
  // Play button idle glow: inner ring and outer halo.
  glowRing: '#BF5700',
  glowHalo: '#E67E22',
  buttonText: '#FFFFFF',
  cardBackground: '#FDFDFC',
  // Card shadow color with its opacity baked into the alpha channel.
  cardShadow: '#1C28332E',
  shadow: '#1C2833',
  answerTile: '#FDF1E6',
  answerTileBorder: '#FDF1E6',
  icon: '#2C3E50',
  tabInactive: '#888888',
  border: '#CCD1D1',
};

const dark: typeof light = {
  background: '#2C3E50',
  text: '#FFFFFF',
  textSecondary: '#AAB7B8',
  primaryText: '#F0913C',
  surface: '#364C62',
  surfaceTint: '#46362E',
  hairline: '#42596F',
  track: '#3D556D',
  trackStrong: '#4A6076',
  success: '#2ECC71',
  error: '#E74C3C',
  primary: '#D35400',
  primaryActive: '#8D4C0B',
  primaryLight: '#895230',
  accent: '#E67E22',
  glowRing: '#F79E4A',
  glowHalo: '#F79E4A',
  buttonText: '#FFFFFF',
  cardBackground: '#364C62',
  cardShadow: '#00000059',
  shadow: '#000000',
  answerTile: '#41566D',
  answerTileBorder: '#57708A',
  icon: '#D5D8DC',
  tabInactive: '#888888',
  border: '#5D6D7E',
};

export const Colors = { light, dark };

export type ThemeColors = typeof light;

/** `#RRGGBB` token → `rgba(r, g, b, alpha)` for tints, glows and flashes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
