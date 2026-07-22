import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Pressable, Text, AccessibilityInfo, Animated } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import createStyles from '@/src/constants/styles';
import {
  badgePopAnimation,
  feedbackRowAnimation,
  panelEntryAnimation,
} from '@/src/constants/motion';
import { useAllThemeColors } from '@/src/context/theme';
import { useHaptics } from '@/src/hooks/useHaptics';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';
import type { Pair } from '@/src/constants/minimalPairs';
import { buildPracticeFeedbackCopy } from '@/utils/practiceFeedback';
import { buildContrastLabel } from '@/utils/contrastLabel';

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
  isPlaybackActive?: boolean;
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
  isPlaybackActive = false,
}: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { triggerHaptic } = useHaptics();
  const { translate } = useLanguage();
  const reduceMotion = useReducedMotion();
  const answerOpacity = useRef(new Animated.Value(1)).current;

  // Each feedback row slides + fades up 50ms after the previous one
  // (mock: swBannerIn on .sw-fbrow with nth-child delays).
  const cascade = useCallback(
    (row: number) => (reduceMotion ? null : feedbackRowAnimation(row)),
    [reduceMotion]
  );

  useEffect(() => {
    Animated.timing(answerOpacity, {
      toValue: isPlaybackActive ? 0.6 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [answerOpacity, isPlaybackActive]);

  const feedbackCopy = useMemo(
    () =>
      feedback !== null && playedIdx != null
        ? buildPracticeFeedbackCopy({ pair, feedback, playedIdx, translate })
        : null,
    [feedback, pair, playedIdx, translate]
  );
  const contrastLabel = useMemo(() => buildContrastLabel(pair), [pair]);
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
        `${translate(tKeys.incorrect)}. ${translate(tKeys.youChose)} ${feedbackCopy.contrastWord}. ${translate(tKeys.correct)}: ${feedbackCopy.correctWord}. ${translate(tKeys.compareTheSounds)}: ${contrastLabel}.`
      );
    }
  }, [contrastLabel, feedback, feedbackCopy, triggerHaptic, translate]);

  const handlePress = (idx: 0 | 1) => {
    if (disabled) return;
    triggerHaptic('light');
    onAnswer(idx);
  };

  return (
    <View style={styles.answerContainer}>
      {!feedbackCopy && (
        <>
          <Text style={styles.answerPrompt}>
            {translate(tKeys.whichWordDidYouHear)}
          </Text>
          <Animated.View style={[styles.buttonRow, { opacity: answerOpacity }]}> 
            {[0, 1].map((idx) => {
              const word = idx ? pair.word2 : pair.word1;
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.answerTile}
                  onPress={() => handlePress(idx as 0 | 1)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={word}
                  accessibilityHint={translate(tKeys.doubleTapToSelectWord)}
                  accessibilityState={{ disabled }}
                >
                  <Text style={styles.answerTileWord} importantForAccessibility="no">
                    {word}
                  </Text>
                  <Text
                    style={styles.answerTileIpa}
                    importantForAccessibility="no"
                    accessibilityElementsHidden={true}
                  >
                    {idx ? pair.ipa2 : pair.ipa1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </>
      )}

      {/* Rich feedback panel — slides + fades up in place of the tiles */}
      {feedbackCopy && (
        <Reanimated.View
          style={[styles.feedbackPanel, !reduceMotion && panelEntryAnimation]}
        >
          <Reanimated.View
            style={[
              styles.feedbackStatusCircle,
              feedback === 'correct'
                ? styles.correctFeedbackCircle
                : styles.incorrectFeedbackCircle,
              !reduceMotion && badgePopAnimation,
            ]}
            importantForAccessibility="no"
            accessibilityElementsHidden={true}
          >
            <Ionicons
              name={feedback === 'correct' ? 'checkmark' : 'close'}
              size={20}
              color="#FFFFFF"
            />
          </Reanimated.View>
          {feedback === 'correct' ? (
            <>
              <Reanimated.Text style={[styles.feedbackWord, cascade(1)]}>
                {feedbackCopy.headline}
              </Reanimated.Text>
              <Reanimated.Text
                style={[styles.feedbackIPA, cascade(2)]}
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
              </Reanimated.Text>
            </>
          ) : (
            <>
              <Reanimated.Text style={[styles.feedbackWord, cascade(1)]}>
                {translate(tKeys.incorrect)}
              </Reanimated.Text>
              <View style={styles.feedbackAttemptRows}>
                <Reanimated.View style={[styles.feedbackAttemptRow, cascade(2)]}>
                  <Text style={styles.feedbackAttemptLabel}>
                    {translate(tKeys.youChose)}
                  </Text>
                  <Text style={styles.feedbackAttemptValue}>
                    {feedbackCopy.contrastWord} {feedbackCopy.contrastIpa}
                  </Text>
                </Reanimated.View>
                <Reanimated.View style={[styles.feedbackAttemptRow, cascade(3)]}>
                  <Text style={styles.feedbackAttemptLabel}>
                    {translate(tKeys.correct)}
                  </Text>
                  <Text style={styles.feedbackAttemptValue}>
                    {feedbackCopy.correctWord} {feedbackCopy.correctIpa}
                  </Text>
                </Reanimated.View>
              </View>
              <Reanimated.Text style={[styles.compareTitle, cascade(4)]}>
                {translate(tKeys.compareTheSounds)}
              </Reanimated.Text>
              <Reanimated.Text style={[styles.contrastContext, cascade(5)]}>
                {contrastLabel}
              </Reanimated.Text>
            </>
          )}
          {feedback === 'incorrect' && onCompareWord && (
            <View style={styles.compareContainer}>
              <Reanimated.Text style={[styles.feedbackDetail, cascade(6)]}>
                {translate(tKeys.listenForSoundDifference)}
              </Reanimated.Text>
              <Reanimated.View style={[styles.compareButtonRow, cascade(7)]}>
                {[
                  { idx: 0 as const, word: pair.word1, ipa: pair.ipa1 },
                  { idx: 1 as const, word: pair.word2, ipa: pair.ipa2 },
                ].map((item) => (
                  <Pressable
                    key={item.idx}
                    style={({ pressed }) => [
                      styles.compareButton,
                      compareDisabled && styles.compareButtonDisabled,
                      pressed && !compareDisabled && styles.compareButtonPressed,
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
                  </Pressable>
                ))}
              </Reanimated.View>
            </View>
          )}
        </Reanimated.View>
      )}
    </View>
  );
}
