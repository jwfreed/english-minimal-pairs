// -----------------------------------------------------------------------------
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import type { SessionTimerHandle } from '@/app/components/SessionTimer';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import HelpOverlay from '@/app/components/HelpOverlay';
import SessionTimer from '@/app/components/SessionTimer';
import PlacementTest from '@/app/components/PlacementTest';
import LevelIndicator from '@/app/components/LevelIndicator';

import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { useAudio } from '@/app/hooks/useAudio';
import { buildPairId } from '@/app/utils/idHelpers';
import { useHaptics } from '@/app/hooks/useHaptics';
import {
  FAST_STREAK_NEEDED,
  FAST_THRESHOLD_MS,
  LONG_STREAK_NEEDED,
  SPEED_TABLE,
  SpeedTier,
  getNextAdaptiveProgression,
} from '@/app/learning/adaptiveProgression';

const PLACEMENT_DONE_KEY = '@placementDone';

/* Playback-rate steps per acoustic tier (0–2)
 * 3 tiers keeps the path to mastery promotion short:
 *   fast path  → 3 correct per tier × 3 tiers = 9 answers
 *   long path  → 6 correct per tier × 3 tiers = 18 answers
 * Wrong answers reset the current streak but do NOT demote speed,
 * so worst case with 1 wrong = 24 correct + 1 wrong = 25 total. */

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
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
  const [isHelpVisible, setIsHelpVisible] = useState(false);
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

    try {
      await play(idxToPlay);
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Cannot play clip';
      Alert.alert(translate(tKeys.audioError) || 'Audio Error', errorMessage);
    }
  }, [audioModeReady, debugLog, play, triggerHaptic, playedIdx, feedback, selectedPair, translate]);

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
      const longStreak = groupLongStreakRef.current[g] ?? 0;
      const fastStreak = groupStreakRef.current[g] ?? 0;
      const progression = getNextAdaptiveProgression({
        correct,
        responseTimeMs: rtMs,
        currentSpeed: curSpeed,
        fastStreak,
        longStreak,
        currentMasteryTier: mastery[g] ?? 1,
      });

      groupLongStreakRef.current[g] = progression.nextLongStreak;
      groupStreakRef.current[g] = progression.nextFastStreak;

      if (__DEV__) {
        const isFast = rtMs < FAST_THRESHOLD_MS;
        console.log(
          `📊 ${g} | ${correct ? '✓' : '✗'} | rt=${rtMs}ms (${isFast ? 'fast' : 'slow'})` +
          ` | speed=${curSpeed} | fastStreak=${progression.nextFastStreak}/${FAST_STREAK_NEEDED}` +
          ` | longStreak=${progression.nextLongStreak}/${LONG_STREAK_NEEDED}`
        );
      }

      if (!progression.promoteSpeed && !progression.promoteMastery) {
        // Wrong answers reset streaks (above) but do NOT demote speed.
        // Demoting speed was double-punishment that made mastery promotion
        // unreachable within a reasonable session (~30 answers needed for
        // long-streak path + 1 wrong answer).
        return;
      }

      // ── Promote speed or mastery ──
      if (progression.promoteSpeed) {
        groupSpeedRef.current[g] = progression.nextSpeed;
        if (__DEV__) console.log(`⬆ Speed ${g}: ${curSpeed} → ${progression.nextSpeed}`);
      } else {
        groupSpeedRef.current[g] = progression.nextSpeed;
        promote(g);
        setPromotedTier(progression.nextMasteryTier);
        setPairIndex(0);
        if (__DEV__) console.log(`🎓 Mastery up for ${g}! Speed reset to 0 → tier ${progression.nextMasteryTier}`);
      }

      // Reset streaks after promotion
      groupStreakRef.current[g] = progression.nextFastStreak;
      groupLongStreakRef.current[g] = progression.nextLongStreak;
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
      <View style={styles.practiceHeader}>
        <View style={styles.practiceHeaderSpacer} />
        <Text style={styles.practiceTitle}>{translate(tKeys.practicePairs)}</Text>
        <TouchableOpacity
          accessibilityLabel="Help"
          accessibilityRole="button"
          activeOpacity={0.8}
          hitSlop={8}
          onPress={() => setIsHelpVisible(true)}
          style={styles.helpButton}
        >
          <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

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

      <HelpOverlay
        visible={isHelpVisible}
        onClose={() => setIsHelpVisible(false)}
      />
    </View>
  );
}
