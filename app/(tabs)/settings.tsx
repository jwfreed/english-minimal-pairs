// app/(tabs)/settings.tsx
// -----------------------------------------------------------------------------
// Settings screen for app configuration
// -----------------------------------------------------------------------------
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
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
import { alternateLanguages } from '@/app/constants/alternateLanguages';
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
  const { translate, setLanguage } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const theme = useAllThemeColors();
  const { themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const localStyles = useMemo(() => createLocalStyles(theme), [theme]);
  const { triggerHaptic } = useHaptics();

  const {
    selectedVoice,
    availableVoices,
    isLoadingVoices,
    setSelectedVoice,
    refreshVoices,
  } = useSettings();

  const [expandedSection, setExpandedSection] = useState<string | null>('voice');
  const [hasUserSelectedLanguage, setHasUserSelectedLanguage] = useState(false);
  const [cyclingLanguageIndex, setCyclingLanguageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Check if user has ever selected a language
  useEffect(() => {
    const checkLanguageSelection = async () => {
      const hasSelected = await AsyncStorage.getItem('@hasSelectedLanguage');
      setHasUserSelectedLanguage(hasSelected === 'true');
    };
    checkLanguageSelection();
  }, []);

  // Cycle through languages if user hasn't selected one
  useEffect(() => {
    if (hasUserSelectedLanguage) return;

    const cycleDuration = 2500; // 2.5 seconds per language
    const fadeDuration = 400; // 400ms fade transition

    const cycleInterval = setInterval(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start(() => {
        // Change language
        setCyclingLanguageIndex((prev) => (prev + 1) % minimalPairs.length);
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: fadeDuration,
          useNativeDriver: true,
        }).start();
      });
    }, cycleDuration);

    return () => clearInterval(cycleInterval);
  }, [hasUserSelectedLanguage, fadeAnim]);

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
    // Mark that user has selected a language
    setHasUserSelectedLanguage(true);
    await AsyncStorage.setItem('@hasSelectedLanguage', 'true');
  }, [setCategoryIndex, setLanguage, triggerHaptic]);

  const handleThemeChange = useCallback((mode: 'system' | 'light' | 'dark') => {
    triggerHaptic('selection');
    setThemeMode(mode);
  }, [setThemeMode, triggerHaptic]);

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
              size={24}
              color={theme.primary}
              style={styles.sectionIcon}
            />
            <View style={localStyles.languageTextContainer}>
              {hasUserSelectedLanguage ? (
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.language)}
                </Text>
              ) : (
                <Animated.Text 
                  style={[
                    styles.sectionTitle, 
                    { 
                      color: theme.primary,
                      opacity: fadeAnim,
                      fontWeight: '600',
                    }
                  ]}
                >
                  {alternateLanguages[minimalPairs[cyclingLanguageIndex].category]?.language || 'Language'}
                </Animated.Text>
              )}
              {hasUserSelectedLanguage ? (
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {minimalPairs[categoryIndex].category}
                </Text>
              ) : (
                <Animated.Text 
                  style={[
                    styles.sectionSubtitle, 
                    { 
                      color: theme.primary,
                      opacity: fadeAnim,
                      fontWeight: '600',
                    }
                  ]}
                >
                  {minimalPairs[cyclingLanguageIndex].category}
                </Animated.Text>
              )}
            </View>
          </View>
          <Ionicons
            name={expandedSection === 'language' ? 'chevron-up' : 'chevron-down'}
            size={20}
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
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
              size={24}
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
            size={20}
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
                        size={20} 
                        color={theme.text} 
                        style={{ marginRight: 12 }}
                      />
                      <Text style={styles.listItemName}>
                        {modeLabels[mode]}
                      </Text>
                    </View>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
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
              size={24}
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
            size={20}
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
                          <Ionicons name="checkmark-circle" size={24} color={theme.success} />
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
    </ScrollView>
  );
}

const createLocalStyles = (theme: any) =>
  StyleSheet.create({
    languageTextContainer: {
      minWidth: 200,
      minHeight: 60,
      justifyContent: 'center',
    },
  });
