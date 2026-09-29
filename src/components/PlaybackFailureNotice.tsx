import React, { useEffect } from 'react';
import { AccessibilityInfo, Text, type StyleProp, type TextStyle } from 'react-native';
import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';

interface PlaybackFailureNoticeProps {
  style?: StyleProp<TextStyle>;
}

/**
 * Explains that the prompt audio did not play. Rendered only while playback is
 * in its failed state; the Play control remains the retry path.
 */
export default function PlaybackFailureNotice({
  style,
}: PlaybackFailureNoticeProps) {
  const { translate } = useLanguage();
  const theme = useAllThemeColors();
  const message = translate(tKeys.audioPlaybackFailed);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Text accessibilityRole="alert" style={[style, { color: theme.error }]}>
      {message}
    </Text>
  );
}
