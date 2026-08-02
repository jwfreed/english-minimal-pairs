import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStyles } from '@/src/constants/styles';
import SessionTimer, { type SessionTimerHandle } from '@/src/components/SessionTimer';

type PracticeHeaderStyles = Pick<
  AppStyles,
  'practiceHeader' | 'practiceTitle' | 'helpButton'
>;

interface PracticeHeaderProps {
  title: string;
  onHelpPress: () => void;
  primaryColor: string;
  styles: PracticeHeaderStyles;
  helpAccessibilityLabel: string;
  timerRef: React.MutableRefObject<SessionTimerHandle | null>;
  /** Visually reward the truthful goal progress while correct feedback shows. */
  highlightProgress?: boolean;
}

export default function PracticeHeader({
  title,
  onHelpPress,
  primaryColor,
  styles,
  helpAccessibilityLabel,
  timerRef,
  highlightProgress,
}: PracticeHeaderProps) {
  return (
    <View style={styles.practiceHeader}>
      <SessionTimer
        timerRef={timerRef}
        highlightProgress={highlightProgress}
        leading={<Text style={styles.practiceTitle}>{title}</Text>}
        trailing={
          <TouchableOpacity
            accessibilityLabel={helpAccessibilityLabel}
            accessibilityRole="button"
            activeOpacity={0.8}
            hitSlop={8}
            onPress={onHelpPress}
            style={styles.helpButton}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={primaryColor}
            />
          </TouchableOpacity>
        }
      />
    </View>
  );
}
