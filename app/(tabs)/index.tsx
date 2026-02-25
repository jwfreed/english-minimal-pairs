// app/(tabs)/index.tsx – Home screen with adaptive difficulty, voice rotation & session timer
// -----------------------------------------------------------------------------
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import type { SessionTimerHandle } from '@/app/components/SessionTimer';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { usePairProgress } from '@/app/context/PairProgressContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { minimalPairs, Pair } from '@/app/constants/minimalPairs';
import { tKeys } from '@/app/constants/translationKeys';

import PairPicker from '@/app/components/PairPicker';
import AnswerButtons from '@/app/components/AnswerButtons';
import SessionTimer from '@/app/components/SessionTimer';
import PlacementTest from '@/app/components/PlacementTest';
import LevelIndicator from '@/app/components/LevelIndicator';

import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { useAudio } from '@/app/hooks/useAudio';
import { buildPairId } from '@/app/utils/idHelpers';
import { useHaptics } from '@/app/hooks/useHaptics';

const PLACEMENT_DONE_KEY = '@placementDone';

/* Playback-rate steps per acoustic tier (0–2)
 * 3 tiers keeps the path to mastery promotion short:
 *   fast path  → 3 correct per tier × 3 tiers = 9 answers
 *   long path  → 6 correct per tier × 3 tiers = 18 answers
 * Wrong answers reset the current streak but do NOT demote speed,
 * so worst case with 1 wrong = 24 correct + 1 wrong = 25 total. */
type SpeedTier = 0 | 1 | 2;
const SPEED_TABLE: Record<SpeedTier, number> = {
  0: 0.85,
  1: 1.0,
  2: 1.15,
};
const MAX_SPEED: SpeedTier = 2;

/** Response-time ceiling for a "fast" answer.  Must account for TTS
 * playback (~0.5-1 s) plus reaction time, so 2 s is unrealistic. */
