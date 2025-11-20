// useThemeColor.ts
import { Colors } from '@/app/constants/Colors';
import { useTheme } from '@/app/context/theme';

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
  const isDark = theme.background === '#000000'; // Check if using dark theme

  // If user provided overrides, use them
  const override = isDark ? props.dark : props.light;
  if (override) {
    return override;
  }

  // Otherwise fallback to Colors.ts
  return isDark ? Colors.dark[colorName] : Colors.light[colorName];
}
