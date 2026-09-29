// Colors.ts — the single source of every app color (Ember palette: graphite
// neutrals, orange as the only warm hue). Styles and components read these
// tokens; nothing else may hardcode a palette hex or detect the scheme by
// comparing color values.

const light = {
  background: '#ECEEF1',
  text: '#1F2329',
  textSecondary: '#565D67',
  primaryText: '#9C420B',
  surface: '#FFFFFF',
  surfaceTint: '#FBEDE2',
  hairline: '#E6E9ED',
  track: '#DCDFE4',
  trackStrong: '#CFD4DA',
  // Semantic and primary hues are dark enough for WCAG AA 4.5:1 with the
  // text they carry or sit under (button/Play labels, feedback, highlights).
  success: '#1B7F45',
  error: '#B93226',
  primary: '#A8470C',
  // Pressed/playing state of a primary fill; darker than `primary` while the
  // label keeps AA contrast.
  primaryActive: '#8A3A08',
  primaryLight: '#F8D9C2',
  // Emphasized text on cards and tints: the contrasting phoneme, contrast label.
  highlightText: '#9C420B',
  // Brand warm accent for non-text marks: level fill, tap flash, button shadow.
  accent: '#C4580F',
  // Play button idle glow: inner ring and outer halo.
  glowRing: '#A8470C',
  glowHalo: '#E8762A',
  buttonText: '#FFFFFF',
  cardBackground: '#FFFFFF',
  // Card shadow color with its opacity baked into the alpha channel.
  cardShadow: '#1F23292E',
  shadow: '#1F2329',
  answerTile: '#FBEDE2',
  answerTileBorder: '#FBEDE2',
  icon: '#3A414B',
  tabInactive: '#636A74',
  border: '#CDD2D8',
};

const dark: typeof light = {
  background: '#16181C',
  text: '#F3F4F6',
  textSecondary: '#A9AFB8',
  primaryText: '#F6A866',
  surface: '#22252B',
  surfaceTint: '#2E2A27',
  hairline: '#30343B',
  track: '#33373F',
  trackStrong: '#3E434C',
  success: '#3FC67F',
  error: '#FF6F61',
  primary: '#F08A3C',
  primaryActive: '#D0702A',
  primaryLight: '#5A3A22',
  highlightText: '#F6A866',
  accent: '#F08A3C',
  glowRing: '#F6A866',
  glowHalo: '#F08A3C',
  // The dark theme's bright orange fills carry a dark label.
  buttonText: '#1A0E05',
  cardBackground: '#22252B',
  cardShadow: '#00000066',
  shadow: '#000000',
  answerTile: '#2E2A27',
  answerTileBorder: '#453C35',
  icon: '#D1D5DB',
  tabInactive: '#9AA1AB',
  border: '#3A3F47',
};

export const Colors = { light, dark };

export type ThemeColors = typeof light;

/** `#RRGGBB` token → `rgba(r, g, b, alpha)` for tints, glows and flashes. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
