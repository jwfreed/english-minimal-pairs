import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
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

  useEffect(() => {
    if (!isPlaying) {
      barScales.forEach((scale) => scale.setValue(0.4));
      return;
    }
    // Build the loops fresh on each playback. A stopped Animated.loop keeps its
    // internal "finished" flag set, and on the JS driver (which a sequence-backed
    // loop always uses) start() returns immediately once finished — so a reused
    // loop animates only the first time. Recreating guarantees every play pulses.
    const animations = barScales.map((scale, index) =>
      Animated.sequence([
        Animated.delay(index * 200),
        Animated.loop(
          Animated.sequence([
            Animated.timing(scale, {
              toValue: 1,
              duration: 500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 0.4,
              duration: 500,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ),
      ])
    );
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      barScales.forEach((scale) => scale.setValue(0.4));
    };
  }, [barScales, isPlaying]);

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
        {isPlaying ? translate(tKeys.listening) : label}
      </Text>
    </TouchableOpacity>
  );
}
