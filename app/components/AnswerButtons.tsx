import React, { useMemo, useEffect } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';
import { useHaptics } from '@/app/hooks/useHaptics';

interface Pair {
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
}

interface Props {
  pair: Pair;
  onAnswer: (idx: 0 | 1) => void;
  feedback: 'correct' | 'incorrect' | null;
}

export default function AnswerButtons({ pair, onAnswer, feedback }: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { triggerHaptic } = useHaptics();

  // Trigger haptic feedback when feedback changes
  useEffect(() => {
    if (feedback === 'correct') {
      triggerHaptic('success');
    } else if (feedback === 'incorrect') {
      triggerHaptic('error');
    }
  }, [feedback, triggerHaptic]);

  const handlePress = (idx: 0 | 1) => {
    triggerHaptic('light');
    onAnswer(idx);
  };

  return (
    <View style={styles.answerContainer}>
      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.button}
            onPress={() => handlePress(idx as 0 | 1)}
          >
            <Text style={styles.buttonText}>
              {idx ? pair.word2 : pair.word1}
            </Text>
            <Text style={styles.ipaText}>{idx ? pair.ipa2 : pair.ipa1}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {feedback && (
        <View style={styles.feedbackOverlay}>
          <Text
            style={[
              styles.feedbackSymbol,
              feedback === 'correct'
                ? styles.correctFeedback
                : styles.incorrectFeedback,
            ]}
          >
            {feedback === 'correct' ? '✓' : '✗'}
          </Text>
        </View>
      )}
    </View>
  );
}
