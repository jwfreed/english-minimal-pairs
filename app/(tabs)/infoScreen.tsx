// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAllThemeColors } from '@/app/context/theme';
import { tKeys } from '@/app/constants/translationKeys';

export default function InfoScreen() {
  const { translate } = useLanguage();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

  // Get app version
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber || '1';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{translate(tKeys.titleOne)}</Text>
      </View>
      
      <Text style={styles.infoText}>{translate(tKeys.infoOne)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleTwo)}</Text>
      <Text style={styles.infoText}>{translate(tKeys.infoTwo)}</Text>

      <Text style={styles.infoTitle}>{translate(tKeys.titleThree)}</Text>
      <Text style={styles.infoList}>{translate(tKeys.infoThree)}</Text>

      {/* App Info Section */}
      <View style={[styles.section, { marginTop: 32 }]}>
        <Text style={[styles.sectionTitle, { padding: 16, paddingBottom: 8 }]}>
          {translate(tKeys.appInfo)}
        </Text>
        <View style={[styles.infoRow, { paddingHorizontal: 16 }]}>
          <Text style={styles.infoLabel}>
            {translate(tKeys.version)}
          </Text>
          <Text style={styles.infoValue}>
            {appVersion}
          </Text>
        </View>
        <View style={[styles.infoRow, { paddingHorizontal: 16, paddingBottom: 8 }]}>
          <Text style={styles.infoLabel}>
            {translate(tKeys.build)}
          </Text>
          <Text style={styles.infoValue}>
            {buildNumber}
          </Text>
        </View>
      </View>
      
      <View style={styles.footer} />
    </ScrollView>
  );
}
