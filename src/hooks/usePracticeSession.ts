import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { practiceAnalytics } from '@/src/analytics/practiceAnalytics';
import type { SessionTimerHandle } from '@/src/components/SessionTimer';
import type { Category, Pair } from '@/src/constants/minimalPairs';
import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { usePairProgress } from '@/src/context/PairProgressContext';
import { usePracticeTarget } from '@/src/context/PracticeTargetContext';
import { useSettings } from '@/src/context/SettingsContext';
import {
  applyPracticeAnswer,
  buildTrialPairId,
  choosePlaybackForRound,
} from '@/src/domain/practiceSession';
import {
  initialTrialSchedulingState,
  planNextTrial,
  reduceTrialScheduling,
  type TrialSchedulingEvent,
} from '@/src/domain/practice/trialScheduling';
import {
  canAnswerPracticePrompt,
  classifyDeferredPromptRender,
  initialPracticePlaybackState,
  isPracticePlaybackActive,
  reducePracticePlayback,
  type PracticePlaybackAttempt,
  type PracticePlaybackEvent,
} from '@/src/domain/practice/practicePlaybackLifecycle';
import {
  applyProgressionAnswer,
  getGroupProgression,
  initialProgressionState,
} from '@/src/domain/practice/progressionState';
import { useAudio, type AudioPlaybackOutcome } from '@/src/hooks/useAudio';
import { useContrastPairs } from '@/src/hooks/useContrastPairs';
import { useHaptics } from '@/src/hooks/useHaptics';
import {
  FAST_STREAK_NEEDED,
  FAST_THRESHOLD_MS,
  LONG_STREAK_NEEDED,
  SPEED_TABLE,
} from '@/src/learning/adaptiveProgression';

interface UsePracticeSessionOptions {
  categoryIndex: number;
  category: Category;
  isPracticeReady: boolean;
}

