// src/context/theme.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColor } from '../hooks/useThemeColor';
import { useColorScheme } from '../hooks/useColorScheme'; // Patched hook

const THEME_STORAGE_KEY = '@userThemePreference';

const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  textSecondary: '#6b7280',
  primary: '#6200ee',
  primaryLight: '#e8d9ff',
  buttonText: '#ffffff',
  success: '#16a34a',
  error: '#dc2626',
  cardBackground: '#f9fafb',
  shadow: '#00000050',
  icon: '#6b7280',
  border: '#e5e7eb',
};

const darkTheme = {
  background: '#000000',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  primary: '#bb86fc',
  primaryLight: '#3d2859',
  buttonText: '#000000',
  success: '#22c55e',
  error: '#ef4444',
  cardBackground: '#1f2937',
  shadow: '#ffffff20',
  icon: '#d1d5db',
  border: '#374151',
};

export type Theme = typeof lightTheme;
export type ThemeMode = 'light' | 'dark' | 'system';

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

export const useAllThemeColors = () => ({
  background: useThemeColor({}, 'background'),
  text: useThemeColor({}, 'text'),
  textSecondary: useThemeColor({}, 'textSecondary'),
  success: useThemeColor({}, 'success'),
  error: useThemeColor({}, 'error'),
  primary: useThemeColor({}, 'primary'),
  primaryLight: useThemeColor({}, 'primaryLight'),
  buttonText: useThemeColor({}, 'buttonText'),
  cardBackground: useThemeColor({}, 'cardBackground'),
  shadow: useThemeColor({}, 'shadow'),
  icon: useThemeColor({}, 'icon'),
  border: useThemeColor({}, 'border'),
});