const FAST_THRESHOLD_MS = 5000;
const FAST_STREAK_NEEDED = 3;
const LONG_STREAK_NEEDED = 6;

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
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

  useEffect(() => {
    AsyncStorage.getItem(PLACEMENT_DONE_KEY).then((val) => {
      setShowPlacement(val == null); // show if not done yet
    }).catch(() => setShowPlacement(false));
  }, []);

  // Re-check when the category changes (a different language might warrant a new test)
  // This is intentionally not re-triggering — placement applies globally.

  const catObj = minimalPairs[categoryIndex];
  const { visible, promote, mastery, setAllGroupsToTier, isLoading } = useContrastPairs(catObj.pairs, catObj.category);

  const handlePlacementComplete = useCallback(async (startTier: number) => {
    setAllGroupsToTier(startTier);
    await AsyncStorage.setItem(PLACEMENT_DONE_KEY, '1').catch(() => {});
    setShowPlacement(false);
  }, [setAllGroupsToTier]);

  const handlePlacementSkip = useCallback(async () => {
    await AsyncStorage.setItem(PLACEMENT_DONE_KEY, '1').catch(() => {});
    setShowPlacement(false);
  }, []);

  const timerRef = useRef<SessionTimerHandle | null>(null);

  const [pairIndex, setPairIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  /** Tier the user just promoted to — drives inline celebration in AnswerButtons */
  const [promotedTier, setPromotedTier] = useState<number | null>(null);

  // Reset round state when the category changes so stale startTime / playedIdx
  // from a previous category can't bleed into a new one.
  useEffect(() => {
    setPairIndex(0);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
  }, [categoryIndex]);

  // Clamp pairIndex when visible list shrinks
  const safePairIndex = visible.length > 0 ? Math.min(pairIndex, visible.length - 1) : 0;
  const selectedPair: Pair | undefined = visible[safePairIndex];

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

  const handlePlay = useCallback(async () => {
    timerRef.current?.poke();
    debugLog('🎯 handlePlay called, audioModeReady:', audioModeReady);
    if (!audioModeReady) {
      debugLog('❌ Audio not ready - showing error alert');
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', translate(tKeys.audioInitializing) || 'Audio system is still initializing. Please try again.');
      return;
    }
    triggerHaptic('light');

    let idxToPlay: 0 | 1;

    // If we are in the middle of a round (played but not answered), replay the same word
    if (playedIdx !== null && feedback === null) {
      idxToPlay = playedIdx;
    } else {
      // Start new round
      setFeedback(null);
      setPromotedTier(null);
      setStartTime(Date.now());
      idxToPlay = Math.random() < 0.5 ? 0 : 1;
      setPlayedIdx(idxToPlay);
    }

    const wordToPlay = idxToPlay === 0 ? selectedPair.word1 : selectedPair.word2;
    console.log('🔊 Playing word:', wordToPlay);

    try {
      await play(idxToPlay);
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Cannot play clip';
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', errorMessage);
    }
  }, [audioModeReady, debugLog, play, triggerHaptic, playedIdx, feedback, selectedPair]);

  /** Replay the same word after feedback (used by AnswerButtons "Listen Again") */
  const handleReplay = useCallback(async () => {
    if (playedIdx === null || !audioModeReady) return;
    try {
      await play(playedIdx);
    } catch (error) {
      console.error('Replay error:', error);
    }
  }, [play, playedIdx, audioModeReady]);

  const handleAnswer = useCallback(
    (idx: 0 | 1) => {
      if (playedIdx === null || !selectedPair) return;
      timerRef.current?.poke();
      const rtMs = startTime ? Date.now() - startTime : 0;
      const correct = idx === playedIdx;
      setFeedback(correct ? 'correct' : 'incorrect');

      const pairId = buildPairId(selectedPair, catObj.category);
      recordAttempt(pairId, correct, rtMs / 60000);

      const g = selectedPair.group;
      const curSpeed: SpeedTier = groupSpeedRef.current[g] ?? 0;

      // ── Update streaks (refs — always current) ──
      const longStreak = groupLongStreakRef.current[g] ?? 0;
      const nextLongStreak = correct ? longStreak + 1 : 0;
      groupLongStreakRef.current[g] = nextLongStreak;

      const fastStreak = groupStreakRef.current[g] ?? 0;
      const nextFastStreak = correct && rtMs < FAST_THRESHOLD_MS ? fastStreak + 1 : 0;
      groupStreakRef.current[g] = nextFastStreak;

      if (__DEV__) {
        const isFast = rtMs < FAST_THRESHOLD_MS;
        console.log(
          `📊 ${g} | ${correct ? '✓' : '✗'} | rt=${rtMs}ms (${isFast ? 'fast' : 'slow'})` +
          ` | speed=${curSpeed} | fastStreak=${nextFastStreak}/${FAST_STREAK_NEEDED}` +
          ` | longStreak=${nextLongStreak}/${LONG_STREAK_NEEDED}`
        );
      }

      // ── Check promotion criteria ──
      const promoteNeeded =
        (correct && rtMs < FAST_THRESHOLD_MS && nextFastStreak >= FAST_STREAK_NEEDED)
        || nextLongStreak >= LONG_STREAK_NEEDED;

      if (!promoteNeeded) {
        // Wrong answers reset streaks (above) but do NOT demote speed.
        // Demoting speed was double-punishment that made mastery promotion
        // unreachable within a reasonable session (~30 answers needed for
        // long-streak path + 1 wrong answer).
        return;
      }

      // ── Promote speed or mastery ──
      if (curSpeed < MAX_SPEED) {
        groupSpeedRef.current[g] = (curSpeed + 1) as SpeedTier;
        if (__DEV__) console.log(`⬆ Speed ${g}: ${curSpeed} → ${curSpeed + 1}`);
      } else {
        groupSpeedRef.current[g] = 0;
        promote(g);
        const newTier = Math.min((mastery[g] ?? 1) + 1, 6);
        setPromotedTier(newTier);
        setPairIndex(0);
        if (__DEV__) console.log(`🎓 Mastery up for ${g}! Speed reset to 0 → tier ${newTier}`);
      }

      // Reset streaks after promotion
      groupStreakRef.current[g] = 0;
      groupLongStreakRef.current[g] = 0;
      forceRender((v) => v + 1);
    },
    [playedIdx, startTime, selectedPair, promote, mastery, recordAttempt, catObj.category]
  );

  const handlePairChange = useCallback((i: number) => {
    timerRef.current?.poke();
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(null);
  }, []);

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
  if (showPlacement === null) {
    // Still checking AsyncStorage
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>Loading…</Text>
      </View>
    );
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
      <Text style={styles.title}>{translate(tKeys.practicePairs)}</Text>

      <SessionTimer timerRef={timerRef} />

      <View style={styles.mainCard}>
        {isLoading || !selectedPair ? (
          <View style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.textSecondary }}>Loading…</Text>
          </View>
        ) : (
          <PairPicker
            pairs={stableVisible}
            index={safePairIndex}
            setIndex={handlePairChange}
            color={theme.text}
            onScrollStart={handlePickerScrollStart}
            onScrollEnd={handlePickerScrollEnd}
          />
        )}

        {selectedPair && (
          <LevelIndicator currentTier={mastery[selectedPair.group] ?? 1} showCriteria />
        )}

        {/* Level-up celebration — shown above the play button for visibility */}
        {promotedTier != null && (
          <View style={styles.levelUpContainer}>
            <Text style={styles.levelUpText}>
              🎉 {translate(tKeys.levelUnlocked)}
            </Text>
            <LevelIndicator currentTier={promotedTier} compact />
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, { zIndex: 10 }]}
          onPress={handlePlay}
          disabled={!audioModeReady || isSpeaking}
        >
          <Text style={styles.buttonText}>{playAudioText}</Text>
        </TouchableOpacity>

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={playedIdx === null || feedback !== null}
            playedIdx={playedIdx}
            onReplay={handleReplay}
          />
        )}
      </View>
    </View>
  );
}
