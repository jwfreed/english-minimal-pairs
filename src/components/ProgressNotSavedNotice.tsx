import React, { useEffect } from 'react';
import {
  AccessibilityInfo,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';

interface ProgressNotSavedNoticeProps {
  /**
   * `failing`: a save was rejected and is being retried. `blocked`: saved
   * progress cannot be read, so new progress is not saved until it is fixed.
   */
  state: 'failing' | 'blocked';
  /** Starts the explicit recovery flow; offered only when blocked. */
  onRecover: () => void;
  style?: StyleProp<TextStyle>;
}

/**
 * Tells the learner that progress is not being saved. Never rendered for an
 * ordinary write in flight. The message is announced to screen readers once
 * per state, not on every render.
 */
export default function ProgressNotSavedNotice({
  state,
  onRecover,
  style,
}: ProgressNotSavedNoticeProps) {
  const { translate } = useLanguage();
  const theme = useAllThemeColors();
  const message = translate(
    state === 'blocked' ? tKeys.progressBlocked : tKeys.progressNotSaved
  );

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <View>
      <Text accessibilityRole="alert" style={[style, { color: theme.error }]}>
        {message}
      </Text>
      {state === 'blocked' && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={onRecover}
          hitSlop={8}
        >
          <Text
            style={[
              style,
              { color: theme.primaryText, textDecorationLine: 'underline' },
            ]}
          >
            {translate(tKeys.recoverProgress)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
