// app/(tabs)/settings.tsx
// -----------------------------------------------------------------------------
// Settings screen for app configuration
// -----------------------------------------------------------------------------
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '@/app/context/SettingsContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { useAllThemeColors, useTheme } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { tKeys } from '@/app/constants/translationKeys';
import { minimalPairs } from '@/app/constants/minimalPairs';
import { useHaptics } from '@/app/hooks/useHaptics';

const PLACEMENT_DONE_KEY = '@placementDone';

export default function SettingsScreen() {
  const { translate, setLanguage, useEnglishUI, setUseEnglishUI, language } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const theme = useAllThemeColors();
  const { themeMode, setThemeMode } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width > 700;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const localStyles = useMemo(() => createLocalStyles(theme, isTablet), [theme, isTablet]);
  const { triggerHaptic } = useHaptics();

  const {
    allVoices,
    voiceCount,
    excludedVoiceIds,
    toggleVoice,
    isLoadingVoices,
    refreshVoices,
  } = useSettings();

  // When language is English, the UI is always in English. We still allow users
  // to toggle the stored preference so it takes effect when they switch languages.
  const effectiveUseEnglishUI = useEnglishUI || language === 'English';
  
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = useCallback((section: string) => {
    triggerHaptic('light');
    setExpandedSection((prev) => prev === section ? null : section);
  }, [triggerHaptic]);

  const handleLanguageSelect = useCallback(async (idx: number) => {
    triggerHaptic('selection');
    setCategoryIndex(idx);
    setLanguage(minimalPairs[idx].category);
  }, [setCategoryIndex, setLanguage, triggerHaptic]);

  const handleThemeChange = useCallback((mode: 'system' | 'light' | 'dark') => {
    triggerHaptic('selection');
    setThemeMode(mode);
  }, [setThemeMode, triggerHaptic]);

  const handleEnglishUIToggle = useCallback(() => {
    triggerHaptic('selection');
    setUseEnglishUI(!useEnglishUI);
  }, [useEnglishUI, setUseEnglishUI, triggerHaptic]);

  const handleRetakePlacement = useCallback(async () => {
    triggerHaptic('selection');
    await AsyncStorage.removeItem(PLACEMENT_DONE_KEY).catch(() => {});
    Alert.alert(
      translate(tKeys.placementTest) || 'Placement Test',
      translate(tKeys.placementResetConfirm) || 'The placement test will run when you return to the Practice tab.',
    );
  }, [triggerHaptic, translate]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={{ width: '100%', maxWidth: isTablet ? 800 : 600, alignSelf: 'center' }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {translate(tKeys.settings)}
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {translate(tKeys.configureApp)}
          </Text>
        </View>

        {/* Language Selection Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('language')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="language-outline"
                size={isTablet ? 32 : 24}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <View style={localStyles.languageTextContainer}>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.language)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {minimalPairs[categoryIndex].category}
                </Text>
              </View>
            </View>
            <Ionicons
              name={expandedSection === 'language' ? 'chevron-up' : 'chevron-down'}
              size={isTablet ? 28 : 20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {expandedSection === 'language' && (
            <View style={styles.sectionContent}>
              {minimalPairs.map((cat, index) => {
                const isSelected = categoryIndex === index;
                
                return (
                  <TouchableOpacity
                    key={cat.category}
                    style={[
                      styles.listOption,
                      isSelected && styles.selectedListOption,
                      index === minimalPairs.length - 1 && styles.lastListOption,
                    ]}
                    onPress={() => handleLanguageSelect(index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>
                        {cat.category}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={isTablet ? 32 : 24} color={theme.success} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* English UI Toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={handleEnglishUIToggle}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="globe-outline"
                size={isTablet ? 32 : 24}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.useEnglishUI)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {translate(tKeys.englishUIDescription)}
                </Text>
              </View>
            </View>
            <View style={[
              localStyles.toggleSwitch,
              useEnglishUI && { backgroundColor: theme.success }
            ]}>
              <View style={[
                localStyles.toggleThumb,
                useEnglishUI && localStyles.toggleThumbActive
              ]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Appearance/Theme Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('theme')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name={themeMode === 'dark' ? 'moon-outline' : themeMode === 'light' ? 'sunny-outline' : 'phone-portrait-outline'}
                size={isTablet ? 32 : 24}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.appearance)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {themeMode === 'system' 
                    ? translate(tKeys.systemMode)
                    : themeMode === 'light' 
                    ? translate(tKeys.lightMode)
                    : translate(tKeys.darkMode)}
                </Text>
              </View>
            </View>
            <Ionicons
              name={expandedSection === 'theme' ? 'chevron-up' : 'chevron-down'}
              size={isTablet ? 28 : 20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {expandedSection === 'theme' && (
            <View style={styles.sectionContent}>
              {(['system', 'light', 'dark'] as const).map((mode, index) => {
                const isSelected = themeMode === mode;
                const modeLabels = {
                  system: translate(tKeys.systemMode),
                  light: translate(tKeys.lightMode),
                  dark: translate(tKeys.darkMode),
                };
                const modeIcons = {
                  system: 'phone-portrait-outline' as const,
                  light: 'sunny-outline' as const,
                  dark: 'moon-outline' as const,
                };
                
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.listOption,
                      isSelected && styles.selectedListOption,
                      index === 2 && styles.lastListOption,
                    ]}
                    onPress={() => handleThemeChange(mode)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.listItemInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons 
                          name={modeIcons[mode]} 
                          size={isTablet ? 28 : 20} 
                          color={theme.text} 
                          style={{ marginRight: 12 }}
                        />
                        <Text style={styles.listItemName}>
                          {modeLabels[mode]}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={isTablet ? 32 : 24} color={theme.success} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Voice Management Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('voice')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="mic-outline"
                size={isTablet ? 32 : 24}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.voiceSelection)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {isLoadingVoices
                    ? translate(tKeys.loadingVoices)
                    : `${voiceCount} active / ${allVoices.length} total`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={refreshVoices} style={{ padding: 8 }}>
                <Ionicons name="refresh" size={isTablet ? 24 : 18} color={theme.primary} />
              </TouchableOpacity>
              <Ionicons
                name={expandedSection === 'voice' ? 'chevron-up' : 'chevron-down'}
                size={isTablet ? 28 : 20}
                color={theme.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {expandedSection === 'voice' && (
            <View style={styles.sectionContent}>
              {allVoices.length === 0 && !isLoadingVoices && (
                <Text style={[styles.sectionSubtitle, { padding: 12, color: theme.textSecondary }]}>
                  No English voices found on this device.
                </Text>
              )}
              {isLoadingVoices && (
                <ActivityIndicator style={{ padding: 12 }} color={theme.primary} />
              )}
              {allVoices.map((voice, index) => {
                const excluded = excludedVoiceIds.has(voice.identifier);
                const qualityLabel = (voice.quality ?? '').toLowerCase().includes('enhanced')
                  ? ' ★'
                  : '';
                return (
                  <TouchableOpacity
                    key={voice.identifier}
                    style={[
                      styles.listOption,
                      !excluded && styles.selectedListOption,
                      index === allVoices.length - 1 && styles.lastListOption,
                    ]}
                    onPress={() => {
                      triggerHaptic('selection');
                      toggleVoice(voice.identifier);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.listItemInfo}>
                      <Text
                        style={[
                          styles.listItemName,
                          excluded && { color: theme.textSecondary, textDecorationLine: 'line-through' },
                        ]}
                        numberOfLines={1}
                      >
                        {voice.name}{qualityLabel}
                      </Text>
                      <Text style={[styles.sectionSubtitle, { color: theme.textSecondary, fontSize: isTablet ? 13 : 11 }]}>
                        {voice.language}  ·  {voice.identifier.length > 40 ? voice.identifier.slice(0, 40) + '…' : voice.identifier}
                      </Text>
                    </View>
                    <Ionicons
                      name={excluded ? 'close-circle' : 'checkmark-circle'}
                      size={isTablet ? 28 : 22}
                      color={excluded ? theme.error : theme.success}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Placement Test Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={handleRetakePlacement}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="school-outline"
                size={isTablet ? 32 : 24}
                color={theme.primary}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.placementTest) || 'Placement Test'}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {translate(tKeys.retakePlacement) || 'Retake on next practice session'}
                </Text>
              </View>
            </View>
            <Ionicons
              name="refresh-circle-outline"
              size={isTablet ? 28 : 20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Footer Spacer */}
        <View style={styles.footer} />
      </View>
    </ScrollView>
  );
}

const createLocalStyles = (theme: any, isTablet: boolean) =>
  StyleSheet.create({
    languageTextContainer: {
      minWidth: isTablet ? 300 : 200,
      minHeight: isTablet ? 80 : 60,
      justifyContent: 'center',
    },
    toggleSwitch: {
      width: isTablet ? 70 : 50,
      height: isTablet ? 42 : 30,
      borderRadius: isTablet ? 21 : 15,
      backgroundColor: theme.border,
      padding: isTablet ? 3 : 2,
      justifyContent: 'center',
    },
    toggleThumb: {
      width: isTablet ? 36 : 26,
      height: isTablet ? 36 : 26,
      borderRadius: isTablet ? 18 : 13,
      backgroundColor: theme.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    toggleThumbActive: {
      transform: [{ translateX: isTablet ? 28 : 20 }],
    },
  });
