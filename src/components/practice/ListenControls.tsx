import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getAmbientGlowKeyframes, type AppStyles } from '@/src/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';

type ListenControlsStyles = Pick<
  AppStyles,
  | 'playButton'
  | 'playButtonPlaying'
  | 'playButtonGlow'
  | 'playIconCircle'
  | 'playButtonLabel'
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
  const theme = useAllThemeColors();
  const reduceMotion = useReducedMotion();
  const glowKeyframes = useMemo(() => getAmbientGlowKeyframes(theme), [theme]);
  const barScales = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.4),
    new Animated.Value(0.4),
  ]).current;
  const nudgeX = useRef(new Animated.Value(0)).current;

  // On press the play triangle nudges sideways before "Listening…" takes over
  // (mock: swNudge — 0 → -3px @35% → 2px @70% → 0 over 300ms ease-out).
  const handlePress = useCallback(() => {
    if (!reduceMotion) {
      nudgeX.setValue(0);
      Animated.sequence([
        Animated.timing(nudgeX, {
          toValue: -3,
          duration: 105,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(nudgeX, {
          toValue: 2,
          duration: 105,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(nudgeX, {
          toValue: 0,
          duration: 90,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
    onPlay();
  }, [nudgeX, onPlay, reduceMotion]);

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
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate(tKeys.doubleTapToHearAWord)}
      accessibilityState={{ disabled }}
    >
      {!isPlaying && (
        <Reanimated.View
          pointerEvents="none"
          importantForAccessibility="no"
          style={[
            styles.playButtonGlow,
            {
              animationName: glowKeyframes,
              animationDuration: '4.5s',
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            },
          ]}
        />
      )}
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
          <Animated.View style={{ transform: [{ translateX: nudgeX }] }}>
            <Ionicons name="play" size={16} color="#FFFFFF" />
          </Animated.View>
        )}
      </View>
      <Text style={styles.playButtonLabel} importantForAccessibility="no">
        {isPlaying ? translate(tKeys.listening) : label}
      </Text>
    </TouchableOpacity>
  );
}
