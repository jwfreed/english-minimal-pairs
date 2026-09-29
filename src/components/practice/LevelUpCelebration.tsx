import React, { useEffect } from 'react';
import { Text, View, AccessibilityInfo } from 'react-native';
import type { AppStyles } from '@/src/constants/styles';
import LevelIndicator from '@/src/components/LevelIndicator';

type LevelUpCelebrationStyles = Pick<
  AppStyles,
  'levelUpContainer' | 'levelUpText'
>;

interface LevelUpCelebrationProps {
  /** Mastery level just reached (7 = mastered). */
  promotedLevel: number | null;
  label: string;
  styles: LevelUpCelebrationStyles;
}

export default function LevelUpCelebration({
  promotedLevel,
  label,
  styles,
}: LevelUpCelebrationProps) {
  useEffect(() => {
    if (promotedLevel != null) {
      AccessibilityInfo.announceForAccessibility(label);
    }
  }, [promotedLevel, label]);

  if (promotedLevel == null) return null;

  return (
    <View style={styles.levelUpContainer}>
      <Text style={styles.levelUpText}>🎉 {label}</Text>
      <LevelIndicator masteryLevel={promotedLevel} compact />
    </View>
  );
}
