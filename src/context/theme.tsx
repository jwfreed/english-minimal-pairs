// src/context/theme.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useThemeColor } from '../../hooks/useThemeColor';
import { useColorScheme } from '../../hooks/useColorScheme'; // Patched hook

const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  primary: '#6200ee',
  buttonText: '#ffffff',
  success: '#16a34a',
  error: '#dc2626',
  cardBackground: '#f9fafb',
  shadow: '#00000050',
  icon: '#6b7280',
};

const darkTheme = {
  background: '#000000',
  text: '#ffffff',
  primary: '#bb86fc',
  buttonText: '#000000',
  success: '#22c55e',
  error: '#ef4444',
  cardBackground: '#1f2937',
  shadow: '#ffffff20',
  icon: '#d1d5db',
};

export type Theme = typeof lightTheme;

interface ThemeContextData {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  getColor: (key: keyof Theme) => string;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const deviceScheme = useColorScheme();

  const [theme, setTheme] = useState<Theme>(
    deviceScheme === 'dark' ? darkTheme : lightTheme
  );

  // Automatically update theme when system setting changes
  useEffect(() => {
    setTheme(deviceScheme === 'dark' ? darkTheme : lightTheme);
  }, [deviceScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === lightTheme ? darkTheme : lightTheme));
  };

  const getColor = (key: keyof Theme) => theme[key];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, getColor }}>
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
  success: useThemeColor({}, 'success'),
  error: useThemeColor({}, 'error'),
  primary: useThemeColor({}, 'primary'),
  buttonText: useThemeColor({}, 'buttonText'),
  cardBackground: useThemeColor({}, 'cardBackground'),
  shadow: useThemeColor({}, 'shadow'),
  icon: useThemeColor({}, 'icon'),
});
