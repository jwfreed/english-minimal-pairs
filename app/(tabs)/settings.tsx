// app/(tabs)/settings.tsx
// -----------------------------------------------------------------------------
// Settings screen for app configuration
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
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

/**
 * Helper function to format voice display name
 * Simplified for just 2 voices: Samantha (US) and Daniel (UK)
 */
const formatVoiceName = (
  voice: any,
  translate: (key: string) => string
): { displayName: string; subtitle: string } => {
  const language = voice.language.toLowerCase();
  const isUS = language.startsWith('en-us');
  
  if (isUS) {
    return {
      displayName: translate(tKeys.usAccentFemale),
      subtitle: translate(tKeys.americanEnglish)
    };
  } else {
    return {
      displayName: translate(tKeys.ukAccentMale),
      subtitle: translate(tKeys.britishEnglish)
    };
  }
};

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
    selectedVoice,
    availableVoices,
    isLoadingVoices,
    setSelectedVoice,
    refreshVoices,
  } = useSettings();

  // When language is English, the UI is always in English. We still allow users
  // to toggle the stored preference so it takes effect when they switch languages.
  const effectiveUseEnglishUI = useEnglishUI || language === 'English';
  
  const [expandedSection, setExpandedSection] = useState<string | null>('voice');

  const toggleSection = useCallback((section: string) => {
    triggerHaptic('light');
    setExpandedSection((prev) => prev === section ? null : section);
  }, [triggerHaptic]);

  const handleVoiceSelect = useCallback(async (voice: any) => {
    triggerHaptic('selection');
    await setSelectedVoice(voice);
  }, [setSelectedVoice, triggerHaptic]);

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

  // Auto-select first voice if none selected
  React.useEffect(() => {
    if (!selectedVoice && availableVoices.length > 0 && !isLoadingVoices) {
      handleVoiceSelect(availableVoices[0]);
    }
  }, [selectedVoice, availableVoices, isLoadingVoices, handleVoiceSelect]);

  // Format selected voice display
  const selectedVoiceDisplay = useMemo(() => {
    if (!selectedVoice && availableVoices.length > 0) {
      const { displayName } = formatVoiceName(availableVoices[0], translate);
      return displayName;
    }
    if (!selectedVoice) {
      return translate(tKeys.systemDefault);
    }
    const { displayName } = formatVoiceName(selectedVoice, translate);
    return displayName;
  }, [selectedVoice, availableVoices, translate]);

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

        {/* Voice Selection Section */}
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
                  {selectedVoiceDisplay}
                </Text>
              </View>
            </View>
            <Ionicons
              name={expandedSection === 'voice' ? 'chevron-up' : 'chevron-down'}
              size={isTablet ? 28 : 20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {expandedSection === 'voice' && (
            <View style={styles.sectionContent}>
              {isLoadingVoices ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                    {translate(tKeys.loadingVoices)}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Available Voices - Only 2 options */}
                  {availableVoices.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                        {translate(tKeys.noVoicesAvailable)}
                      </Text>
                      <TouchableOpacity
                        style={styles.refreshButton}
                        onPress={refreshVoices}
                      >
                        <Ionicons name="refresh" size={20} color={theme.primary} />
                        <Text style={styles.refreshButtonText}>
                          {translate(tKeys.refresh)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    availableVoices.map((voice, index) => {
                      const { displayName, subtitle } = formatVoiceName(voice, translate);
                      const isSelected = selectedVoice?.identifier === voice.identifier || 
                                      (!selectedVoice && index === 0);
                      
                      return (
                        <TouchableOpacity
                          key={voice.identifier}
                          style={[
                            styles.listOption,
                            isSelected && styles.selectedListOption,
                            index === availableVoices.length - 1 && styles.lastListOption,
                          ]}
                          onPress={() => handleVoiceSelect(voice)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listItemInfo}>
                            <Text style={styles.listItemName}>
                              {displayName}
                            </Text>
                            <Text style={[styles.listItemDetails, { color: theme.textSecondary }]}>
                              {subtitle}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={isTablet ? 32 : 24} color={theme.success} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}
            </View>
          )}
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
