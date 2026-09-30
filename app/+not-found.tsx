import { Link, Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/src/components/ThemedText';
import { ThemedView } from '@/src/components/ThemedView';
import { tKeys } from '@/src/constants/translationKeys';
import { LanguageProvider, useLanguage } from '@/src/context/LanguageContext';

function NotFoundContent() {
  const { translate } = useLanguage();
  return (
    <>
      <Stack.Screen
        options={{
          title: translate(tKeys.notFoundTitle),
          // The back button would be labelled with the route group's internal
          // name "(tabs)"; the "Go to Practice" link below is the way back.
          headerBackVisible: false,
        }}
      />
      <ThemedView style={styles.container}>
        <ThemedText type="title" accessibilityRole="header">
          {translate(tKeys.notFoundMessage)}
        </ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText type="link">{translate(tKeys.goToPractice)}</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

// This route sits outside the tab layout's providers, so it supplies its own
// LanguageProvider to show the learner's UI language.
export default function NotFoundScreen() {
  return (
    <LanguageProvider>
      <NotFoundContent />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
