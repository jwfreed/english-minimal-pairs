import React, { useMemo, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PairProgressProvider } from '@/src/context/PairProgressContext';
import { LanguageProvider, useLanguage } from '@/src/context/LanguageContext';
import { CategoryProvider } from '@/src/context/CategoryContext';
import { SettingsProvider } from '@/src/context/SettingsContext';
import { useTheme } from '@/src/context/theme';

import { Colors } from '@/src/constants/Colors';
import { isDarkTheme } from '@/src/constants/themeTokens';
import { tKeys } from '@/src/constants/translationKeys';

function TabLayout() {
  const { translate, language } = useLanguage();
  // The saved app theme (provided at the root), not the device scheme.
  const isDark = isDarkTheme(useTheme().theme);

  const { activeTintColor, inactiveTintColor } = useMemo(() => ({
    activeTintColor: isDark ? Colors.dark.primary : Colors.light.primary,
    inactiveTintColor: '#888',
  }), [isDark]);

  const getTabBarIcon = useCallback((route: any, focused: boolean, size: number) => {
    const iconColor = focused ? activeTintColor : inactiveTintColor;

    switch (route.name) {
      case 'index':
        return (
          <Ionicons
            name={focused ? 'home' : 'home-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'results':
        return (
          <Ionicons
            name={focused ? 'stats-chart' : 'stats-chart-outline'}
            size={size}
            color={iconColor}
          />
        );
      case 'settings':
        return (
          <Ionicons
            name={focused ? 'settings' : 'settings-outline'}
            size={size}
            color={iconColor}
          />
        );
      default:
        return null;
    }
  }, [activeTintColor, inactiveTintColor]);

  return (
    <Tabs
      key={language}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, size }) => getTabBarIcon(route, focused, size),
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
      })}
    >
      <Tabs.Screen name="index" options={{ title: translate(tKeys.home) }} />
      <Tabs.Screen
        name="results"
        options={{
          title: translate(tKeys.results),
          tabBarLabel: translate(tKeys.results),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate(tKeys.settings),
          tabBarLabel: translate(tKeys.settings),
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <PairProgressProvider>
      <LanguageProvider>
        <SettingsProvider>
          <CategoryProvider>
            <TabLayout />
          </CategoryProvider>
        </SettingsProvider>
      </LanguageProvider>
    </PairProgressProvider>
  );
}
