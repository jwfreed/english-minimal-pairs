import React from 'react';
import { Text, View } from 'react-native';
import PairPicker from '@/app/components/PairPicker';
import type { Pair } from '@/app/constants/minimalPairs';
import type { AppStyles } from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';

type PracticePairSelectorStyles = Pick<
  AppStyles,
  'pickerOverrideContainer' | 'pickerOverrideLabel'
>;

interface PracticePairSelectorProps {
  isLoading: boolean;
  selectedPair: Pair | undefined;
  pairs: Pair[];
  index: number;
  onIndexChange: (index: number) => void;
  color: string;
  loadingTextColor: string;
  styles: PracticePairSelectorStyles;
  onScrollStart: () => void;
  onScrollEnd: () => void;
}

export default function PracticePairSelector({
  isLoading,
  selectedPair,
  pairs,
  index,
  onIndexChange,
  color,
  loadingTextColor,
  styles,
  onScrollStart,
  onScrollEnd,
}: PracticePairSelectorProps) {
  const { translate } = useLanguage();

  if (isLoading || !selectedPair) {
    return (
      <View
        style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: loadingTextColor }}>{translate(tKeys.loading)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.pickerOverrideContainer}>
      <Text style={styles.pickerOverrideLabel}>{translate(tKeys.tryASpecificPair)}</Text>
      <PairPicker
        pairs={pairs}
        index={index}
        setIndex={onIndexChange}
        color={color}
        onScrollStart={onScrollStart}
        onScrollEnd={onScrollEnd}
        accessibilityLabel={translate(tKeys.tryASpecificPair)}
      />
    </View>
  );
}
