// useThemeColor.ts
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

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
  // e.g. "light" | "dark" | "no-preference"
  const theme = useColorScheme() || 'light';

  // If user provided overrides, use them
  const override = theme === 'dark' ? props.dark : props.light;
  if (override) {
    return override;
  }

  // Otherwise fallback to Colors.ts
  return theme === 'dark' ? Colors.dark[colorName] : Colors.light[colorName];
}
