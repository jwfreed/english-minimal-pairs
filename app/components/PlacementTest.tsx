// components/PlacementTest.tsx
// -----------------------------------------------------------------------------
// Quick 10-question placement test that samples one pair from each difficulty
// tier (1-6) across the active category's groups. Returns a recommended
// starting tier based on the user's accuracy.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Speech from 'expo-speech';
import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';
import { useSettings } from '@/app/context/SettingsContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';
import type { Pair } from '@/app/constants/minimalPairs';

const TOTAL_QUESTIONS = 10;

interface Props {
  /** All pairs for the current category */
  pairs: Pair[];
  /** Called with the recommended starting tier (1-6) when the test finishes */
  onComplete: (startTier: number) => void;
  /** Called if the user skips the test */
  onSkip: () => void;
}

/** Shuffle array (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PlacementTest({ pairs, onComplete, onSkip }: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getNextVoice } = useSettings();
  const { translate } = useLanguage();

  // Build the test items: sample across tiers
  const testItems = useMemo(() => {
    const shuffled = shuffle(pairs);
    // Take up to TOTAL_QUESTIONS, prefer higher variety
    return shuffled.slice(0, TOTAL_QUESTIONS);
  }, [pairs]);

  const [qIndex, setQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [playedIdx, setPlayedIdx] = useState<0 | 1 | null>(null);
  const [answered, setAnswered] = useState(false);

  const currentPair = testItems[qIndex];

  const playWord = useCallback(async (idx: 0 | 1) => {
    if (!currentPair) return;
    const word = idx === 0 ? currentPair.word1 : currentPair.word2;
    const voice = getNextVoice();
    Speech.speak(word, {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      ...(voice ? { voice: voice.identifier } : {}),
    });
  }, [currentPair, getNextVoice]);

  // Auto-play when question changes
  useEffect(() => {
    if (!currentPair) return;
    const idx: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
    setPlayedIdx(idx);
    setAnswered(false);
    // Small delay to let UI transition
    const t = setTimeout(() => playWord(idx), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, currentPair]);

  const handleAnswer = useCallback((idx: 0 | 1) => {
    if (playedIdx === null || answered) return;
    setAnswered(true);
    const correct = idx === playedIdx;
    const newCorrectCount = correctCount + (correct ? 1 : 0);
    setCorrectCount(newCorrectCount);

    // Advance after a brief delay
    setTimeout(() => {
      if (qIndex + 1 >= testItems.length) {
        // Test complete — compute recommended tier
        const accuracy = newCorrectCount / testItems.length;
        let tier: number;
        if (accuracy >= 0.9) tier = 4;
        else if (accuracy >= 0.7) tier = 3;
        else if (accuracy >= 0.5) tier = 2;
        else tier = 1;
        onComplete(tier);
      } else {
        setQIndex((i) => i + 1);
      }
    }, 600);
  }, [playedIdx, answered, correctCount, qIndex, testItems.length, onComplete]);

  if (!currentPair) {
    return <ActivityIndicator />;
  }

  return (
    <View style={[styles.container, { justifyContent: 'center' }]}>
      <Text style={[styles.title, { marginBottom: 8 }]}>
        {translate(tKeys.placementTest) || 'Placement Test'}
      </Text>
      <Text style={[styles.ipaText, { marginBottom: 24, textAlign: 'center' }]}>
        {`${qIndex + 1} / ${testItems.length}`}
      </Text>

      <TouchableOpacity
        style={[styles.button, { marginBottom: 20 }]}
        onPress={() => playedIdx !== null && playWord(playedIdx)}
      >
        <Text style={styles.buttonText}>🔊 {translate(tKeys.playAudio)}</Text>
      </TouchableOpacity>

      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.button,
              { flex: 1, marginTop: 0 },
              answered && { opacity: 0.5 },
            ]}
            onPress={() => handleAnswer(idx as 0 | 1)}
            disabled={answered}
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
      >
        <Text style={[styles.ipaText, { textDecorationLine: 'underline' }]}>
          {translate(tKeys.skip) || 'Skip'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
