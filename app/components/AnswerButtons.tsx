import React, { useMemo, useEffect } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
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

  // Trigger haptic feedback when feedback changes
  useEffect(() => {
    if (feedback === 'correct') {
      triggerHaptic('success');
    } else if (feedback === 'incorrect') {
      triggerHaptic('error');
    }
  }, [feedback, triggerHaptic]);

  const handlePress = (idx: 0 | 1) => {
    if (disabled) return;
    triggerHaptic('light');
    onAnswer(idx);
  };

  // Determine the correct word info for the feedback panel
  const correctWord = playedIdx === 0 ? pair.word1 : pair.word2;
  const correctIpa = playedIdx === 0 ? pair.ipa1 : pair.ipa2;
  const correctPhoneme = playedIdx === 0 ? pair.contrastPhoneme1 : pair.contrastPhoneme2;
  const ipaSegments = highlightPhoneme(correctIpa, correctPhoneme);

  return (
    <View style={styles.answerContainer}>
      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.button,
              { flex: 1, marginTop: 0 },
              feedback !== null && { opacity: 0.5 },
            ]}
            onPress={() => handlePress(idx as 0 | 1)}
            disabled={disabled}
          >
            <Text style={styles.buttonText}>
              {idx ? pair.word2 : pair.word1}
            </Text>
            <Text style={styles.ipaText}>{idx ? pair.ipa2 : pair.ipa1}</Text>
          </TouchableOpacity>
        ))}
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
          >
            {feedback === 'correct' ? '✓' : '✗'}
          </Text>
          <Text style={styles.feedbackWord}>{correctWord}</Text>
          <Text style={styles.feedbackIPA}>
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
            <TouchableOpacity style={styles.replayButton} onPress={onReplay}>
              <Text style={styles.replayButtonText}>🔊 {translate(tKeys.listenAgain) || 'Listen Again'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
