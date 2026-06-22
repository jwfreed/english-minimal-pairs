import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStyles } from '@/app/constants/styles';

type PracticeHeaderStyles = Pick<
  AppStyles,
  'practiceHeader' | 'practiceHeaderSpacer' | 'practiceTitle' | 'helpButton'
>;

interface PracticeHeaderProps {
  title: string;
  onHelpPress: () => void;
  primaryColor: string;
  styles: PracticeHeaderStyles;
  helpAccessibilityLabel?: string;
}

export default function PracticeHeader({
  title,
  onHelpPress,
  primaryColor,
  styles,
  helpAccessibilityLabel,
}: PracticeHeaderProps) {
  return (
    <View style={styles.practiceHeader}>
      <View style={styles.practiceHeaderSpacer} />
      <Text style={styles.practiceTitle}>{title}</Text>
      <TouchableOpacity
        accessibilityLabel={helpAccessibilityLabel ?? 'Help'}
        accessibilityRole="button"
        activeOpacity={0.8}
        hitSlop={8}
        onPress={onHelpPress}
        style={styles.helpButton}
      >
        <Ionicons
          name="information-circle-outline"
          size={24}
          color={primaryColor}
        />
      </TouchableOpacity>
    </View>
  );
}
