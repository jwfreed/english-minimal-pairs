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
import Constants from 'expo-constants';
import { useSettings } from '@/app/context/SettingsContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { tKeys } from '@/app/constants/translationKeys';

/**
 * Helper function to format voice display name with gender and accent
 */
const formatVoiceName = (voice: any): { name: string; accent: string; gender: string } => {
  const name = voice.name;
  const language = voice.language.toLowerCase();
  
  // Determine accent
  let accent = '';
  if (language.startsWith('en-us')) {
    accent = 'US';
  } else if (language.startsWith('en-gb')) {
    accent = 'UK';
  }
  
  // Attempt to determine gender from voice name patterns
  // Common iOS voice naming patterns
  const nameLower = name.toLowerCase();
  let gender = '';
  
  // Common male voice names in iOS
  const maleNames = ['aaron', 'arthur', 'daniel', 'fred', 'gordon', 'harry', 'james', 'oliver', 'reed', 'thomas'];
  // Common female voice names in iOS  
  const femaleNames = ['alice', 'allison', 'ava', 'catherine', 'karen', 'martha', 'moira', 'nicky', 'samantha', 'sara', 'serena', 'susan', 'tessa', 'victoria', 'zoe'];
  
  if (maleNames.some(n => nameLower.includes(n))) {
    gender = 'Male';
  } else if (femaleNames.some(n => nameLower.includes(n))) {
    gender = 'Female';
  }
  
  return { name, accent, gender };
};

export default function SettingsScreen() {
  const { translate } = useLanguage();
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

  const handleUseDefault = async () => {
    await setSelectedVoice(null);
  };

  // Format selected voice display
  const getSelectedVoiceDisplay = () => {
    if (!selectedVoice) {
      return translate(tKeys.systemDefault);
    }
    const { name, accent, gender } = formatVoiceName(selectedVoice);
    const details = [accent, gender].filter(Boolean).join(' • ');
    return details ? `${name} (${details})` : name;
  };

  // Get app version
  const appVersion = Constants.expoConfig?.version || '1.0.0';
  const buildNumber = Constants.expoConfig?.android?.versionCode ||
    Constants.expoConfig?.ios?.buildNumber || '1';

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
                {/* Default Option */}
                <TouchableOpacity
                  style={[
                    localStyles.voiceOption,
                    !selectedVoice && localStyles.selectedVoiceOption,
                    { borderBottomColor: theme.border },
                  ]}
                  onPress={handleUseDefault}
                  activeOpacity={0.7}
                >
                  <View style={localStyles.voiceInfo}>
                    <Text style={[localStyles.voiceName, { color: theme.text }]}>
                      {translate(tKeys.systemDefault)}
                    </Text>
                    <Text style={[localStyles.voiceDetails, { color: theme.textSecondary }]}>
                      {translate(tKeys.systemDefaultDescription)}
                    </Text>
                  </View>
                  {!selectedVoice && (
                    <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                  )}
                </TouchableOpacity>

                {/* Available Voices */}
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
                    const { name, accent, gender } = formatVoiceName(voice);
                    const displayDetails = [accent, gender].filter(Boolean).join(' • ');
                    
                    return (
                      <TouchableOpacity
                        key={voice.identifier}
                        style={[
                          localStyles.voiceOption,
                          selectedVoice?.identifier === voice.identifier &&
                            localStyles.selectedVoiceOption,
                          index === availableVoices.length - 1 && localStyles.lastVoiceOption,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() => handleVoiceSelect(voice)}
                        activeOpacity={0.7}
                      >
                        <View style={localStyles.voiceInfo}>
                          <Text style={[localStyles.voiceName, { color: theme.text }]}>
                            {name}
                          </Text>
                          <Text style={[localStyles.voiceDetails, { color: theme.textSecondary }]}>
                            {displayDetails}
                          </Text>
                        </View>
                        {selectedVoice?.identifier === voice.identifier && (
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

      {/* App Info Section */}
      <View style={[localStyles.section, { backgroundColor: theme.cardBackground }]}>
        <TouchableOpacity
          style={localStyles.sectionHeader}
          onPress={() => toggleSection('info')}
          activeOpacity={0.7}
        >
          <View style={localStyles.sectionHeaderLeft}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={theme.primary}
              style={localStyles.sectionIcon}
            />
            <Text style={[localStyles.sectionTitle, { color: theme.text }]}>
              {translate(tKeys.appInfo)}
            </Text>
          </View>
          <Ionicons
            name={expandedSection === 'info' ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {expandedSection === 'info' && (
          <View style={localStyles.sectionContent}>
            <View style={localStyles.infoRow}>
              <Text style={[localStyles.infoLabel, { color: theme.textSecondary }]}>
                {translate(tKeys.version)}
              </Text>
              <Text style={[localStyles.infoValue, { color: theme.text }]}>
                {appVersion}
              </Text>
            </View>
            <View style={[localStyles.infoRow, localStyles.lastInfoRow]}>
              <Text style={[localStyles.infoLabel, { color: theme.textSecondary }]}>
                {translate(tKeys.build)}
              </Text>
              <Text style={[localStyles.infoValue, { color: theme.text }]}>
                {buildNumber}
              </Text>
            </View>
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
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    lastInfoRow: {
      borderBottomWidth: 0,
    },
    infoLabel: {
      fontSize: 16,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
    },
    footer: {
      height: 32,
    },
  });
