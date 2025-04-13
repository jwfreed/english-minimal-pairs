// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PairProgressProvider } from '../../src/context/PairProgressContext';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { CategoryProvider } from '../../src/context/CategoryContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { tKeys } from '../../constants/translationKeys';

function TabLayout() {
  const { translate, language } = useLanguage();
  const deviceColorScheme = useColorScheme();

  const activeTintColor =
    deviceColorScheme === 'dark' ? Colors.dark.primary : Colors.light.primary;
  const inactiveTintColor = '#888';

  return (
    <Tabs
      key={language}
      screenOptions={({ route }) => {
        const iconColor = (focused: boolean) =>
          focused ? activeTintColor : inactiveTintColor;

        return {
          tabBarIcon: ({ focused, size }) => {
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
      <Tabs.Screen name="index" options={{ title: translate(tKeys.home) }} />
      <Tabs.Screen
        name="results"
        options={{
          title: translate(tKeys.results),
          tabBarLabel: translate(tKeys.results),
        }}
      />
      <Tabs.Screen
        name="infoScreen"
        options={{
          title: translate(tKeys.info),
          tabBarLabel: translate(tKeys.info),
        }}
      />
    </Tabs>
  );
}

export default function Layout() {
  return (
    <PairProgressProvider>
      <LanguageProvider>
        <CategoryProvider>
          <TabLayout />
        </CategoryProvider>
      </LanguageProvider>
    </PairProgressProvider>
  );
}
