// useThemeColor.ts
import { Colors } from '@/src/constants/Colors';
import { isDarkTheme } from '@/src/constants/themeTokens';
import { useTheme } from '@/src/context/theme';

// The keys in Colors.light & Colors.dark
type ColorName = keyof typeof Colors.light & keyof typeof Colors.dark;

interface ThemeOverrideProps {
  light?: string;
  dark?: string;
}

/**
 * useThemeColor - returns a **string** color value based on current scheme
 *
 * @param props Optional overrides for light/dark color
 * @param colorName Key of Colors.light/dark (like 'background', 'text', etc.)
 * @returns a **string** color
 */
export function useThemeColor(
  props: ThemeOverrideProps,
  colorName: ColorName
): string {
  const { theme } = useTheme();
  const isDark = isDarkTheme(theme);

  // If user provided overrides, use them
  const override = isDark ? props.dark : props.light;
  if (override) {
    return override;
  }

  // Otherwise fallback to Colors.ts
  return isDark ? Colors.dark[colorName] : Colors.light[colorName];
}
