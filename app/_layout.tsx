// app/_layout.tsx
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Import the wrapper
import {
  PublicSans_400Regular,
  PublicSans_600SemiBold,
  PublicSans_700Bold,
  PublicSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/public-sans';
import { useEffect } from 'react';

import { recordMasteryRolloutColdStart } from '@/src/analytics/masteryRolloutDiagnostics';
import { Colors } from '@/src/constants/Colors';
import { ThemeProvider as AppThemeProvider, useTheme } from '@/src/context/theme';

const CustomDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: Colors.dark.background,
    text: Colors.dark.text,
  },
};

const CustomLightTheme = {
  ...NavigationDefaultTheme,
  colors: {
    ...NavigationDefaultTheme.colors,
    background: Colors.light.background,
    text: Colors.light.text,
  },
};

/**
 * Navigation and status-bar chrome follow the saved app theme (which itself
 * follows the device only in "system" mode), not the raw device scheme.
 */
function ThemedNavigation() {
  const { isDark } = useTheme();
  return (
    <ThemeProvider value={isDark ? CustomDarkTheme : CustomLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PublicSans_400Regular,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    PublicSans_800ExtraBold,
  });

  useEffect(() => {
    recordMasteryRolloutColdStart();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <ThemedNavigation />
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
