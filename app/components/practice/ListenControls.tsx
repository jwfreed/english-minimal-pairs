import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import type { AppStyles } from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';

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
  const { translate } = useLanguage();

  return (
    <TouchableOpacity
      style={[styles.button, { zIndex: 10 }]}
      onPress={onPlay}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate(tKeys.doubleTapToHearAWord)}
      accessibilityState={{ disabled }}
    >
      <Text style={styles.buttonText} importantForAccessibility="no">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
