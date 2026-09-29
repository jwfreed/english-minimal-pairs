// components/PlacementTest.tsx
// -----------------------------------------------------------------------------
// Quick 10-question placement test (Decision 021): every contrast is asked
// twice and every difficulty tier (1-6) appears at least once. Returns
// per-contrast starting levels from the global score and per-contrast evidence.
// -----------------------------------------------------------------------------
import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import createStyles from '@/src/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';
import { useSettings } from '@/src/context/SettingsContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';
import {
  buildPlacementItems,
  initializePlacementLevels,
  type PlacementAnswer,
} from '@/src/domain/practice/placementAssessment';
import {
  initialPracticePlaybackState,
  isPracticePlaybackActive,
  playbackEventFromOutcome,
  reducePracticePlayback,
  type PracticePlaybackAttempt,
} from '@/src/domain/practice/practicePlaybackLifecycle';
import type { Pair } from '@/src/constants/minimalPairs';
import { useAudio } from '@/src/hooks/useAudio';
import PlaybackFailureNotice from '@/src/components/PlaybackFailureNotice';

interface Props {
  /** All pairs for the current category */
  pairs: Pair[];
  /** Called with per-contrast starting levels (1-6, never 7) when the test finishes */
  onComplete: (levels: Record<string, number>) => void;
  /** Called if the user skips the test */
  onSkip: () => void;
}

export default function PlacementTest({ pairs, onComplete, onSkip }: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getNextVoice } = useSettings();
  const { translate } = useLanguage();

  const testItems = useMemo(
    () => buildPlacementItems({ pairs, random: Math.random }),
    [pairs]
  );

  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<PlacementAnswer[]>([]);
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [answered, setAnswered] = useState(false);
  // Same lifecycle as practice: only a native completion for this question's
  // latest attempt makes it answerable; submission, failure, cancellation,
  // timeout and stale callbacks never do.
  const [playback, dispatchPlayback] = useReducer(
    reducePracticePlayback,
    undefined,
    initialPracticePlaybackState
  );
  const nextAttemptIdRef = useRef(0);
  const promptId = `placement-${qIndex}`;
  const canAnswer =
    !answered &&
    playback.status === 'awaiting-answer' &&
    playback.attempt.prompt.pairId === promptId;

  // Track the answer-advance timeout so it can be cleared on unmount or before
  // rescheduling. Without this, the callback can fire after the component
  // unmounts (e.g. user taps Skip during the 600 ms window) and incorrectly
  // call onComplete / onSkip side effects.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const currentPair = testItems[qIndex];

  // Placement is an assessment, not guided practice: always rotate across the
  // full prioritized pool instead of staging by the pair's difficulty. The
  // wrapper ignores the difficulty useAudio supplies and requests placement
  // mode explicitly.
  const getPlacementVoice = useCallback(
    () => getNextVoice({ mode: 'placement' }),
    [getNextVoice]
  );

  // Shared audio path — same hook as the regular practice loop.
  // Handles iOS silent-mode workaround, audio session setup, isSpeaking tracking,
  // and voice rotation.
  const { play, audioModeReady, isSpeaking } = useAudio(currentPair, 1.0, getPlacementVoice);

  // Pick a random word when the question changes (user must press Play Audio)
  useEffect(() => {
    if (!currentPair) return;
    const idx: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setPlayedIdx(idx);
    setAnswered(false);
    dispatchPlayback({ kind: 'session-reset' });
  }, [qIndex, currentPair]);

  const handleAnswer = useCallback((idx: 0 | 1) => {
    if (!canAnswer || playback.status !== 'awaiting-answer') return;
    setAnswered(true);
    dispatchPlayback({
      kind: 'answer-accepted',
      attemptId: playback.attempt.attemptId,
    });
    const correct = idx === playback.attempt.prompt.playedIdx;
    const newAnswers = [...answers, { group: testItems[qIndex].group, correct }];
    setAnswers(newAnswers);

    // Clear any previously scheduled advance before setting a new one (defensive).
    if (advanceTimerRef.current !== null) {
      clearTimeout(advanceTimerRef.current);
    }

    // Advance after a brief delay
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      if (qIndex + 1 >= testItems.length) {
        onComplete(initializePlacementLevels({ pairs, answers: newAnswers }));
      } else {
        setQIndex((i) => i + 1);
      }
    }, 600);
  }, [canAnswer, playback, answers, qIndex, testItems, pairs, onComplete]);

  const canPlayAudio = playedIdx !== null && !answered;
  const playDisabled =
    !canPlayAudio ||
    !audioModeReady ||
    isSpeaking ||
    isPracticePlaybackActive(playback);

  const handlePlay = useCallback(async () => {
    if (playDisabled || playedIdx === null) return;
    const attempt: PracticePlaybackAttempt = {
      attemptId: ++nextAttemptIdRef.current,
      prompt: { pairId: promptId, playedIdx, startedAtMs: Date.now() },
    };
    dispatchPlayback({ kind: 'playback-requested', attempt, submission: 'submitted' });
    try {
      // Resolves on submission only; the observer carries the native outcome.
      await play(playedIdx, (outcome) => {
        dispatchPlayback(playbackEventFromOutcome(attempt.attemptId, outcome));
      });
    } catch (error) {
      dispatchPlayback({
        kind: 'playback-failed',
        attemptId: attempt.attemptId,
        reason: 'playback-error',
      });
      console.error('Placement audio playback error:', error);
      Alert.alert(
        translate(tKeys.audioError),
        translate(tKeys.audioPlaybackFailed)
      );
    }
  }, [playDisabled, playedIdx, promptId, play, translate]);

  if (!currentPair) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView
      style={styles.scrollScreen}
      contentContainerStyle={[styles.scrollContent, { justifyContent: 'center' }]}
    >
      <Text style={[styles.title, { marginBottom: 8 }]}>
        {translate(tKeys.placementTest)}
      </Text>
      <Text style={[styles.ipaText, { marginBottom: 24, textAlign: 'center' }]}>
        {`${qIndex + 1} / ${testItems.length}`}
      </Text>

      <TouchableOpacity
        style={[styles.button, { marginBottom: 20 }, playDisabled && { opacity: 0.5 }]}
        onPress={handlePlay}
        disabled={playDisabled}
      >
        <Text style={styles.buttonText}>🔊 {translate(tKeys.playAudio)}</Text>
      </TouchableOpacity>

      {playback.status === 'failed' && (
        <PlaybackFailureNotice
          style={[styles.ipaText, { marginBottom: 20, textAlign: 'center' }]}
        />
      )}

      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.button,
              { flex: 1, marginTop: 0 },
              !canAnswer && { opacity: 0.5 },
            ]}
            onPress={() => handleAnswer(idx as 0 | 1)}
            disabled={!canAnswer}
          >
            <Text style={styles.buttonText}>
              {idx === 0 ? currentPair.word1 : currentPair.word2}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={{ marginTop: 32, padding: 12 }}
        onPress={onSkip}
        disabled={answered}
      >
        <Text style={[styles.ipaText, { textDecorationLine: 'underline', opacity: answered ? 0.4 : 1 }]}>
          {translate(tKeys.skip)}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
