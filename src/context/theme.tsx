import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, type ThemeColors } from '@/src/constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme'; // Patched hook

const THEME_STORAGE_KEY = '@userThemePreference';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextData {
  /** Resolved scheme: the saved mode, or the device scheme in "system" mode. */
  isDark: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const deviceScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const isDark =
    themeMode === 'system' ? deviceScheme === 'dark' : themeMode === 'dark';

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

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextData => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

/**
 * The active palette. Returns the shared palette object itself, so the
 * reference is stable per scheme and `useMemo(() => createStyles(theme), [theme])`
 * only rebuilds styles when the scheme actually changes.
 */
export const useAllThemeColors = (): ThemeColors =>
  useTheme().isDark ? Colors.dark : Colors.light;
