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
  applyProgressionAnswer,
  getGroupProgression,
  initialProgressionState,
} from '@/src/domain/practice/progressionState';
import { useAudio } from '@/src/hooks/useAudio';
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

  const { visible, promote, mastery, setAllGroupsToTier, isLoading } =
    useContrastPairs(catObj.pairs, catObj.category);

  const timerRef = useRef<SessionTimerHandle | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pendingPlayback, setPendingPlayback] = useState<{
    pairId: string;
    playedIdx: 0 | 1;
  } | null>(null);
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

  // Reset round state when the category changes so stale startTime / playedIdx
  // from a previous category can't bleed into a new one.
  useEffect(() => {
    setPairIndex(0);
    setActiveGroup(null);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
    setPendingPlayback(null);
    dispatchTrialScheduling({ kind: 'session-reset' });
    lastStartedContrastRef.current = null;
  }, [categoryIndex, dispatchTrialScheduling]);

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
    setPlayedIdx(null);
    setStartTime(null);
    setPendingPlayback(null);
    dispatchTrialScheduling({ kind: 'session-reset' });
    consumeTarget();
  }, [targetGroup, visible, isLoading, consumeTarget, dispatchTrialScheduling]);

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

  useEffect(() => {
    if (!pendingPlayback || !selectedPair) return;
    if (buildTrialPairId(selectedPair) !== pendingPlayback.pairId) return;

    const playback = pendingPlayback;
    setPendingPlayback(null);
    play(playback.playedIdx).catch((error) => {
      console.error('Audio playback error:', error);
      Alert.alert(
        translate(tKeys.audioError),
        translate(tKeys.audioPlaybackFailed)
      );
    });
  }, [pendingPlayback, play, selectedPair, translate]);

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

    const playback = choosePlaybackForRound({
      playedIdx,
      feedback,
      randomValue: Math.random(),
    });

    if (playback.startsNewRound) {
      setFeedback(null);
      setPromotedTier(null);
      setStartTime(Date.now());
      setPlayedIdx(playback.playedIdx);

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
        const nextPairId = markScheduledPair(nextPair);
        practiceAnalytics.pairPresented({
          pair: nextPair,
          category: catObj.category,
        });
        const nextPairIndex = findVisiblePairIndex(nextPair);
        if (nextPairIndex !== -1 && nextPairIndex !== safePairIndex) {
          setPairIndex(nextPairIndex);
          setPendingPlayback({
            pairId: nextPairId,
            playedIdx: playback.playedIdx,
          });
          return;
        }
      }
    }

    try {
      await play(playback.playedIdx);
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert(
        translate(tKeys.audioError),
        translate(tKeys.audioPlaybackFailed)
      );
    }
  }, [
    activeGroup,
    audioModeReady,
    catObj.category,
    debugLog,
    dispatchTrialScheduling,
    feedback,
    findVisiblePairIndex,
    markScheduledPair,
    play,
    playedIdx,
    safePairIndex,
    selectedPair,
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
      if (playedIdx === null || !selectedPair) return;
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
        startTime,
        nowMs: Date.now(),
        currentSpeed: curSpeed,
        fastStreak,
        longStreak,
        currentMasteryTier: mastery[group] ?? 1,
      });
      if (!result) return;

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
          setPlayedIdx(null);
          setStartTime(null);
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
      playedIdx,
      startTime,
      selectedPair,
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
      setPlayedIdx(null);
      setStartTime(null);
      setPendingPlayback(null);
      practiceAnalytics.pairSelected({
        pair: nextPair,
        category: catObj.category,
      });
    },
    [activeGroup, catObj.category, dispatchTrialScheduling]
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

  return {
    activeGroupPairs,
    audioModeReady,
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
    isSpeaking,
    mastery,
    playedIdx,
    promotedTier,
    safePairIndex,
    selectedPair,
    setAllGroupsToTier,
    stableVisible,
    timerRef,
  };
}
