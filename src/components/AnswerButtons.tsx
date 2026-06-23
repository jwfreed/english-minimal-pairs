import React, { useMemo, useEffect } from 'react';
import { View, TouchableOpacity, Text, AccessibilityInfo } from 'react-native';
import createStyles from '@/src/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';
import { useHaptics } from '@/src/hooks/useHaptics';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';
import type { Pair } from '@/src/constants/minimalPairs';
import { buildPracticeFeedbackCopy } from '@/utils/practiceFeedback';

interface Props {
  pair: Pair;
  onAnswer: (idx: 0 | 1) => void;
  feedback: 'correct' | 'incorrect' | null;
  disabled?: boolean;
  /** Index of the word that was played (0 = word1, 1 = word2) */
  playedIdx?: 0 | 1 | null;
  /** Play a specific word from the rendered pair for post-answer compare. */
  onCompareWord?: (idx: 0 | 1) => void;
  compareDisabled?: boolean;
}

/**
 * Highlight the contrasting phoneme inside an IPA string.
 * Returns an array of {text, highlight} segments.
 */
function highlightPhoneme(ipa: string, phoneme: string): { text: string; highlight: boolean }[] {
  const needle = phoneme.trim().replace(/^\/+|\/+$/g, '').trim();
  if (!needle) return [{ text: ipa, highlight: false }];
  const idx = ipa.indexOf(needle);
  if (idx === -1) return [{ text: ipa, highlight: false }];
  return [
    { text: ipa.slice(0, idx), highlight: false },
    { text: needle, highlight: true },
    { text: ipa.slice(idx + needle.length), highlight: false },
  ].filter((s) => s.text.length > 0);
}

export default function AnswerButtons({
  pair,
  onAnswer,
  feedback,
  disabled = false,
  playedIdx,
  onCompareWord,
  compareDisabled = false,
}: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { triggerHaptic } = useHaptics();
  const { translate } = useLanguage();

  const feedbackCopy = useMemo(
    () =>
      feedback !== null && playedIdx != null
        ? buildPracticeFeedbackCopy({ pair, feedback, playedIdx, translate })
        : null,
    [feedback, pair, playedIdx, translate]
  );
  const ipaSegments = feedbackCopy
    ? highlightPhoneme(feedbackCopy.correctIpa, feedbackCopy.correctPhoneme ?? '')
    : [];

  // Trigger haptic feedback and accessibility announcement when feedback changes
  useEffect(() => {
    if (feedback === 'correct' && feedbackCopy) {
      triggerHaptic('success');
      AccessibilityInfo.announceForAccessibility(feedbackCopy.headline);
    } else if (feedback === 'incorrect' && feedbackCopy) {
      triggerHaptic('error');
      AccessibilityInfo.announceForAccessibility(
        `${translate(tKeys.incorrect)}. ${feedbackCopy.headline} ${feedbackCopy.detail ?? ''}`.trim()
      );
    }
  }, [feedback, feedbackCopy, triggerHaptic, translate]);

  const handlePress = (idx: 0 | 1) => {
    if (disabled) return;
    triggerHaptic('light');
    onAnswer(idx);
  };

  return (
    <View style={styles.answerContainer}>
      <Text style={styles.answerPrompt}>{translate(tKeys.whichWordDidYouHear)}</Text>
      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => {
          const word = idx ? pair.word2 : pair.word1;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.button,
                { flex: 1, marginTop: 0 },
                feedback !== null && { opacity: 0.5 },
              ]}
              onPress={() => handlePress(idx as 0 | 1)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={word}
              accessibilityHint={translate(tKeys.doubleTapToSelectWord)}
              accessibilityState={{ disabled }}
            >
              <Text style={styles.buttonText} importantForAccessibility="no">
                {word}
              </Text>
              <Text
                style={styles.ipaText}
                importantForAccessibility="no"
                accessibilityElementsHidden={true}
              >
                {idx ? pair.ipa2 : pair.ipa1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Rich feedback panel — shown after answering */}
      {feedbackCopy && (
        <View style={styles.feedbackPanel}>
          <Text
            style={[
              styles.feedbackSymbol,
              feedback === 'correct'
                ? styles.correctFeedback
                : styles.incorrectFeedback,
            ]}
            importantForAccessibility="no"
            accessibilityElementsHidden={true}
          >
            {feedback === 'correct' ? '✓' : '✗'}
          </Text>
          <Text style={styles.feedbackWord}>{feedbackCopy.headline}</Text>
          {feedbackCopy.detail && (
            <Text style={styles.feedbackDetail}>{feedbackCopy.detail}</Text>
          )}
          <Text
            style={styles.feedbackIPA}
            importantForAccessibility="no"
            accessibilityElementsHidden={true}
          >
            {ipaSegments.map((seg, i) =>
              seg.highlight ? (
                <Text key={i} style={styles.feedbackHighlight}>
                  {seg.text}
                </Text>
              ) : (
                <Text key={i}>{seg.text}</Text>
              )
            )}
          </Text>
          {feedback === 'incorrect' && onCompareWord && (
            <View style={styles.compareContainer}>
              <Text style={styles.compareTitle}>{translate(tKeys.compareTheTwoWords)}</Text>
              <View style={styles.compareButtonRow}>
                {[
                  { idx: 0 as const, word: pair.word1, ipa: pair.ipa1 },
                  { idx: 1 as const, word: pair.word2, ipa: pair.ipa2 },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.idx}
                    style={[
                      styles.compareButton,
                      compareDisabled && styles.compareButtonDisabled,
                    ]}
                    onPress={() => onCompareWord(item.idx)}
                    disabled={compareDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={`${translate(tKeys.play)} ${item.word} ${item.ipa}`}
                    accessibilityHint={`${translate(tKeys.doubleTapToHear)} ${item.word}`}
                    accessibilityState={{ disabled: compareDisabled }}
                  >
                    <Text style={styles.compareButtonText} importantForAccessibility="no">
                      {translate(tKeys.play)} {item.word}
                    </Text>
                    <Text style={styles.compareButtonIpa} importantForAccessibility="no">
                      {item.ipa}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