export function usePracticeSession({
  categoryIndex,
  category: catObj,
  isPracticeReady,
}: UsePracticeSessionOptions) {
  const { translate } = useLanguage();
  const { targetGroup, consumeTarget } = usePracticeTarget();
  const { recordAttempt } = usePairProgress();
  const { getNextVoice } = useSettings();
  const { triggerHaptic } = useHaptics();
  const debugLog = useCallback(
    (...args: Parameters<typeof console.log>) => {
      if (__DEV__) {
        console.log(...args);
      }
    },
    []
  );

  const progressionStateRef = useRef(initialProgressionState());
  const [, forceRender] = useState(0);
  const playbackStateRef = useRef(initialPracticePlaybackState());
  const nextPlaybackAttemptIdRef = useRef(0);
  const dispatchPracticePlayback = useCallback(
    (event: PracticePlaybackEvent) => {
      const nextState = reducePracticePlayback(
        playbackStateRef.current,
        event
      );
      if (nextState !== playbackStateRef.current) {
        playbackStateRef.current = nextState;
        forceRender((value) => value + 1);
      }
    },
    []
  );

  const { visible, promote, mastery, setAllGroupsToTier, isLoading } =
    useContrastPairs(catObj.pairs, catObj.category);

  const timerRef = useRef<SessionTimerHandle | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  /** Tier the user just promoted to — drives inline celebration in AnswerButtons */
  const [promotedTier, setPromotedTier] = useState<number | null>(null);
  const trialSchedulingRef = useRef(initialTrialSchedulingState());
  const lastStartedContrastRef = useRef<string | null>(null);
  const dispatchTrialScheduling = useCallback(
    (event: TrialSchedulingEvent) => {
      trialSchedulingRef.current = reduceTrialScheduling(
        trialSchedulingRef.current,
        event
      );
    },
    []
  );

  // Reset round state when the category changes so prompt identity and late
  // playback callbacks from the previous category cannot bleed into the next.
  useEffect(() => {
    setPairIndex(0);
    setActiveGroup(null);
    setFeedback(null);
    dispatchPracticePlayback({ kind: 'session-reset' });
    dispatchTrialScheduling({ kind: 'session-reset' });
    lastStartedContrastRef.current = null;
  }, [categoryIndex, dispatchPracticePlayback, dispatchTrialScheduling]);

  // Jump to a pair requested from the Results "Practice this next" card.
  // The target is a group id. visible may include multiple same-tier examples
  // for a group, while mastery remains group-based.
  useEffect(() => {
    if (!targetGroup || isLoading) return;
    const idx = visible.findIndex((pair) => pair.group === targetGroup);
    if (idx === -1) return;
    setActiveGroup(targetGroup);
    setPairIndex(idx);
    setFeedback(null);
    dispatchPracticePlayback({ kind: 'session-reset' });
    dispatchTrialScheduling({ kind: 'session-reset' });
    consumeTarget();
  }, [
    targetGroup,
    visible,
    isLoading,
    consumeTarget,
    dispatchPracticePlayback,
    dispatchTrialScheduling,
  ]);

  // Clamp pairIndex when visible list shrinks.
  const safePairIndex =
    visible.length > 0 ? Math.min(pairIndex, visible.length - 1) : 0;
  const selectedPair: Pair | undefined = visible[safePairIndex];

  const activeGroupPairs = useMemo(() => {
    if (!activeGroup) return [];
    return visible.filter((pair) => pair.group === activeGroup);
  }, [activeGroup, visible]);

  const contrastDetailPairs = useMemo(() => {
    const group = activeGroup ?? selectedPair?.group;
    if (!group) return [];
    return catObj.pairs.filter((pair) => pair.group === group);
  }, [activeGroup, catObj.pairs, selectedPair]);

  const activeGroupPairIdsKey = useMemo(
    () => activeGroupPairs.map(buildTrialPairId).join('|'),
    [activeGroupPairs]
  );

  useEffect(() => {
    if (isLoading || !selectedPair) return;
    if (!activeGroup || !visible.some((pair) => pair.group === activeGroup)) {
      setActiveGroup(selectedPair.group);
    }
  }, [activeGroup, isLoading, selectedPair, visible]);

  useEffect(() => {
    if (
      isLoading ||
      !isPracticeReady ||
      !selectedPair ||
      !activeGroup ||
      lastStartedContrastRef.current === activeGroup
    ) {
      return;
    }

    lastStartedContrastRef.current = activeGroup;
    practiceAnalytics.practiceStarted({
      contrast: activeGroup,
      masteryLevel: mastery[activeGroup] ?? 1,
    });
  }, [activeGroup, isLoading, isPracticeReady, mastery, selectedPair]);

  useEffect(() => {
    dispatchTrialScheduling({
      kind: 'active-set-changed',
      activeGroupPairs,
    });
  }, [
    activeGroup,
    activeGroupPairs,
    activeGroupPairIdsKey,
    dispatchTrialScheduling,
  ]);

  // Keep a stable snapshot of items — only update when the picker is NOT being scrolled.
  const [stableVisible, setStableVisible] = useState<Pair[]>(visible);
  const scrollingRef = useRef(false);
  useEffect(() => {
    if (!scrollingRef.current && !isLoading) {
      setStableVisible(visible);
    }
  }, [visible, isLoading]);

  const speedTier = selectedPair
    ? getGroupProgression(progressionStateRef.current, selectedPair.group)
        .speedTier
    : 0;
  const { play, audioModeReady, isSpeaking } = useAudio(
    selectedPair,
    SPEED_TABLE[speedTier],
    getNextVoice
  );

  const observePracticePlayback = useCallback(
    (attemptId: number, outcome: AudioPlaybackOutcome) => {
      if (outcome.kind === 'started') {
        dispatchPracticePlayback({ kind: 'playback-started', attemptId });
      } else if (outcome.kind === 'completed') {
        dispatchPracticePlayback({ kind: 'playback-completed', attemptId });
      } else {
        dispatchPracticePlayback({
          kind: 'playback-failed',
          attemptId,
          reason: outcome.reason,
        });
      }
    },
    [dispatchPracticePlayback]
  );

  const submitPracticePlayback = useCallback(
    async (attempt: PracticePlaybackAttempt) => {
      try {
        await play(attempt.prompt.playedIdx, (outcome) => {
          observePracticePlayback(attempt.attemptId, outcome);
        });
      } catch (error) {
        dispatchPracticePlayback({
          kind: 'playback-failed',
          attemptId: attempt.attemptId,
          reason: 'playback-error',
        });
        console.error('Audio playback error:', error);
        Alert.alert(
          translate(tKeys.audioError),
          translate(tKeys.audioPlaybackFailed)
        );
      }
    },
    [dispatchPracticePlayback, observePracticePlayback, play, translate]
  );

  useEffect(() => {
    const playback = playbackStateRef.current;
    if (
      playback.status !== 'loading' ||
      playback.submission !== 'awaiting-render'
    ) {
      return;
    }

    const requestedPairId = playback.attempt.prompt.pairId;
    const eligiblePairIds = visible.map(buildTrialPairId);
    const renderedPairId = selectedPair
      ? buildTrialPairId(selectedPair)
      : null;
    const renderState = classifyDeferredPromptRender({
      requestedPairId,
      renderedPairId,
      eligiblePairIds,
    });

    if (renderState === 'stale-mismatch') {
      dispatchPracticePlayback({
        kind: 'playback-failed',
        attemptId: playback.attempt.attemptId,
        reason: 'deferred-prompt-mismatch',
      });
      return;
    }

    if (renderState === 'transient-mismatch') {
      const requestedPairIndex = eligiblePairIds.indexOf(requestedPairId);
      if (requestedPairIndex !== pairIndex) {
        setPairIndex(requestedPairIndex);
      }
      return;
    }

    dispatchPracticePlayback({
      kind: 'playback-submitted',
      attemptId: playback.attempt.attemptId,
    });
    void submitPracticePlayback(playback.attempt);
  }, [
    dispatchPracticePlayback,
    pairIndex,
    selectedPair,
    submitPracticePlayback,
    visible,
  ]);

  const markScheduledPair = useCallback(
    (pair: Pair) => {
      const pairId = buildTrialPairId(pair);
      const groupPairs = visible.filter(
        (candidate) => candidate.group === pair.group
      );
      dispatchTrialScheduling({
        kind: 'trial-presented',
        pair,
        activeGroupPairs: groupPairs,
      });
      if (activeGroup !== pair.group) {
        setActiveGroup(pair.group);
      }
      return pairId;
    },
    [activeGroup, dispatchTrialScheduling, visible]
  );

  const findVisiblePairIndex = useCallback(
    (pair: Pair) => {
      const pairId = buildTrialPairId(pair);
      return visible.findIndex(
        (candidate) => buildTrialPairId(candidate) === pairId
      );
    },
    [visible]
  );

  const handlePlay = useCallback(async () => {
    const currentPlayback = playbackStateRef.current;
    if (isPracticePlaybackActive(currentPlayback) || isSpeaking) return;

    timerRef.current?.poke();
    debugLog('🎯 handlePlay called, audioModeReady:', audioModeReady);
    if (!audioModeReady) {
      debugLog('❌ Audio not ready - showing error alert');
      Alert.alert(
        translate(tKeys.audioError),
        translate(tKeys.audioInitializing)
      );
      return;
    }
    triggerHaptic('light');

    const retryingUnavailablePrompt =
      currentPlayback.status === 'failed' &&
      currentPlayback.reason === 'deferred-prompt-mismatch';
    const currentPrompt =
      currentPlayback.status === 'idle' || retryingUnavailablePrompt
        ? null
        : currentPlayback.attempt.prompt;
    const playback = choosePlaybackForRound({
      playedIdx: currentPrompt?.playedIdx ?? null,
      feedback,
      randomValue: Math.random(),
    });
    let promptPair = selectedPair;
    let promptStartedAtMs = currentPrompt?.startedAtMs ?? Date.now();
    let submission: 'awaiting-render' | 'submitted' = 'submitted';

    if (playback.startsNewRound) {
      setFeedback(null);
      setPromotedTier(null);
      promptStartedAtMs = Date.now();

      const group = activeGroup ?? selectedPair?.group ?? null;
      const nextPair = planNextTrial({
        state: trialSchedulingRef.current,
        eligiblePairs: visible,
        activeGroup: group,
        selectedPair,
        random: Math.random,
      });
      dispatchTrialScheduling({ kind: 'round-started' });

      if (nextPair) {
        promptPair = nextPair;
        markScheduledPair(nextPair);
        practiceAnalytics.pairPresented({
          pair: nextPair,
          category: catObj.category,
        });
        const nextPairIndex = findVisiblePairIndex(nextPair);
        if (nextPairIndex !== -1 && nextPairIndex !== safePairIndex) {
          setPairIndex(nextPairIndex);
          submission = 'awaiting-render';
        }
      }
    }

    if (!promptPair) return;
    const attempt: PracticePlaybackAttempt = {
      attemptId: ++nextPlaybackAttemptIdRef.current,
      prompt: {
        pairId: buildTrialPairId(promptPair),
        playedIdx: playback.playedIdx,
        startedAtMs: promptStartedAtMs,
      },
    };
    dispatchPracticePlayback({
      kind: 'playback-requested',
      attempt,
      submission,
    });

    if (submission === 'submitted') {
      await submitPracticePlayback(attempt);
    }
  }, [
    activeGroup,
    audioModeReady,
    catObj.category,
    debugLog,
    dispatchTrialScheduling,
    dispatchPracticePlayback,
    feedback,
    findVisiblePairIndex,
    markScheduledPair,
    isSpeaking,
    safePairIndex,
    selectedPair,
    submitPracticePlayback,
    translate,
    triggerHaptic,
    visible,
  ]);

  /** Play a specific word from the rendered pair after feedback compare. */
  const handleCompareWord = useCallback(
    async (idx: 0 | 1) => {
      if (!audioModeReady) return;
      try {
        await play(idx);
      } catch (error) {
        console.error('Compare playback error:', error);
      }
    },
    [play, audioModeReady]
  );

  const handleAnswer = useCallback(
    (idx: 0 | 1) => {
      const playback = playbackStateRef.current;
      if (
        playback.status !== 'awaiting-answer' ||
        !selectedPair ||
        buildTrialPairId(selectedPair) !== playback.attempt.prompt.pairId
      ) {
        return;
      }
      const { playedIdx, startedAtMs } = playback.attempt.prompt;
      timerRef.current?.poke();
      const group = selectedPair.group;
      const progression = getGroupProgression(
        progressionStateRef.current,
        group
      );
      const curSpeed = progression.speedTier;
      const longStreak = progression.longStreak;
      const fastStreak = progression.fastStreak;

      const result = applyPracticeAnswer({
        selectedPair,
        category: catObj.category,
        answerIdx: idx,
        playedIdx,
        startTime: startedAtMs,
        nowMs: Date.now(),
        currentSpeed: curSpeed,
        fastStreak,
        longStreak,
        currentMasteryTier: mastery[group] ?? 1,
      });
      if (!result) return;

      dispatchPracticePlayback({
        kind: 'answer-accepted',
        attemptId: playback.attempt.attemptId,
      });
      setFeedback(result.feedback);
      recordAttempt(result.pairId, result.correct, result.durationMin);
      practiceAnalytics.answerSubmitted({
        pair: selectedPair,
        category: catObj.category,
        correct: result.correct,
        responseTimeMs: result.responseTimeMs,
      });
      if (!result.correct) {
        practiceAnalytics.comparisonOpened({
          pair: selectedPair,
          category: catObj.category,
          chosenIndex: idx,
          correctIndex: playedIdx,
          responseTimeMs: result.responseTimeMs,
        });
      }
      dispatchTrialScheduling({
        kind: 'answer-recorded',
        answeredPairId: buildTrialPairId(selectedPair),
        wasCorrect: result.correct,
      });

      progressionStateRef.current = applyProgressionAnswer(
        progressionStateRef.current,
        result
      );

      if (__DEV__) {
        const isFast = result.responseTimeMs < FAST_THRESHOLD_MS;
        console.log(
          `📊 ${group} | ${result.correct ? '✓' : '✗'} | rt=${result.responseTimeMs}ms (${isFast ? 'fast' : 'slow'})` +
            ` | speed=${curSpeed} | fastStreak=${result.nextFastStreak}/${FAST_STREAK_NEEDED}` +
            ` | longStreak=${result.nextLongStreak}/${LONG_STREAK_NEEDED}`
        );
      }

      if (!result.promoteSpeed && !result.promoteMastery) {
        // Wrong answers reset streaks (above) but do NOT demote speed.
        return;
      }

      // ── Promote speed or mastery ──
      if (result.promoteSpeed) {
        if (__DEV__) {
          console.log(
            `⬆ Speed ${group}: ${curSpeed} → ${result.nextSpeed}`
          );
        }
      } else {
        promote(group);
        setPromotedTier(result.promotedTier);
        if (result.resetPairIndex) {
          setPairIndex(0);
          setFeedback(null);
          dispatchPracticePlayback({ kind: 'session-reset' });
        }
        if (__DEV__) {
          console.log(
            `🎓 Mastery up for ${group}! Speed reset to 0 → tier ${result.promotedTier}`
          );
        }
      }

      forceRender((value) => value + 1);
    },
    [
      selectedPair,
      dispatchPracticePlayback,
      dispatchTrialScheduling,
      promote,
      mastery,
      recordAttempt,
      catObj.category,
    ]
  );

  const selectPairManually = useCallback(
    (nextPair: Pair, index: number) => {
      timerRef.current?.poke();
      const groupChanged = nextPair.group !== activeGroup;
      setActiveGroup(nextPair.group);
      dispatchTrialScheduling({ kind: 'manual-selection', groupChanged });
      setPairIndex(index);
      setFeedback(null);
      dispatchPracticePlayback({ kind: 'session-reset' });
      practiceAnalytics.pairSelected({
        pair: nextPair,
        category: catObj.category,
      });
    },
    [
      activeGroup,
      catObj.category,
      dispatchPracticePlayback,
      dispatchTrialScheduling,
    ]
  );

  const handlePairChange = useCallback(
    (index: number) => {
      const nextPair = stableVisible[index] ?? visible[index];
      if (!nextPair) return;
      selectPairManually(nextPair, index);
    },
    [selectPairManually, stableVisible, visible]
  );

  const handleContrastDetailPairSelect = useCallback(
    (pair: Pair) => {
      const nextIndex = visible.findIndex(
        (candidate) => buildTrialPairId(candidate) === buildTrialPairId(pair)
      );
      if (nextIndex === -1) return false;
      selectPairManually(pair, nextIndex);
      return true;
    },
    [selectPairManually, visible]
  );

  /** Tell us when the user starts / stops scrolling the picker. */
  const handlePickerScrollStart = useCallback(() => {
    scrollingRef.current = true;
  }, []);
  const handlePickerScrollEnd = useCallback(() => {
    scrollingRef.current = false;
    // Flush any pending visible update.
    setStableVisible(visible);
  }, [visible]);

  const playbackState = playbackStateRef.current;
  const playedIdx =
    playbackState.status === 'idle'
      ? null
      : playbackState.attempt.prompt.playedIdx;
  const canAnswer = canAnswerPracticePrompt(playbackState);
  const isPromptPlaybackActive = isPracticePlaybackActive(playbackState);

  return {
    activeGroupPairs,
    audioModeReady,
    canAnswer,
    contrastDetailPairs,
    feedback,
    handleAnswer,
    handleCompareWord,
    handleContrastDetailPairSelect,
    handlePairChange,
    handlePickerScrollEnd,
    handlePickerScrollStart,
    handlePlay,
    isLoading,
    isPromptPlaybackActive,
    isSpeaking,
    mastery,
    playedIdx,
    playbackFailureReason:
      playbackState.status === 'failed' ? playbackState.reason : null,
    playbackStatus: playbackState.status,
    promotedTier,
    safePairIndex,
    selectedPair,
    setAllGroupsToTier,
    stableVisible,
    timerRef,
  };
}
