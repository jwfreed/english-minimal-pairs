// app/(tabs)/infoScreen.tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';

export default function InfoScreen() {
  const { t, language } = useLanguageScheme();
  const themeColors = {
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    success: useThemeColor({}, 'success'),
    error: useThemeColor({}, 'error'),
    primary: useThemeColor({}, 'primary'),
    buttonText: useThemeColor({}, 'buttonText'),
  };

  const styles = createStyles(themeColors);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        styles.infoCard,
        { backgroundColor: themeColors.background },
      ]}
    >
      <Text style={styles.infoTitle}>{t('titleOne')}</Text>
      <Text style={styles.infoText}>{t('infoOne')}</Text>

      <Text style={styles.infoTitle}>{t('titleTwo')}</Text>
      <Text style={styles.infoText}>{t('infoTwo')}</Text>

      <Text style={styles.infoTitle}>{t('titleThree')}</Text>
      <Text style={styles.infoList}>{t('infoThree')}</Text>
    </ScrollView>
  );
}
