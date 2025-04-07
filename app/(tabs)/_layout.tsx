import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Ionicons from expo
import { PairProgressProvider } from '../../src/context/PairProgressContext';
import {
  LanguageSchemeProvider,
  useLanguageScheme,
} from '../../hooks/useLanguageScheme';
import { useColorScheme } from 'react-native'; // to detect theme if needed
import { Colors } from '@/constants/Colors'; // your theme colors

function TabLayout() {
  const { t, language } = useLanguageScheme();
  const deviceColorScheme = useColorScheme();

  // For tab icon colors
  const activeTintColor =
    deviceColorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary; // Example usage
  const inactiveTintColor = '#888';

  return (
    // Adding key={language} forces Tabs to remount when language changes.
    <Tabs
      key={language}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          // Override color so we can have active/inactive tints
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
            default:
              return null;
          }
        },
        tabBarActiveTintColor: activeTintColor,
        tabBarInactiveTintColor: inactiveTintColor,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          // If you want a specific tabBarLabel:
          // tabBarLabel: t('home'),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: t('results'),
          // tabBarLabel: t('results'),
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
