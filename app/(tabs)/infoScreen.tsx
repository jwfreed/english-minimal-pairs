// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAllThemeColors } from '@/app/context/theme';
import { tKeys } from '@/app/constants/translationKeys';

export default function InfoScreen() {
  const { translate } = useLanguage();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);
  const localStyles = createLocalStyles(themeColors);

  // Get app version
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber || '1';

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

      {/* App Info Section */}
      <View style={[localStyles.appInfoSection, { backgroundColor: themeColors.cardBackground }]}>
        <Text style={[localStyles.appInfoTitle, { color: themeColors.text }]}>
          {translate(tKeys.appInfo)}
        </Text>
        <View style={localStyles.infoRow}>
          <Text style={[localStyles.infoLabel, { color: themeColors.textSecondary }]}>
            {translate(tKeys.version)}
          </Text>
          <Text style={[localStyles.infoValue, { color: themeColors.text }]}>
            {appVersion}
          </Text>
        </View>
        <View style={localStyles.infoRow}>
          <Text style={[localStyles.infoLabel, { color: themeColors.textSecondary }]}>
            {translate(tKeys.build)}
          </Text>
          <Text style={[localStyles.infoValue, { color: themeColors.text }]}>
            {buildNumber}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createLocalStyles = (theme: any) =>
  StyleSheet.create({
    appInfoSection: {
      marginTop: 32,
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    appInfoTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    infoLabel: {
      fontSize: 16,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
