// /app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { PairProgressProvider } from '../../src/context/PairProgressContext';
import {
  LanguageSchemeProvider,
  useLanguageScheme,
} from '../../hooks/useLanguageScheme';

function TabLayout() {
  const { t, language } = useLanguageScheme();
  return (
    // Adding key={language} forces Tabs to remount when the language changes.
    <Tabs key={language}>
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="results" options={{ title: t('results') }} />
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
