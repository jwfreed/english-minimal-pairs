import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { AppStyles } from '@/app/constants/styles';

type ListenControlsStyles = Pick<AppStyles, 'button' | 'buttonText'>;

interface ListenControlsProps {
  label: string;
  disabled: boolean;
  onPlay: () => void;
  styles: ListenControlsStyles;
}

export default function ListenControls({
  label,
  disabled,
  onPlay,
  styles,
}: ListenControlsProps) {
  return (
    <TouchableOpacity
      style={[styles.button, { zIndex: 10 }]}
      onPress={onPlay}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Double tap to hear a word"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.buttonText} importantForAccessibility="no">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
