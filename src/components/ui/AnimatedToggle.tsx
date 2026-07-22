// AnimatedToggle.tsx
// -----------------------------------------------------------------------------
// Display-only toggle with the Soundwise flip spring: the knob travels on an
// overshooting bezier while squashing (scale .84×1.12 at 40%, mock swKnob) and
// the track cross-fades green↔grey. Tap handling belongs to the parent row.
// -----------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const TRAVEL_MS = 300;
const SQUASH_TOTAL_MS = 380;
// swKnob hits full squash at 40% of the animation.
const SQUASH_IN_MS = SQUASH_TOTAL_MS * 0.4;
const SQUASH_OUT_MS = SQUASH_TOTAL_MS * 0.6;
const travelEase = Easing.bezier(0.34, 1.56, 0.64, 1);

interface Props {
  value: boolean;
  onColor: string;
  offColor: string;
  /** How far the knob slides when flipped on. */
  thumbTravel: number;
  trackStyle: StyleProp<ViewStyle>;
  thumbStyle: StyleProp<ViewStyle>;
}

export default function AnimatedToggle({
  value,
  onColor,
  offColor,
  thumbTravel,
  trackStyle,
  thumbStyle,
}: Props) {
  const reduceMotion = useReducedMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  const squashX = useRef(new Animated.Value(1)).current;
  const squashY = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      position.setValue(value ? 1 : 0);
      return;
    }
    if (reduceMotion) {
      position.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: TRAVEL_MS,
      easing: travelEase,
      useNativeDriver: false,
    }).start();
    squashX.setValue(1);
    squashY.setValue(1);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(squashX, {
          toValue: 0.84,
          duration: SQUASH_IN_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(squashY, {
          toValue: 1.12,
          duration: SQUASH_IN_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(squashX, {
          toValue: 1,
          duration: SQUASH_OUT_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(squashY, {
          toValue: 1,
          duration: SQUASH_OUT_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [position, reduceMotion, squashX, squashY, value]);

  const backgroundColor = position.interpolate({
    inputRange: [0, 1],
    outputRange: [offColor, onColor],
    // The travel bezier overshoots past 1; keep colors in range.
    extrapolate: 'clamp',
  });
  const translateX = position.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbTravel],
  });

  return (
    <Animated.View style={[trackStyle, { backgroundColor }]}>
      <Animated.View
        style={[
          thumbStyle,
          { transform: [{ translateX }, { scaleX: squashX }, { scaleY: squashY }] },
        ]}
      />
    </Animated.View>
  );
}
