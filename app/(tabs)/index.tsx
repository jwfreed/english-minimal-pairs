// app/(tabs)/index.tsx – Home screen with adaptive difficulty, voice rotation & session timer
// -----------------------------------------------------------------------------
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import type { SessionTimerHandle } from '@/app/components/SessionTimer';
import { View, Text, Alert, TouchableOpacity, ScrollView } from 'react-native';
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

import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { useAudio } from '@/app/hooks/useAudio';
import { buildPairId } from '@/app/utils/idHelpers';
import { useHaptics } from '@/app/hooks/useHaptics';

/* Playback-rate steps per acoustic tier (0–4) */
type SpeedTier = 0 | 1 | 2 | 3 | 4;
const SPEED_TABLE: Record<SpeedTier, number> = {
  0: 0.8,
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.3,
};
const MAX_SPEED: SpeedTier = 4;

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

  const [groupSpeed, setGroupSpeed] = useState<Record<string, SpeedTier>>({});
  const [groupStreak, setGroupStreak] = useState<Record<string, number>>({});
  const [groupLongStreak, setGroupLongStreak] = useState<
    Record<string, number>
  >({});

  const timerRef = useRef<SessionTimerHandle | null>(null);

  const [pairIndex, setPairIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const catObj = minimalPairs[categoryIndex];
  const { visible, promote, isLoading } = useContrastPairs(catObj.pairs, catObj.category);

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

  const speedTier: SpeedTier = selectedPair ? (groupSpeed[selectedPair.group] ?? 0) : 0;
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
      Alert.alert('Audio Error', 'Audio system is still initializing. Please try again.');
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
      Alert.alert('Audio Error', errorMessage);
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
      if (playedIdx === null) return;
      timerRef.current?.poke();
      const rtMs = startTime ? Date.now() - startTime : 0;
      const correct = idx === playedIdx;
      setFeedback(correct ? 'correct' : 'incorrect');

      const pairId = buildPairId(selectedPair, catObj.category);
      recordAttempt(pairId, correct, rtMs / 60000);

      const g = selectedPair.group;
      const curSpeed: SpeedTier = groupSpeed[g] ?? 0;
      const fastStreak = groupStreak[g] ?? 0;
      const longStreak = groupLongStreak[g] ?? 0;

      const nextLongStreak = correct ? longStreak + 1 : 0;
      setGroupLongStreak({ ...groupLongStreak, [g]: nextLongStreak });

      if (correct && rtMs < 2000) {
        const nextFast = fastStreak + 1;
        setGroupStreak({ ...groupStreak, [g]: nextFast });
      } else {
        setGroupStreak({ ...groupStreak, [g]: 0 });
      }

      const promoteNeeded =
        (correct && rtMs < 2000 && fastStreak + 1 >= 3) || nextLongStreak >= 10;

      if (!promoteNeeded) {
        if (!correct && curSpeed > 0) {
          setGroupSpeed({ ...groupSpeed, [g]: (curSpeed - 1) as SpeedTier });
        }
        return;
      }

      if (curSpeed < MAX_SPEED) {
        setGroupSpeed({ ...groupSpeed, [g]: (curSpeed + 1) as SpeedTier });
      } else {
        promote(g);
        setGroupSpeed({ ...groupSpeed, [g]: 0 });
        setPairIndex(0);
      }

      setGroupStreak({ ...groupStreak, [g]: 0 });
      setGroupLongStreak({ ...groupLongStreak, [g]: 0 });
    },
    [
      playedIdx,
      startTime,
      selectedPair,
      groupSpeed,
      groupStreak,
      groupLongStreak,
      promote,
      recordAttempt,
      catObj.category,
    ]
  );

  const handlePairChange = useCallback((i: number) => {
    timerRef.current?.poke();
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { flex: undefined, paddingBottom: 40 }]}
      keyboardShouldPersistTaps="handled"
    >
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
    </ScrollView>
  );
}
