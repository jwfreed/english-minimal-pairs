import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import createStyles, { TABLET_MIN_WIDTH } from '@/src/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';

/**
 * Shared app styles for the active theme and the current window width.
 * Width is read live, so iPad Split View and Slide Over switch between phone
 * and tablet sizing instead of keeping the size from launch.
 */
export function useAppStyles() {
  const theme = useAllThemeColors();
  const isTablet = useWindowDimensions().width > TABLET_MIN_WIDTH;
  return useMemo(() => createStyles(theme, isTablet), [theme, isTablet]);
}
