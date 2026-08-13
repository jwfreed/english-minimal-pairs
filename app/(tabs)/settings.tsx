// app/(tabs)/settings.tsx
// -----------------------------------------------------------------------------
// Settings screen for app configuration
// -----------------------------------------------------------------------------
import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import AnimatedToggle from '@/src/components/ui/AnimatedToggle';
import FlashPressable from '@/src/components/ui/FlashPressable';
import { useSettings } from '@/src/context/SettingsContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCategory } from '@/src/context/CategoryContext';
import { useAllThemeColors, useTheme } from '@/src/context/theme';
import createStyles from '@/src/constants/styles';
import { tKeys } from '@/src/constants/translationKeys';
import { minimalPairs } from '@/src/constants/minimalPairs';
import { useHaptics } from '@/src/hooks/useHaptics';
import { ContrastKnowledgeInspectionSection } from '@/src/dev/ContrastKnowledgeInspectionSection';
import {
  PLACEMENT_LEGACY_MIGRATION_KEY,
  buildPlacementStorageKey,
  serializePlacementDone,
  shouldShowPlacementTestForCategory,
} from '@/src/domain/masteryPersistence';

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

  // Track whether placement is done for the currently selected category.
  const currentCatKey = minimalPairs[categoryIndex].category;
  const [placementDone, setPlacementDone] = useState(false);
  useEffect(() => {
    const perCatKey = buildPlacementStorageKey(currentCatKey);
    AsyncStorage.getItem(perCatKey)
      .then((catVal) => {
        setPlacementDone(!shouldShowPlacementTestForCategory(catVal));
      })
      .catch(() => {});
  }, [currentCatKey]);

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
    const perCatKey = buildPlacementStorageKey(currentCatKey);
    await AsyncStorage.removeItem(perCatKey).catch(() => {});
    // Write the migration sentinel so the legacy key cannot silently re-seed
    // this category when the user navigates to the Practice tab.
    await AsyncStorage.setItem(PLACEMENT_LEGACY_MIGRATION_KEY, serializePlacementDone()).catch(() => {});
    setPlacementDone(false);
    Alert.alert(
      translate(tKeys.placementTest),
      translate(tKeys.placementResetConfirm),
    );
  }, [triggerHaptic, translate, currentCatKey]);

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
          <FlashPressable
            style={styles.sectionHeader}
            onPress={() => toggleSection('language')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="language-outline"
                size={19}
                color={theme.primaryText}
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
          </FlashPressable>

          {expandedSection === 'language' && (
            <View style={styles.sectionContent}>
              {minimalPairs.map((cat, index) => {
                const isSelected = categoryIndex === index;

                return (
                  <FlashPressable
                    key={cat.category}
                    style={[
                      styles.listOption,
                      isSelected && styles.selectedListOption,
                      index === minimalPairs.length - 1 && styles.lastListOption,
                    ]}
                    onPress={() => handleLanguageSelect(index)}
                  >
                    <View style={styles.listItemInfo}>
                      <Text style={styles.listItemName}>
                        {cat.category}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={isTablet ? 32 : 24} color={theme.success} />
                    )}
                  </FlashPressable>
                );
              })}
            </View>
          )}
          <View style={localStyles.insetSeparator} />

          {/* English UI Toggle */}
          <FlashPressable
            style={styles.sectionHeader}
            onPress={handleEnglishUIToggle}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="globe-outline"
                size={19}
                color={theme.primaryText}
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
            <AnimatedToggle
              value={effectiveUseEnglishUI}
              onColor={theme.success}
              offColor={theme.border}
              thumbTravel={isTablet ? 28 : 20}
              trackStyle={localStyles.toggleSwitch}
              thumbStyle={localStyles.toggleThumb}
            />
          </FlashPressable>
        </View>

        {/* Appearance/Theme Section */}
        <View style={styles.section}>
          <FlashPressable
            style={styles.sectionHeader}
            onPress={() => toggleSection('theme')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name={themeMode === 'dark' ? 'moon-outline' : themeMode === 'light' ? 'sunny-outline' : 'phone-portrait-outline'}
                size={19}
                color={theme.primaryText}
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
          </FlashPressable>

          {expandedSection === 'theme' && (
            <View style={[styles.sectionContent, localStyles.appearanceContent]}>
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
                  <FlashPressable
                    key={mode}
                    style={[
                      styles.listOption,
                      localStyles.appearanceOption,
                      isSelected && styles.selectedListOption,
                      index === 2 && styles.lastListOption,
                    ]}
                    highlightRadius={12}
                    onPress={() => handleThemeChange(mode)}
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
                  </FlashPressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Voice Management Section */}
        <View style={styles.section}>
          <FlashPressable
            style={styles.sectionHeader}
            onPress={() => toggleSection('voice')}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="mic-outline"
                size={19}
                color={theme.primaryText}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.voiceSelection)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {isLoadingVoices
                    ? translate(tKeys.loadingVoices)
                    : `${voiceCount} ${translate(tKeys.voiceActive)} / ${allVoices.length} ${translate(tKeys.total)}`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={refreshVoices} style={{ padding: 8 }}>
                <Ionicons name="refresh" size={18} color={theme.primaryText} />
              </TouchableOpacity>
              <Ionicons
                name={expandedSection === 'voice' ? 'chevron-up' : 'chevron-down'}
                size={isTablet ? 28 : 20}
                color={theme.textSecondary}
              />
            </View>
          </FlashPressable>

          {expandedSection === 'voice' && (
            <View style={styles.sectionContent}>
              {allVoices.length === 0 && !isLoadingVoices && (
                <Text style={[styles.sectionSubtitle, { padding: 12, color: theme.textSecondary }]}>
                  {translate(tKeys.noVoicesAvailable)}
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
                  <FlashPressable
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
                  </FlashPressable>
                );
              })}
            </View>
          )}
          <View style={localStyles.insetSeparator} />

          {/* Placement Test Section */}
          <FlashPressable
            style={styles.sectionHeader}
            onPress={handleRetakePlacement}
          >
            <View style={styles.sectionHeaderLeft}>
              <Ionicons
                name="school-outline"
                size={19}
                color={theme.primaryText}
                style={styles.sectionIcon}
              />
              <View>
                <Text style={styles.sectionTitle}>
                  {translate(tKeys.placementTest)}
                </Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {translate(tKeys.placementDescription)}
                </Text>
                <View style={styles.placementStatusRow}>
                  {placementDone ? (
                    <>
                      <Ionicons name="checkmark-circle" size={isTablet ? 18 : 14} color={theme.success} />
                      <Text style={[styles.placementStatusText, { color: theme.success }]}>
                        {translate(tKeys.placementCompleted)}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="ellipse-outline" size={isTablet ? 18 : 14} color={theme.textSecondary} />
                      <Text style={[styles.placementStatusText, { color: theme.textSecondary }]}>
                        {translate(tKeys.retakePlacement)}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </View>
            <Ionicons
              name="refresh-circle-outline"
              size={isTablet ? 28 : 20}
              color={theme.textSecondary}
            />
          </FlashPressable>
        </View>

        {__DEV__ && (
          <ContrastKnowledgeInspectionSection categoryLabel={currentCatKey} />
        )}

        {/* Footer Spacer */}
        <View style={styles.footer} />
      </View>
    </ScrollView>
  );
}

const createLocalStyles = (theme: any, isTablet: boolean) =>
  StyleSheet.create({
    languageTextContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    insetSeparator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 64,
      backgroundColor: theme.hairline,
    },
    appearanceContent: {
      borderTopWidth: 0,
      paddingBottom: 6,
    },
    appearanceOption: {
      marginHorizontal: 8,
      borderBottomWidth: 0,
      borderRadius: 12,
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
      backgroundColor: theme.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
  });
