// theme.ts
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useThemeColor } from '../../hooks/useThemeColor';

// Define theme objects – these could come from what you currently have in Colors.ts.
const lightTheme = {
  background: '#ffffff',
  text: '#000000',
  primary: '#6200ee',
  buttonText: '#ffffff',
  // ...other colors
};

const darkTheme = {
  background: '#000000',
  text: '#ffffff',
  primary: '#bb86fc',
  buttonText: '#000000',
  // ...other colors
};

export type Theme = typeof lightTheme;

interface ThemeContextData {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  // Helper to get a color by key
  getColor: (key: keyof Theme) => string;
}

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Here you can add logic to pick the initial theme (e.g., from system settings)
  const [theme, setTheme] = useState<Theme>(lightTheme);

  const toggleTheme = () => {
    setTheme((prev) => (prev === lightTheme ? darkTheme : lightTheme));
  };

  // Helper that picks a color based on the active theme
  const getColor = (key: keyof Theme) => theme[key];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, getColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

// A unified hook to use the theme
export const useTheme = (): ThemeContextData => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

// // Optionally, a simpler hook to get a color for a given key
// export const useThemeColor = (colorKey: keyof Theme): string => {
//   const { getColor } = useTheme();
//   return getColor(colorKey);
// };

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
