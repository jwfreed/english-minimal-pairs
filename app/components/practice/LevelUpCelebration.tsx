import React from 'react';
import { Text, View } from 'react-native';
import type { AppStyles } from '@/app/constants/styles';
import LevelIndicator from '@/app/components/LevelIndicator';

type LevelUpCelebrationStyles = Pick<
  AppStyles,
  'levelUpContainer' | 'levelUpText'
>;

interface LevelUpCelebrationProps {
  promotedTier: number | null;
  label: string;
  styles: LevelUpCelebrationStyles;
}

export default function LevelUpCelebration({
  promotedTier,
  label,
  styles,
}: LevelUpCelebrationProps) {
  if (promotedTier == null) return null;

  return (
    <View style={styles.levelUpContainer}>
      <Text style={styles.levelUpText}>🎉 {label}</Text>
      <LevelIndicator currentTier={promotedTier} compact />
    </View>
  );
}
