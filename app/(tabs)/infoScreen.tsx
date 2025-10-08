// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text } from 'react-native';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAllThemeColors } from '@/app/context/theme';
import { tKeys } from '@/app/constants/translationKeys';

export default function InfoScreen() {
  const { translate } = useLanguage();
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
      <Text style={styles.infoTitle}>{translate(tKeys.titleOne)}</Text>
      <Text style={styles.infoText}>{translate(tKeys.infoOne)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleTwo)}</Text>
      <Text style={styles.infoText}>{translate(tKeys.infoTwo)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleThree)}</Text>
      <Text style={styles.infoList}>{translate(tKeys.infoThree)}</Text>
    </ScrollView>
  );
}
