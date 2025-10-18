// app/(tabs)/settings.tsx
// -----------------------------------------------------------------------------
// Settings screen for app configuration
// -----------------------------------------------------------------------------
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '@/app/context/SettingsContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { tKeys } from '@/app/constants/translationKeys';
import { minimalPairs } from '@/app/constants/minimalPairs';

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
  const styles = createStyles(theme);
  const localStyles = createLocalStyles(theme);

  const {
    selectedVoice,
    availableVoices,
    isLoadingVoices,
    setSelectedVoice,
    refreshVoices,
  } = useSettings();

  const [expandedSection, setExpandedSection] = useState<string | null>('voice');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleVoiceSelect = async (voice: any) => {
    await setSelectedVoice(voice);
  };

  const handleLanguageSelect = (idx: number) => {
    setCategoryIndex(idx);
    setLanguage(minimalPairs[idx].category);
  };

  // Auto-select first voice if none selected
  React.useEffect(() => {
    if (!selectedVoice && availableVoices.length > 0 && !isLoadingVoices) {
      handleVoiceSelect(availableVoices[0]);
    }
  }, [selectedVoice, availableVoices, isLoadingVoices]);

  // Format selected voice display
  const getSelectedVoiceDisplay = () => {
    if (!selectedVoice && availableVoices.length > 0) {
      const { displayName } = formatVoiceName(availableVoices[0], translate);
      return displayName;
    }
    if (!selectedVoice) {
      return translate(tKeys.systemDefault);
    }
    const { displayName } = formatVoiceName(selectedVoice, translate);
    return displayName;
  };

  return (
    <ScrollView
      style={[localStyles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={localStyles.contentContainer}
    >
      {/* Header */}
      <View style={localStyles.header}>
        <Text style={[localStyles.headerTitle, { color: theme.text }]}>
          {translate(tKeys.settings)}
        </Text>
        <Text style={[localStyles.headerSubtitle, { color: theme.textSecondary }]}>
          {translate(tKeys.configureApp)}
        </Text>
      </View>

      {/* Language Selection Section */}
      <View style={[localStyles.section, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={localStyles.sectionHeader}
          onPress={() => toggleSection('language')}
          activeOpacity={0.7}
        >
          <View style={localStyles.sectionHeaderLeft}>
            <Ionicons
              name="language-outline"
              size={24}
              color={theme.primary}
              style={localStyles.sectionIcon}
            />
            <View>
              <Text style={[localStyles.sectionTitle, { color: theme.text }]}>
                {translate(tKeys.language)}
              </Text>
              <Text style={[localStyles.sectionSubtitle, { color: theme.textSecondary }]}>
                {minimalPairs[categoryIndex].category}
              </Text>
            </View>
          </View>
          <Ionicons
            name={expandedSection === 'language' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {expandedSection === 'language' && (
          <View style={localStyles.sectionContent}>
            {minimalPairs.map((cat, index) => {
              const isSelected = categoryIndex === index;
              
              return (
                <TouchableOpacity
                  key={cat.category}
                  style={[
                    localStyles.voiceOption,
                    isSelected && localStyles.selectedVoiceOption,
                    index === minimalPairs.length - 1 && localStyles.lastVoiceOption,
                    { borderBottomColor: theme.border },
                  ]}
                  onPress={() => handleLanguageSelect(index)}
                  activeOpacity={0.7}
                >
                  <View style={localStyles.voiceInfo}>
                    <Text style={[localStyles.voiceName, { color: theme.text }]}>
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

      {/* Voice Selection Section */}
      <View style={[localStyles.section, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={localStyles.sectionHeader}
          onPress={() => toggleSection('voice')}
          activeOpacity={0.7}
        >
          <View style={localStyles.sectionHeaderLeft}>
            <Ionicons
              name="mic-outline"
              size={24}
              color={theme.primary}
              style={localStyles.sectionIcon}
            />
            <View>
              <Text style={[localStyles.sectionTitle, { color: theme.text }]}>
                {translate(tKeys.voiceSelection)}
              </Text>
              <Text style={[localStyles.sectionSubtitle, { color: theme.textSecondary }]}>
                {getSelectedVoiceDisplay()}
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
          <View style={localStyles.sectionContent}>
            {isLoadingVoices ? (
              <View style={localStyles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[localStyles.loadingText, { color: theme.textSecondary }]}>
                  {translate(tKeys.loadingVoices)}
                </Text>
              </View>
            ) : (
              <>
                {/* Available Voices - Only 2 options */}
                {availableVoices.length === 0 ? (
                  <View style={localStyles.emptyContainer}>
                    <Text style={[localStyles.emptyText, { color: theme.textSecondary }]}>
                      {translate(tKeys.noVoicesAvailable)}
                    </Text>
                    <TouchableOpacity
                      style={[localStyles.refreshButton, { borderColor: theme.primary }]}
                      onPress={refreshVoices}
                    >
                      <Ionicons name="refresh" size={20} color={theme.primary} />
                      <Text style={[localStyles.refreshButtonText, { color: theme.primary }]}>
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
                          localStyles.voiceOption,
                          isSelected && localStyles.selectedVoiceOption,
                          index === availableVoices.length - 1 && localStyles.lastVoiceOption,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() => handleVoiceSelect(voice)}
                        activeOpacity={0.7}
                      >
                        <View style={localStyles.voiceInfo}>
                          <Text style={[localStyles.voiceName, { color: theme.text }]}>
                            {displayName}
                          </Text>
                          <Text style={[localStyles.voiceDetails, { color: theme.textSecondary }]}>
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
      <View style={localStyles.footer} />
    </ScrollView>
  );
}

const createLocalStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
    },
    header: {
      marginBottom: 24,
      paddingTop: 8,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
    },
    section: {
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    sectionIcon: {
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    sectionSubtitle: {
      fontSize: 14,
      marginTop: 2,
    },
    sectionContent: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    loadingContainer: {
      padding: 32,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
    },
    voiceOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
    },
    selectedVoiceOption: {
      backgroundColor: theme.primaryLight || theme.primary + '15',
    },
    lastVoiceOption: {
      borderBottomWidth: 0,
    },
    voiceInfo: {
      flex: 1,
      marginRight: 12,
    },
    voiceName: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 4,
    },
    voiceDetails: {
      fontSize: 14,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderRadius: 8,
    },
    refreshButtonText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '600',
    },
    footer: {
      height: 32,
    },
  });
