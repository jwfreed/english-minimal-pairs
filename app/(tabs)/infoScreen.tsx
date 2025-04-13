// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text } from 'react-native';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { useAllThemeColors } from '../../src/context/theme';
import { tKeys } from '../../constants/translationKeys';

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
      <Text style={styles.infoTitle}>{translate(tKeys.titleOne)}</Text>
      <Text style={styles.infoText}>{translate(tKeys.infoOne)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleTwo)}</Text>
      <Text style={styles.infoText}>{translate(tKeys.infoTwo)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleThree)}</Text>
      <Text style={styles.infoList}>{translate(tKeys.infoThree)}</Text>
    </ScrollView>
  );
}
