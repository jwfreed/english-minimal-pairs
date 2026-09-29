export const FontFamily = {
  regular: 'PublicSans_400Regular',
  semibold: 'PublicSans_600SemiBold',
  bold: 'PublicSans_700Bold',
  extraBold: 'PublicSans_800ExtraBold',
} as const;

const FAMILY_BY_WEIGHT = {
  '400': FontFamily.regular,
  '600': FontFamily.semibold,
  '700': FontFamily.bold,
  '800': FontFamily.extraBold,
} as const;

/**
 * Public Sans at one of its loaded weights. Every text style spreads this so
 * the face and weight always agree; a bare `fontWeight` falls back to the
 * system font, because each weight is a separately loaded family.
 */
export function font<W extends keyof typeof FAMILY_BY_WEIGHT = '400'>(
  weight: W = '400' as W
) {
  return { fontFamily: FAMILY_BY_WEIGHT[weight], fontWeight: weight };
}
