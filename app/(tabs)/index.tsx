// app/(tabs)/index.tsx – Home screen with language sync, adaptive difficulty & progress logging
// -----------------------------------------------------------------------------
import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { useRecordAttempt } from '@/app/context/PairProgressContext';
import { useSettings } from '@/app/context/SettingsContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { minimalPairs, Pair } from '@/app/constants/minimalPairs';
import { tKeys } from '@/app/constants/translationKeys';

import PairPicker from '@/app/components/PairPicker';
import AnswerButtons from '@/app/components/AnswerButtons';

import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { useAudio } from '@/app/hooks/useAudio';
import { buildPairId } from '@/app/utils/idHelpers';
import { useHaptics } from '@/app/hooks/useHaptics';

/* Playback-rate steps per acoustic tier (0–2) */
const SPEED_TABLE: Record<0 | 1 | 2, number> = { 0: 1.0, 1: 1.1, 2: 1.2 };
const MAX_SPEED: 2 = 2; // promote lexical after reaching tier 2

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const recordAttempt = useRecordAttempt();
  const { selectedVoice } = useSettings();
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

  const [groupSpeed, setGroupSpeed] = useState<Record<string, 0 | 1 | 2>>({});
  const [groupStreak, setGroupStreak] = useState<Record<string, number>>({});
  const [groupLongStreak, setGroupLongStreak] = useState<
    Record<string, number>
  >({});

  const [pairIndex, setPairIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const catObj = minimalPairs[categoryIndex];
  const { visible, promote } = useContrastPairs(catObj.pairs);
  const selectedPair: Pair = visible[pairIndex];

  const speedTier = groupSpeed[selectedPair.group] ?? 0;
  const { play, audioModeReady, isSpeaking } = useAudio(
    selectedPair,
    SPEED_TABLE[speedTier],
    selectedVoice
  );

  const handlePlay = useCallback(async () => {
    debugLog('🎯 handlePlay called, audioModeReady:', audioModeReady);
    if (!audioModeReady) {
      debugLog('❌ Audio not ready - showing error alert');
      Alert.alert('Audio Error', 'Audio system is still initializing. Please try again.');
      return;
    }
    triggerHaptic('light');
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(Date.now());
    const idx: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setPlayedIdx(idx);
    try {
      await play(idx);
    } catch (error) {
      console.error('Audio playback error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Cannot play clip';
      Alert.alert('Audio Error', errorMessage);
    }
  }, [audioModeReady, debugLog, play, triggerHaptic]);

  const handleAnswer = useCallback(
    (idx: 0 | 1) => {
      if (playedIdx === null) return;
      const rtMs = startTime ? Date.now() - startTime : 0;
      const correct = idx === playedIdx;
      setFeedback(correct ? 'correct' : 'incorrect');

      const pairId = buildPairId(selectedPair, catObj.category);
      recordAttempt(pairId, correct, rtMs / 60000);

      const g = selectedPair.group;
      const curSpeed = groupSpeed[g] ?? 0;
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
          setGroupSpeed({ ...groupSpeed, [g]: (curSpeed - 1) as 0 | 1 });
        }
        return;
      }

      if (curSpeed < MAX_SPEED) {
        setGroupSpeed({ ...groupSpeed, [g]: (curSpeed + 1) as 0 | 1 | 2 });
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
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.title}>{translate(tKeys.practicePairs)}</Text>

      <PairPicker
        pairs={visible}
        index={pairIndex}
        setIndex={handlePairChange}
        color={theme.text}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handlePlay}
        disabled={!audioModeReady || isSpeaking}
      >
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      <AnswerButtons
        pair={selectedPair}
        onAnswer={handleAnswer}
        feedback={feedback}
        disabled={playedIdx === null}
      />
    </View>
  );
}
