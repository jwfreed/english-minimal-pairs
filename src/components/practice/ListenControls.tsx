import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppStyles } from '@/src/constants/styles';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';

type ListenControlsStyles = Pick<
  AppStyles,
  'playButton' | 'playButtonPlaying' | 'playIconCircle' | 'playButtonLabel'
>;

interface ListenControlsProps {
  label: string;
  disabled: boolean;
  onPlay: () => void;
  isPlaying: boolean;
  styles: ListenControlsStyles;
}

export default function ListenControls({
  label,
  disabled,
  onPlay,
  isPlaying,
  styles,
}: ListenControlsProps) {
  const { translate } = useLanguage();
  const barScales = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.4),
    new Animated.Value(0.4),
  ]).current;
  const barLoops = useMemo(
    () =>
      barScales.map((scale, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.timing(scale, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0.4, duration: 260, useNativeDriver: true }),
            Animated.delay((2 - index) * 200),
          ])
        )
      ),
    [barScales]
  );

  useEffect(() => {
    if (isPlaying) {
      barLoops.forEach((loop) => loop.start());
      return () => barLoops.forEach((loop) => loop.stop());
    }
    barLoops.forEach((loop) => loop.stop());
    barScales.forEach((scale) => scale.setValue(0.4));
  }, [barLoops, barScales, isPlaying]);

  return (
    <TouchableOpacity
      style={[styles.playButton, isPlaying && styles.playButtonPlaying]}
      onPress={onPlay}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate(tKeys.doubleTapToHearAWord)}
      accessibilityState={{ disabled }}
    >
      <View style={styles.playIconCircle} importantForAccessibility="no">
        {isPlaying ? (
          barScales.map((scale, index) => (
            <Animated.View
              key={index}
              style={{
                width: 3,
                height: 14,
                borderRadius: 2,
                backgroundColor: '#FFFFFF',
                transform: [{ scaleY: scale }],
              }}
            />
          ))
        ) : (
          <Ionicons name="play" size={16} color="#FFFFFF" />
        )}
      </View>
      <Text style={styles.playButtonLabel} importantForAccessibility="no">
        {isPlaying ? 'Listening…' : label}
      </Text>
    </TouchableOpacity>
  );
}
