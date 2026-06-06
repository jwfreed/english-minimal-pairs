import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAllThemeColors } from '@/app/context/theme';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';
import { ThemedText } from '@/app/components/ThemedText';
import createStyles from '@/app/constants/styles';

interface OnboardingScreenProps {
  onDismiss: () => Promise<void>;
}

const BULLET_KEYS = [
  tKeys.onboardingBullet1,
  tKeys.onboardingBullet2,
  tKeys.onboardingBullet3,
  tKeys.onboardingBullet4,
  tKeys.onboardingBullet5,
] as const;

export default function OnboardingScreen({ onDismiss }: OnboardingScreenProps) {
  const theme = useAllThemeColors();
  const { translate } = useLanguage();
  const sharedStyles = useMemo(() => createStyles(theme), [theme]);
  const localStyles = useMemo(() => createOnboardingStyles(theme), [theme]);

  return (
    <View style={sharedStyles.container}>
      <View style={sharedStyles.mainCard}>
        <ThemedText style={localStyles.title} type="subtitle">
          {translate(tKeys.onboardingTitle)}
        </ThemedText>

        <View style={localStyles.bulletList}>
          {BULLET_KEYS.map((key) => (
            <View key={key} style={localStyles.bulletRow}>
              <ThemedText style={localStyles.bullet}>•</ThemedText>
              <ThemedText style={localStyles.bulletText}>{translate(key)}</ThemedText>
            </View>
          ))}
        </View>

        <TouchableOpacity
          accessibilityLabel={translate(tKeys.onboardingCTA)}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={onDismiss}
          style={sharedStyles.button}
        >
          <Text style={sharedStyles.buttonText}>{translate(tKeys.onboardingCTA)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createOnboardingStyles = (theme: ReturnType<typeof useAllThemeColors>) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      lineHeight: 30,
      marginBottom: 20,
      textAlign: 'center',
      color: theme.text,
    },
    bulletList: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bullet: {
      width: 18,
      lineHeight: 24,
      color: theme.text,
    },
    bulletText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
      color: theme.text,
    },
  });
