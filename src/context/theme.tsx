import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/src/constants/Colors';
import {
  darkTheme,
  isDarkTheme,
  lightTheme,
  type Theme,
  type ThemeMode,
} from '@/src/constants/themeTokens';
import { useColorScheme } from '../hooks/useColorScheme'; // Patched hook

const THEME_STORAGE_KEY = '@userThemePreference';

export type { Theme, ThemeMode };

interface ThemeContextData {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  getColor: (key: keyof Theme) => string;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const deviceScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<Theme>(
    deviceScheme === 'dark' ? darkTheme : lightTheme
  );

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
          setThemeModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };
    loadThemePreference();
  }, []);

  // Update theme based on mode and device scheme
  useEffect(() => {
    if (themeMode === 'system') {
      setTheme(deviceScheme === 'dark' ? darkTheme : lightTheme);
    } else if (themeMode === 'dark') {
      setTheme(darkTheme);
    } else {
      setTheme(lightTheme);
    }
  }, [themeMode, deviceScheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === lightTheme ? darkTheme : lightTheme));
  };

  const getColor = (key: keyof Theme) => theme[key];

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setTheme, setThemeMode, toggleTheme, getColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextData => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

export const useAllThemeColors = () => {
  const { theme } = useTheme();
  const colors = isDarkTheme(theme) ? Colors.dark : Colors.light;

  return {
    background: colors.background,
    text: colors.text,
    textSecondary: colors.textSecondary,
    primaryText: colors.primaryText,
    surface: colors.surface,
    surfaceTint: colors.surfaceTint,
    hairline: colors.hairline,
    track: colors.track,
    trackStrong: colors.trackStrong,
    success: colors.success,
    error: colors.error,
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    buttonText: colors.buttonText,
    cardBackground: colors.cardBackground,
    shadow: colors.shadow,
    icon: colors.icon,
    border: colors.border,
  };
};
