import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import type { ContrastId } from '@/src/domain/identity';
import type { ContrastPracticeSuggestion } from '@/src/domain/practice/nextContrastSuggestion';
import { formatTranslation } from '@/utils/formatTranslation';

interface NextContrastSuggestionProps {
  suggestion: ContrastPracticeSuggestion;
  onSelect: (contrastId: ContrastId) => void;
}

export default function NextContrastSuggestion({
  suggestion,
  onSelect,
}: NextContrastSuggestionProps) {
  const { translate } = useLanguage();
  const theme = useAllThemeColors();

  if (!suggestion) return null;

  const contrast = contrastRegistry.getById(suggestion.contrastId);
  if (!contrast) return null;

  const contrastLabel = `/${contrast.phoneme1}/ vs /${contrast.phoneme2}/`;
  const eyebrow = translate(tKeys.suggestedNext);
  const body =
    suggestion.kind === 'continue-current'
      ? translate(tKeys.continueCurrentSuggestion)
      : formatTranslation(translate(tKeys.tryUnobservedSuggestion), {
          contrastLabel,
        });

  return (
    <TouchableOpacity
      accessibilityLabel={`${eyebrow}. ${body}`}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={() => onSelect(suggestion.contrastId)}
      style={[
        styles.container,
        {
          backgroundColor: theme.surfaceTint,
          borderColor: theme.hairline,
        },
      ]}
    >
      <Text style={[styles.eyebrow, { color: theme.primaryText }]}>
        {eyebrow}
      </Text>
      <Text style={[styles.body, { color: theme.text }]}>{body}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 56,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: 14,
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
