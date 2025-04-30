import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import createStyles from '@/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';

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
  const styles = createStyles(theme);

  return (
    <View style={styles.answerContainer}>
      <View style={styles.buttonRow}>
        {[0, 1].map((idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.button}
            onPress={() => onAnswer(idx as 0 | 1)}
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
