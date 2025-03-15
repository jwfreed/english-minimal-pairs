/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  return function getThemeColor() {
    const theme = useColorScheme() ?? 'light';

    const colorFromProps = props[theme];

    if (colorFromProps) {
      return colorFromProps;
    }

    const themeColors = Colors[theme] || Colors.light;
    return themeColors[colorName] ?? '#000'; // Fallback to black
  };
}
