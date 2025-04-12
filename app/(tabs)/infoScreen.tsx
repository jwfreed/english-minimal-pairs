// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text } from 'react-native';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
// Import your consolidated hook from your theme module
import { useAllThemeColors } from '../../src/context/theme';

export default function InfoScreen() {
  const { t } = useLanguageScheme();
  // Use the consolidated theme hook instead of multiple useThemeColor calls
  const themeColors = useAllThemeColors();
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
