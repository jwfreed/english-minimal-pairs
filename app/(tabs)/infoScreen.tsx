// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAllThemeColors } from '@/app/context/theme';
import { tKeys } from '@/app/constants/translationKeys';

export default function InfoScreen() {
  const { translate } = useLanguage();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);
  const { width } = useWindowDimensions();
  const isTablet = width > 700;

  // Get app version
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber || '1';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={{ width: '100%', maxWidth: isTablet ? 800 : 600, alignSelf: 'center' }}>
        <View style={styles.header}>
          <View style={{
            width: isTablet ? 100 : 60,
            height: isTablet ? 100 : 60,
            marginBottom: 16,
            alignSelf: 'center',
            borderRadius: isTablet ? 20 : 12,
            backgroundColor: themeColors.primary,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Ionicons name="ear-outline" size={isTablet ? 60 : 36} color="white" />
          </View>
          <Text style={styles.headerTitle}>{translate(tKeys.titleOne)}</Text>
        </View>
        
        <View style={[styles.section, { padding: isTablet ? 32 : 20 }]}>
          <Text style={styles.infoText}>{translate(tKeys.infoOne)}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <View style={{
              width: isTablet ? 64 : 32,
              height: isTablet ? 64 : 32,
              marginRight: 12,
              borderRadius: isTablet ? 16 : 8,
              backgroundColor: themeColors.primary,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ionicons name="flag-outline" size={isTablet ? 36 : 20} color="white" />
            </View>
            <Text style={[styles.infoTitle, { marginTop: 0, marginBottom: 0 }]}>{translate(tKeys.titleTwo)}</Text>
          </View>
          <Text style={styles.infoText}>{translate(tKeys.infoTwo)}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <View style={{
              width: isTablet ? 64 : 32,
              height: isTablet ? 64 : 32,
              marginRight: 12,
              borderRadius: isTablet ? 16 : 8,
              backgroundColor: themeColors.primary,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Ionicons name="list-outline" size={isTablet ? 36 : 20} color="white" />
            </View>
            <Text style={[styles.infoTitle, { marginTop: 0, marginBottom: 0 }]}>{translate(tKeys.titleThree)}</Text>
          </View>
          <Text style={styles.infoList}>{translate(tKeys.infoThree)}</Text>
        </View>

        {/* App Info Section */}
        <View style={[styles.section, { marginTop: 16 }]}>
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
      </View>
    </ScrollView>
  );
}
