import React, { useMemo, useEffect } from 'react';
import { View, TouchableOpacity, Text, AccessibilityInfo } from 'react-native';
import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';
import { useHaptics } from '@/app/hooks/useHaptics';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';
import type { Pair } from '@/app/constants/minimalPairs';

interface Props {
  pair: Pair;
  onAnswer: (idx: 0 | 1) => void;
  feedback: 'correct' | 'incorrect' | null;
  disabled?: boolean;
  /** Index of the word that was played (0 = word1, 1 = word2) */
  playedIdx?: 0 | 1 | null;
  /** Replay the played word */
  onReplay?: () => void;
}

/**
 * Highlight the contrasting phoneme inside an IPA string.
 * Returns an array of {text, highlight} segments.
 */
function highlightPhoneme(ipa: string, phoneme: string): { text: string; highlight: boolean }[] {
  if (!phoneme) return [{ text: ipa, highlight: false }];
  const idx = ipa.indexOf(phoneme);
  if (idx === -1) return [{ text: ipa, highlight: false }];
  return [
    { text: ipa.slice(0, idx), highlight: false },
    { text: phoneme, highlight: true },
    { text: ipa.slice(idx + phoneme.length), highlight: false },
  ].filter((s) => s.text.length > 0);
}

export default function AnswerButtons({
  pair,
  onAnswer,
  feedback,
  disabled = false,
  playedIdx,
  onReplay,
}: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { triggerHaptic } = useHaptics();
  const { translate } = useLanguage();

  // Determine the correct word info for the feedback panel
  const correctWord = playedIdx === 0 ? pair.word1 : pair.word2;
  const correctIpa = playedIdx === 0 ? pair.ipa1 : pair.ipa2;
  const correctPhoneme = playedIdx === 0 ? pair.contrastPhoneme1 : pair.contrastPhoneme2;
  const ipaSegments = highlightPhoneme(correctIpa, correctPhoneme);

  // Trigger haptic feedback and accessibility announcement when feedback changes
  useEffect(() => {
    if (feedback === 'correct') {
      triggerHaptic('success');
      AccessibilityInfo.announceForAccessibility(
        `${translate(tKeys.correct)}. ${translate(tKeys.theWordWas)} ${correctWord}.`
      );
    } else if (feedback === 'incorrect') {
      triggerHaptic('error');
      AccessibilityInfo.announceForAccessibility(
        `${translate(tKeys.incorrect)}. ${translate(tKeys.theWordWas)} ${correctWord}.`
      );
    }
  }, [feedback, triggerHaptic, translate, correctWord]);

  const handlePress = (idx: 0 | 1) => {
    if (disabled) return;
    triggerHaptic('light');
    onAnswer(idx);
  };

  return (
    <View style={styles.answerContainer}>
      <Text style={styles.answerPrompt}>Which word did you hear?</Text>
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
              accessibilityHint="Double tap to select this word as your answer"
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
      {feedback !== null && playedIdx !== null && (
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
          <Text style={styles.feedbackWord}>{correctWord}</Text>
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
          {onReplay && (
            <TouchableOpacity
              style={styles.replayButton}
              onPress={onReplay}
              accessibilityRole="button"
              accessibilityLabel={translate(tKeys.listenAgain)}
              accessibilityHint={`Double tap to replay ${correctWord}`}
            >
              <Text style={styles.replayButtonText} importantForAccessibility="no">
                🔊 {translate(tKeys.listenAgain) || 'Listen Again'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
