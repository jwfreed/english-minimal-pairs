// app/(tabs)/index.tsx – Home screen with language sync, adaptive difficulty & progress logging
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCategory } from '@/src/context/CategoryContext';
import { useRecordAttempt } from '@/src/context/PairProgressContext';
import { useAllThemeColors } from '@/src/context/theme';
import createStyles from '@/constants/styles';
import { minimalPairs, Pair } from '@/constants/minimalPairs';
import { tKeys } from '@/constants/translationKeys';

import CategoryDropdown from '@/components/CategoryDropdown';
import PairPicker from '@/components/PairPicker';
import AnswerButtons from '@/components/AnswerButtons';

import { useContrastPairs } from '@/hooks/useContrastPairs';
import { useAudio } from '@/hooks/useAudio';
import { buildPairId } from '@/src/utils/idHelpers';

/* Playback-rate steps per acoustic tier (0–2) */
const SPEED_TABLE: Record<0 | 1 | 2, number> = { 0: 1.0, 1: 1.1, 2: 1.2 };
const MAX_SPEED: 2 = 2; // promote lexical after reaching tier 2

export default function HomeScreen() {
  const { translate, setLanguage } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const recordAttempt = useRecordAttempt();
  const theme = useAllThemeColors();
  const styles = createStyles(theme);
  const playAudioText = translate(tKeys.playAudio);

  useEffect(() => {
    const catLabel = minimalPairs[categoryIndex].category;
    setLanguage(catLabel);
  }, [categoryIndex, setLanguage]);

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
  const { play } = useAudio(selectedPair, SPEED_TABLE[speedTier]);

  const handlePlay = useCallback(async () => {
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(Date.now());
    const idx: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setPlayedIdx(idx);
    try {
      await play(idx);
    } catch {
      Alert.alert('Audio Error', 'Cannot play clip');
    }
  }, [play]);

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

  const handlePairChange = (i: number) => {
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.title}>{translate(tKeys.practicePairs)}</Text>

      <CategoryDropdown
        categories={minimalPairs.map((c) => c.category)}
        current={categoryIndex}
        onSelect={(idx) => {
          setCategoryIndex(idx);
          setPairIndex(0);
          setFeedback(null);
          setPlayedIdx(null);
          setLanguage(minimalPairs[idx].category);
        }}
      />

      <PairPicker
        pairs={visible}
        index={pairIndex}
        setIndex={handlePairChange}
        color={theme.text}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handlePlay}
        disabled={playedIdx !== null && feedback === null}
      >
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      <AnswerButtons
        pair={selectedPair}
        onAnswer={handleAnswer}
        feedback={feedback}
      />
    </View>
  );
}
