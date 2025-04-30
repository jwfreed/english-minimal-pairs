// app/(tabs)/index.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCategory } from '@/src/context/CategoryContext';
import { useAllThemeColors } from '@/src/context/theme';
import createStyles from '@/constants/styles';
import { minimalPairs, Pair } from '@/constants/minimalPairs';
import { tKeys } from '@/constants/translationKeys';

import CategoryDropdown from '@/components/CategoryDropdown';
import PairPicker from '@/components/PairPicker';
import AnswerButtons from '@/components/AnswerButtons';

import { useContrastPairs } from '@/hooks/useContrastPairs';
import { useAudio } from '@/hooks/useAudio';

/* Playback‑rate steps per acoustic tier (0–2) */
const SPEED_TABLE: Record<0 | 1 | 2, number> = { 0: 1.0, 1: 1.1, 2: 1.2 };
const MAX_SPEED: 2 = 2; // promote lexical after reaching 2 → streak

export default function HomeScreen() {
  /* ─── contexts & theme */
  const { translate } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const theme = useAllThemeColors();
  const styles = createStyles(theme);
  const playAudioText = translate(tKeys.playAudio);

  /* ─── state maps keyed by contrast group */
  const [groupSpeed, setGroupSpeed] = useState<Record<string, 0 | 1 | 2>>({});
  const [groupStreak, setGroupStreak] = useState<Record<string, number>>({});

  /* ─── picker index & feedback */
  const [pairIndex, setPairIndex] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  /* ─── visible pairs via contrast hook */
  const catObj = minimalPairs[categoryIndex];
  const { visible, promote } = useContrastPairs(catObj.pairs);
  const selectedPair: Pair = visible[pairIndex];

  /* ─── current speed tier for this contrast */
  const speedTier = groupSpeed[selectedPair.group] ?? 0;
  const { play } = useAudio(selectedPair, SPEED_TABLE[speedTier]);

  /* ─── handlers */
  const handlePlay = useCallback(async () => {
    setFeedback(null);
    setPlayedIdx(null);
    setStartTime(Date.now());
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedIdx(idx);
    try {
      await play(idx as 0 | 1);
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

      const g = selectedPair.group;
      const curSpeed = groupSpeed[g] ?? 0;
      const curStreak = groupStreak[g] ?? 0;

      if (correct && rtMs < 2000) {
        const newStreak = curStreak + 1;
        if (curSpeed < MAX_SPEED && newStreak >= 3) {
          // bump speed tier within same contrast
          setGroupSpeed({ ...groupSpeed, [g]: (curSpeed + 1) as 0 | 1 | 2 });
          setGroupStreak({ ...groupStreak, [g]: 0 });
        } else if (curSpeed === MAX_SPEED && newStreak >= 3) {
          // lexical promotion then reset speed
          promote(g);
          setGroupSpeed({ ...groupSpeed, [g]: 0 });
          setGroupStreak({ ...groupStreak, [g]: 0 });
          setPairIndex(0);
        } else {
          setGroupStreak({ ...groupStreak, [g]: newStreak });
        }
      } else {
        // wrong or slow → reset streak & optionally drop speed one step
        setGroupStreak({ ...groupStreak, [g]: 0 });
        if (!correct && curSpeed > 0) {
          setGroupSpeed({ ...groupSpeed, [g]: (curSpeed - 1) as 0 | 1 });
        }
      }
    },
    [playedIdx, startTime, selectedPair, groupSpeed, groupStreak, promote]
  );

  const handlePairChange = (i: number) => {
    setPairIndex(i);
    setFeedback(null);
    setPlayedIdx(null);
  };

  /* ─── render */
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
        }}
      />

      <PairPicker
        pairs={visible}
        index={pairIndex}
        setIndex={handlePairChange}
        color={theme.text}
      />

      <TouchableOpacity style={styles.button} onPress={handlePlay}>
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
