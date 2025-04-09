// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Ionicons from expo
import { PairProgressProvider } from '../../src/context/PairProgressContext';
import {
  LanguageSchemeProvider,
  useLanguageScheme,
} from '../../hooks/useLanguageScheme';
import { useColorScheme } from 'react-native'; // Detect system theme if desired
import { Colors } from '@/constants/Colors'; // Your themed colors

function TabLayout() {
  const { t, language } = useLanguageScheme();
  const deviceColorScheme = useColorScheme();

  // Active vs. inactive icon colors
  const activeTintColor =
    deviceColorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary;
  const inactiveTintColor = '#888';

  return (
    // Force a re-render on language change to update tab labels
    <Tabs
      key={language}
      screenOptions={({ route }) => {
        const iconColor = (focused: boolean) =>
          focused ? activeTintColor : inactiveTintColor;

        return {
          tabBarIcon: ({ focused, size }) => {
            // Decide which icon to show per route
            switch (route.name) {
              case 'index':
                return (
                  <Ionicons
                    name={focused ? 'home' : 'home-outline'}
                    size={size}
                    color={iconColor(focused)}
                  />
                );
              case 'results':
                return (
                  <Ionicons
                    name={focused ? 'stats-chart' : 'stats-chart-outline'}
                    size={size}
                    color={iconColor(focused)}
                  />
                );
              case 'infoScreen':
                return (
                  <Ionicons
                    name={focused ? 'help-circle' : 'help-circle-outline'}
                    size={size}
                    color={iconColor(focused)}
                  />
                );
              default:
                return null;
            }
          },
          tabBarActiveTintColor: activeTintColor,
          tabBarInactiveTintColor: inactiveTintColor,
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          // tab label or title from language context
          title: t('home'),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: t('results'),
          tabBarLabel: t('results'),
        }}
      />
      {/** The new info screen tab */}
      <Tabs.Screen
        name="infoScreen"
        options={{
          title: t('info'),
          tabBarLabel: t('info'), // or 'Info', up to you
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <PairProgressProvider>
      <LanguageSchemeProvider>
        <TabLayout />
      </LanguageSchemeProvider>
    </PairProgressProvider>
  );
}
