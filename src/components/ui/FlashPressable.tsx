// FlashPressable.tsx
// -----------------------------------------------------------------------------
// Pressable row with the Soundwise warm tap highlight: the row flashes
// the accent at 16% on press-in and fades back over 400ms after release.
// Used across settings rows in place of TouchableOpacity's opacity dim.
// -----------------------------------------------------------------------------
import React, { ReactNode, useCallback, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { withAlpha } from '@/src/constants/Colors';
import { useAllThemeColors } from '@/src/context/theme';

const FADE_MS = 400;

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Match the row's border radius so the highlight follows rounded corners. */
  highlightRadius?: number;
}

export default function FlashPressable({
  style,
  children,
  highlightRadius,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const { accent } = useAllThemeColors();
  const flash = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      flash.stopAnimation();
      flash.setValue(1);
      onPressIn?.(event);
    },
    [flash, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      Animated.timing(flash, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: false,
      }).start();
      onPressOut?.(event);
    },
    [flash, onPressOut]
  );

  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [withAlpha(accent, 0), withAlpha(accent, 0.16)],
  });

  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor, borderRadius: highlightRadius },
        ]}
      />
      {children}
    </Pressable>
  );
}
