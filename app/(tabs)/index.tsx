// -----------------------------------------------------------------------------
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import type { SessionTimerHandle } from '@/app/components/SessionTimer';
import { View, Text, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { usePracticeTarget } from '@/app/context/PracticeTargetContext';
import { usePairProgress } from '@/app/context/PairProgressContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { minimalPairs, Pair } from '@/app/constants/minimalPairs';
import { tKeys } from '@/app/constants/translationKeys';

import AnswerButtons from '@/app/components/AnswerButtons';
import HelpOverlay from '@/app/components/HelpOverlay';
import SessionTimer from '@/app/components/SessionTimer';
import PlacementTest from '@/app/components/PlacementTest';
import LevelIndicator from '@/app/components/LevelIndicator';
import PracticeHeader from '@/app/components/practice/PracticeHeader';
import PracticePairSelector from '@/app/components/practice/PracticePairSelector';
import LevelUpCelebration from '@/app/components/practice/LevelUpCelebration';
import ListenControls from '@/app/components/practice/ListenControls';

import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { useAudio } from '@/app/hooks/useAudio';
import { useHaptics } from '@/app/hooks/useHaptics';
import {
  advanceTrialCycleSeenIds,
  applyPracticeAnswer,
  buildTrialPairId,
  choosePlaybackForRound,
  selectNextTrialPair,
} from '@/app/domain/practiceSession';
import {
  PLACEMENT_DONE_KEY,
  PLACEMENT_LEGACY_MIGRATION_KEY,
  buildPlacementStorageKey,
  serializePlacementDone,
  resolvePlacementStateForCategory,
} from '@/app/domain/masteryPersistence';
import {
  FAST_STREAK_NEEDED,
  FAST_THRESHOLD_MS,
  LONG_STREAK_NEEDED,
  SPEED_TABLE,
  SpeedTier,
} from '@/app/learning/adaptiveProgression';
import {
  ONBOARDING_SEEN_KEY,
  shouldShowOnboarding,
  markOnboardingSeen,
} from '@/app/storage/onboardingStorage';
import OnboardingScreen from '@/app/components/OnboardingScreen';
import { buildContrastTrainingTitle } from '@/utils/contrastLabel';

/* Playback-rate steps per acoustic tier (0–2)
 * 3 tiers keeps the path to mastery promotion short:
 *   fast path  → 3 correct per tier × 3 tiers = 9 answers
 *   long path  → 6 correct per tier × 3 tiers = 18 answers
 * Wrong answers reset the current streak but do NOT demote speed,
 * so worst case with 1 wrong = 24 correct + 1 wrong = 25 total. */

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
  const { targetGroup, consumeTarget } = usePracticeTarget();
  const { recordAttempt } = usePairProgress();
  const { getNextVoice } = useSettings();
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const playAudioText = useMemo(() => translate(tKeys.playAudio), [translate]);
  const { triggerHaptic } = useHaptics();
  const debugLog = useCallback(
    (...args: Parameters<typeof console.log>) => {
      if (__DEV__) {
        console.log(...args);
      }
    },
    []
  );

  /* ── Speed & streak tracking via refs (always-current, no stale closures) ── */
  const groupSpeedRef = useRef<Record<string, SpeedTier>>({});
  const groupStreakRef = useRef<Record<string, number>>({});
  const groupLongStreakRef = useRef<Record<string, number>>({});
  const [, forceRender] = useState(0);

  // Placement test state
  const [showPlacement, setShowPlacement] = useState<boolean | null>(null); // null = loading
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // null = loading

  const catObj = minimalPairs[categoryIndex];
  const { visible, promote, mastery, setAllGroupsToTier, isLoading } = useContrastPairs(catObj.pairs, catObj.category);

  const catKey = catObj.category;

  // Re-check placement each time the category changes.
  // Delegates the migration decision to a pure helper so the logic is testable
  // without relying on component behavior.
  useEffect(() => {
    let cancelled = false;
    const perCatKey = buildPlacementStorageKey(catKey);
    Promise.all([
      AsyncStorage.getItem(perCatKey),
      AsyncStorage.getItem(PLACEMENT_DONE_KEY),
      AsyncStorage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
    ]).then(async ([categoryRaw, legacyRaw, sentinelRaw, onboardingRaw]) => {
      const decision = resolvePlacementStateForCategory({ categoryRaw, legacyRaw, sentinelRaw });
      if (decision.shouldSeedCurrentCategoryFromLegacy) {
        await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(() => {});
      }
      if (decision.shouldWriteLegacyMigrationSentinel) {
        await AsyncStorage.setItem(PLACEMENT_LEGACY_MIGRATION_KEY, serializePlacementDone()).catch(() => {});
      }
      if (!cancelled) {
        setShowOnboarding(shouldShowOnboarding(onboardingRaw));
        setShowPlacement(decision.shouldShowPlacement);
      }
    }).catch(() => {
      if (!cancelled) {
        setShowOnboarding(false);
        setShowPlacement(false);
      }
    });
    return () => { cancelled = true; };
  }, [catKey]);

  const handleOnboardingDismiss = useCallback(async () => {
    try {
      await markOnboardingSeen();
    } catch {
      // Write failure: onboarding may reappear on next cold launch.
      // User continues in the current session.
    }
    setShowOnboarding(false);
  }, []);

  const handlePlacementComplete = useCallback(async (startTier: number) => {
    const perCatKey = buildPlacementStorageKey(catKey);
    setAllGroupsToTier(startTier);
    await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(() => {});
    setShowPlacement(false);
  }, [catKey, setAllGroupsToTier]);

  const handlePlacementSkip = useCallback(async () => {
    const perCatKey = buildPlacementStorageKey(catKey);
    await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(() => {});
    setShowPlacement(false);
  }, [catKey]);

  const timerRef = useRef<SessionTimerHandle | null>(null);

  const [pairIndex, setPairIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pendingPlayback, setPendingPlayback] = useState<{
    pairId: string;
    playedIdx: 0 | 1;
  } | null>(null);
  /** Tier the user just promoted to — drives inline celebration in AnswerButtons */
  const [promotedTier, setPromotedTier] = useState<number | null>(null);
  const lastPairIdRef = useRef<string | null>(null);
  const seenThisCycleRef = useRef<string[]>([]);
  const manualPairOverrideRef = useRef(false);

  // Reset round state when the category changes so stale startTime / playedIdx
  // from a previous category can't bleed into a new one.
  useEffect(() => {
    setPairIndex(0);
    setActiveGroup(null);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
    setPendingPlayback(null);
    lastPairIdRef.current = null;
    seenThisCycleRef.current = [];
    manualPairOverrideRef.current = false;
  }, [categoryIndex]);

  // Jump to a pair requested from the Results "Practice this next" card.
  // The target is a group id. visible may include multiple same-tier examples
  // for a group, while mastery remains group-based.
  useEffect(() => {
    if (!targetGroup || isLoading) return;
    const idx = visible.findIndex((p) => p.group === targetGroup);
    if (idx === -1) return;
    setActiveGroup(targetGroup);
    setPairIndex(idx);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
    setPendingPlayback(null);
    lastPairIdRef.current = null;
    seenThisCycleRef.current = [];
    manualPairOverrideRef.current = false;
    consumeTarget();
  }, [targetGroup, visible, isLoading, consumeTarget]);

  // Clamp pairIndex when visible list shrinks
  const safePairIndex = visible.length > 0 ? Math.min(pairIndex, visible.length - 1) : 0;
  const selectedPair: Pair | undefined = visible[safePairIndex];
  const contrastTrainingTitle = useMemo(
    () => buildContrastTrainingTitle(selectedPair),
    [selectedPair]
  );

  const activeGroupPairs = useMemo(() => {
    if (!activeGroup) return [];
    return visible.filter((pair) => pair.group === activeGroup);
  }, [activeGroup, visible]);

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
    seenThisCycleRef.current = [];
    if (
      lastPairIdRef.current &&
      !activeGroupPairs.some((pair) => buildTrialPairId(pair) === lastPairIdRef.current)
    ) {
      lastPairIdRef.current = null;
    }
  }, [activeGroup, activeGroupPairs, activeGroupPairIdsKey]);

  // Keep a stable snapshot of items — only update when the picker is NOT being scrolled
  const [stableVisible, setStableVisible] = useState<Pair[]>(visible);
  const scrollingRef = useRef(false);
  useEffect(() => {
    if (!scrollingRef.current && !isLoading) {
      setStableVisible(visible);
    }
  }, [visible, isLoading]);

  const speedTier: SpeedTier = selectedPair
    ? (groupSpeedRef.current[selectedPair.group] ?? 0)
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
      const errorMessage = error instanceof Error ? error.message : 'Cannot play clip';
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', errorMessage);
    });
  }, [pendingPlayback, play, selectedPair, translate]);

  const markScheduledPair = useCallback(
    (pair: Pair) => {
      const pairId = buildTrialPairId(pair);
      const groupPairs = visible.filter((candidate) => candidate.group === pair.group);
      lastPairIdRef.current = pairId;
      seenThisCycleRef.current = advanceTrialCycleSeenIds({
        activeGroupPairs: groupPairs,
        selectedPair: pair,
        seenThisCycle: seenThisCycleRef.current,
      });
      if (activeGroup !== pair.group) {
        setActiveGroup(pair.group);
      }
      return pairId;
    },
    [activeGroup, visible]
  );

  const findVisiblePairIndex = useCallback(
    (pair: Pair) => {
      const pairId = buildTrialPairId(pair);
      return visible.findIndex((candidate) => buildTrialPairId(candidate) === pairId);
    },
    [visible]
  );

  const handlePlay = useCallback(async () => {
    timerRef.current?.poke();
    debugLog('🎯 handlePlay called, audioModeReady:', audioModeReady);
    if (!audioModeReady) {
      debugLog('❌ Audio not ready - showing error alert');
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', translate(tKeys.audioInitializing) || 'Audio system is still initializing. Please try again.');
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
      const nextPair =
        manualPairOverrideRef.current && selectedPair
          ? selectedPair
          : group
            ? selectNextTrialPair({
                eligiblePairs: visible,
                activeGroup: group,
                lastPairId: lastPairIdRef.current,
                seenThisCycle: seenThisCycleRef.current,
                random: Math.random,
              })
            : selectedPair;
      manualPairOverrideRef.current = false;

      if (nextPair) {
        const nextPairId = markScheduledPair(nextPair);
        const nextPairIndex = findVisiblePairIndex(nextPair);
        if (nextPairIndex !== -1 && nextPairIndex !== safePairIndex) {
          setPairIndex(nextPairIndex);
          setPendingPlayback({ pairId: nextPairId, playedIdx: playback.playedIdx });
          return;
        }
      }
    }

    try {
      await play(playback.playedIdx);
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Cannot play clip';
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', errorMessage);
    }
  }, [
    activeGroup,
    audioModeReady,
    debugLog,
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
  const handleCompareWord = useCallback(async (idx: 0 | 1) => {
    if (!audioModeReady) return;
    try {
      await play(idx);
    } catch (error) {
      console.error('Compare playback error:', error);
    }
  }, [play, audioModeReady]);

  const handleAnswer = useCallback(
    (idx: 0 | 1) => {
      if (playedIdx === null || !selectedPair) return;
      timerRef.current?.poke();
      const g = selectedPair.group;
      const curSpeed: SpeedTier = groupSpeedRef.current[g] ?? 0;
      const longStreak = groupLongStreakRef.current[g] ?? 0;
      const fastStreak = groupStreakRef.current[g] ?? 0;

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
        currentMasteryTier: mastery[g] ?? 1,
      });
      if (!result) return;

      setFeedback(result.feedback);
      recordAttempt(result.pairId, result.correct, result.durationMin);

      groupLongStreakRef.current[g] = result.nextLongStreak;
      groupStreakRef.current[g] = result.nextFastStreak;

      if (__DEV__) {
        const isFast = result.responseTimeMs < FAST_THRESHOLD_MS;
        console.log(
          `📊 ${g} | ${result.correct ? '✓' : '✗'} | rt=${result.responseTimeMs}ms (${isFast ? 'fast' : 'slow'})` +
          ` | speed=${curSpeed} | fastStreak=${result.nextFastStreak}/${FAST_STREAK_NEEDED}` +
          ` | longStreak=${result.nextLongStreak}/${LONG_STREAK_NEEDED}`
        );
      }

      if (!result.promoteSpeed && !result.promoteMastery) {
        // Wrong answers reset streaks (above) but do NOT demote speed.
        // Demoting speed was double-punishment that made mastery promotion
        // unreachable within a reasonable session (~30 answers needed for
        // long-streak path + 1 wrong answer).
        return;
      }

      // ── Promote speed or mastery ──
      if (result.promoteSpeed) {
        groupSpeedRef.current[g] = result.nextSpeed;
        if (__DEV__) console.log(`⬆ Speed ${g}: ${curSpeed} → ${result.nextSpeed}`);
      } else {
        groupSpeedRef.current[g] = result.nextSpeed;
        promote(g);
        setPromotedTier(result.promotedTier);
        if (result.resetPairIndex) setPairIndex(0);
        if (__DEV__) console.log(`🎓 Mastery up for ${g}! Speed reset to 0 → tier ${result.promotedTier}`);
      }

      // Reset streaks after promotion
      groupStreakRef.current[g] = result.nextFastStreak;
      groupLongStreakRef.current[g] = result.nextLongStreak;
      forceRender((v) => v + 1);
    },
    [playedIdx, startTime, selectedPair, promote, mastery, recordAttempt, catObj.category]
  );

  const handlePairChange = useCallback((i: number) => {
    timerRef.current?.poke();
    const nextPair = stableVisible[i] ?? visible[i];
    if (nextPair) {
      const groupChanged = nextPair.group !== activeGroup;
      setActiveGroup(nextPair.group);
      if (groupChanged) {
        lastPairIdRef.current = null;
        seenThisCycleRef.current = [];
      }
      manualPairOverrideRef.current = true;
    }
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
    setPendingPlayback(null);
  }, [activeGroup, stableVisible, visible]);

  /** Tell us when the user starts / stops scrolling the picker */
  const handlePickerScrollStart = useCallback(() => {
    scrollingRef.current = true;
  }, []);
  const handlePickerScrollEnd = useCallback(() => {
    scrollingRef.current = false;
    // Flush any pending visible update
    setStableVisible(visible);
  }, [visible]);

  // Show PlacementTest if the user hasn't completed it yet
  if (showPlacement === null || showOnboarding === null) {
    // Still checking AsyncStorage
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDismiss={handleOnboardingDismiss} />;
  }

  if (showPlacement) {
    return (
      <PlacementTest
        pairs={catObj.pairs}
        onComplete={handlePlacementComplete}
        onSkip={handlePlacementSkip}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PracticeHeader
        title="Practice"
        onHelpPress={() => setIsHelpVisible(true)}
        primaryColor={theme.primary}
        styles={styles}
      />

      <SessionTimer timerRef={timerRef} />

      <View style={styles.mainCard}>
        <View style={styles.contrastHeader} accessibilityRole="header">
          <Text style={styles.contrastTitle}>{contrastTrainingTitle}</Text>
          <Text style={styles.contrastInstruction}>
            Listen for the sound difference.
          </Text>
        </View>

        {selectedPair && (
          <LevelIndicator currentTier={mastery[selectedPair.group] ?? 1} showCriteria />
        )}

        <LevelUpCelebration
          promotedTier={promotedTier}
          label={
            promotedTier == null
              ? translate(tKeys.levelUnlocked)
              : `This contrast moved to Level ${promotedTier}`
          }
          styles={styles}
        />

        <ListenControls
          label={playAudioText}
          onPlay={handlePlay}
          disabled={!audioModeReady || isSpeaking}
          styles={styles}
        />

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={playedIdx === null || feedback !== null}
            playedIdx={playedIdx}
            onCompareWord={handleCompareWord}
            compareDisabled={!audioModeReady || isSpeaking}
          />
        )}

        <PracticePairSelector
          isLoading={isLoading}
          selectedPair={selectedPair}
          pairs={stableVisible}
          index={safePairIndex}
          onIndexChange={handlePairChange}
          color={theme.text}
          loadingTextColor={theme.textSecondary}
          styles={styles}
          onScrollStart={handlePickerScrollStart}
          onScrollEnd={handlePickerScrollEnd}
        />
      </View>

      <HelpOverlay
        visible={isHelpVisible}
        onClose={() => setIsHelpVisible(false)}
      />
    </View>
  );
}
