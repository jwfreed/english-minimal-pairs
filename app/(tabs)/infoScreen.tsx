// app/(tabs)/infoScreen.tsx
import React from 'react';
import { ScrollView, Text, View, Image } from 'react-native';
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
      <View style={{ width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/info-intro.png')} 
            style={{ width: 60, height: 60, marginBottom: 16, alignSelf: 'center', borderRadius: 12 }}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{translate(tKeys.titleOne)}</Text>
        </View>
        
        <View style={[styles.section, { padding: 20 }]}>
          <Text style={styles.infoText}>{translate(tKeys.infoOne)}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <Image 
              source={require('@/assets/images/info-goal.png')} 
              style={{ width: 32, height: 32, marginRight: 12, borderRadius: 8 }}
              resizeMode="contain"
            />
            <Text style={[styles.infoTitle, { marginTop: 0, marginBottom: 0 }]}>{translate(tKeys.titleTwo)}</Text>
          </View>
          <Text style={styles.infoText}>{translate(tKeys.infoTwo)}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <Image 
              source={require('@/assets/images/info-howto.png')} 
              style={{ width: 32, height: 32, marginRight: 12, borderRadius: 8 }}
              resizeMode="contain"
            />
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
