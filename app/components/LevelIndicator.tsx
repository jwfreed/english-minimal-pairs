// components/LevelIndicator.tsx
// -----------------------------------------------------------------------------
// Visual indicator showing the current mastery tier (1–6) as a row of dots
// with a text label. Used on both the practice and results screens.
// -----------------------------------------------------------------------------
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';

const TOTAL_TIERS = 6;

interface Props {
  /** Current mastery tier (1–6) */
  currentTier: number;
  /** Compact mode for results list items */
  compact?: boolean;
}

export default function LevelIndicator({ currentTier, compact = false }: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { translate } = useLanguage();

  const isMastered = currentTier >= TOTAL_TIERS;
  const dotSize = compact ? 8 : 10;

  return (
    <View style={styles.levelIndicatorRow}>
      <Text style={[
        compact ? styles.levelLabelCompact : styles.levelLabel,
        isMastered && { color: theme.success },
      ]}>
        {isMastered
          ? `✔ ${translate(tKeys.mastered)}`
          : `${translate(tKeys.levelOf)} ${currentTier} / ${TOTAL_TIERS}`}
      </Text>
      <View style={styles.levelDotsRow}>
        {Array.from({ length: TOTAL_TIERS }, (_, i) => {
          const tier = i + 1;
          const isFilled = tier <= currentTier;
          return (
            <View
              key={tier}
              style={[
                styles.levelDot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: isFilled ? theme.primary : 'transparent',
                  borderColor: isFilled ? theme.primary : theme.border,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}
