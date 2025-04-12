// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text } from 'react-native';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
// Import your consolidated hook from your theme module
import { useAllThemeColors } from '../../src/context/theme';

export default function InfoScreen() {
  const { translate } = useLanguageScheme();
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
      <Text style={styles.infoTitle}>{translate('titleOne')}</Text>
      <Text style={styles.infoText}>{translate('infoOne')}</Text>

      <Text style={styles.infoTitle}>{translate('titleTwo')}</Text>
      <Text style={styles.infoText}>{translate('infoTwo')}</Text>

      <Text style={styles.infoTitle}>{translate('titleThree')}</Text>
      <Text style={styles.infoList}>{translate('infoThree')}</Text>
    </ScrollView>
  );
}
