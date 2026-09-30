import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { minimalPairs } from '@/src/constants/minimalPairs';
import { useAppStyles } from '@/src/hooks/useAppStyles';
import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';

interface LearnerLanguagePickerProps {
  onSelect: (categoryIndex: number) => void;
}

/**
 * Entry gate for an unresolved learner language (L1 background). Nothing is
 * preselected: the training inventory is only ever an explicit choice.
 */
export default function LearnerLanguagePicker({
  onSelect,
}: LearnerLanguagePickerProps) {
  const theme = useAllThemeColors();
  const styles = useAppStyles();
  const { translate } = useLanguage();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.mainCard}>
        <Text accessibilityRole="header" style={styles.title}>
          {translate(tKeys.chooseLearnerLanguage)}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          {translate(tKeys.learnerLanguageHint)}
        </Text>
        <View style={[styles.sectionContent, { width: '100%', marginTop: 16 }]}>
          {minimalPairs.map((category, index) => (
            <TouchableOpacity
              key={category.category}
              accessibilityRole="button"
              accessibilityLabel={category.category}
              onPress={() => onSelect(index)}
              style={[
                styles.listOption,
                index === minimalPairs.length - 1 && styles.lastListOption,
              ]}
            >
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemName}>{category.category}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
