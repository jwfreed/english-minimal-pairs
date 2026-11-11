import React, { useEffect } from 'react';
import { AccessibilityInfo, Text, type StyleProp, type TextStyle } from 'react-native';
import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';

interface ProgressNotSavedNoticeProps {
  style?: StyleProp<TextStyle>;
}

/**
 * Tells the learner that the progress on screen is not durably saved.
 * Rendered only while mastery or attempt history is pending or blocked.
 */
export default function ProgressNotSavedNotice({
  style,
}: ProgressNotSavedNoticeProps) {
  const { translate } = useLanguage();
  const theme = useAllThemeColors();
  const message = translate(tKeys.progressNotSaved);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  return (
    <Text accessibilityRole="alert" style={[style, { color: theme.error }]}>
      {message}
    </Text>
  );
}
