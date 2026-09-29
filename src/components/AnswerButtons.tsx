import React, { useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import {
  View,
  TouchableOpacity,
  Pressable,
  Text,
  AccessibilityInfo,
  Animated,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAppStyles } from '@/src/hooks/useAppStyles';
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
  onCompareWord: (idx: 0 | 1) => void;
  compareDisabled?: boolean;
  isPlaybackActive?: boolean;
}

/** IPA text with its first occurrence of the contrasting phoneme highlighted. */
function renderIpa(
  ipa: string,
  phoneme: string | null | undefined,
  highlightStyle: StyleProp<TextStyle>
): ReactNode {
  const needle = (phoneme ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
  const idx = needle ? ipa.indexOf(needle) : -1;
  if (idx === -1) return ipa;
  return (
    <>
      {ipa.slice(0, idx)}
      <Text style={highlightStyle}>{needle}</Text>
      {ipa.slice(idx + needle.length)}
    </>
  );
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
  const styles = useAppStyles();
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
                  <Text
                    style={styles.answerTileWord}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    importantForAccessibility="no"
                  >
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
              color={theme.buttonText}
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
                {renderIpa(
                  feedbackCopy.correctIpa,
                  feedbackCopy.correctPhoneme,
                  styles.feedbackHighlight
                )}
              </Reanimated.Text>
            </>
          ) : (
            <>
              <Reanimated.Text style={[styles.feedbackWord, cascade(1)]}>
                {translate(tKeys.incorrect)}
              </Reanimated.Text>
              <Reanimated.View style={[styles.compareHeading, cascade(2)]}>
                <Text style={styles.compareTitle}>
                  {translate(tKeys.compareTheSounds)}
                </Text>
                <Text style={styles.contrastContext}>{contrastLabel}</Text>
              </Reanimated.View>
              {/* The compare buttons carry the correction: each word is tagged
                  as the learner's choice or the correct answer, in the same
                  positions as the answer tiles. */}
              <Reanimated.View style={[styles.compareButtonRow, cascade(3)]}>
                {([0, 1] as const).map((idx) => {
                  const isCorrect = idx === playedIdx;
                  const word = idx ? pair.word2 : pair.word1;
                  const ipa = idx ? pair.ipa2 : pair.ipa1;
                  const tag = translate(isCorrect ? tKeys.correct : tKeys.youChose);
                  return (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.compareButton,
                        compareDisabled && styles.compareButtonDisabled,
                        pressed && !compareDisabled && styles.compareButtonPressed,
                      ]}
                      onPress={() => onCompareWord(idx)}
                      disabled={compareDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={`${translate(tKeys.play)} ${word}, ${tag}`}
                      accessibilityHint={`${translate(tKeys.doubleTapToHear)} ${word}`}
                      accessibilityState={{ disabled: compareDisabled }}
                    >
                      <View style={styles.compareTagRow} importantForAccessibility="no">
                        <Ionicons
                          name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                          size={14}
                          color={isCorrect ? theme.success : theme.error}
                        />
                        <Text style={styles.compareTag}>{tag}</Text>
                      </View>
                      <Text style={styles.compareButtonText} importantForAccessibility="no">
                        {translate(tKeys.play)} {word}
                      </Text>
                      <Text style={styles.compareButtonIpa} importantForAccessibility="no">
                        {renderIpa(
                          ipa,
                          idx ? pair.contrastPhoneme2 : pair.contrastPhoneme1,
                          styles.feedbackHighlight
                        )}
                      </Text>
                    </Pressable>
                  );
                })}
              </Reanimated.View>
            </>
          )}
        </Reanimated.View>
      )}
    </View>
  );
}
