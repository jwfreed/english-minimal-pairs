import React from 'react';
import { Text, View } from 'react-native';
import PairPicker from '@/app/components/PairPicker';
import type { Pair } from '@/app/constants/minimalPairs';

interface PracticePairSelectorProps {
  isLoading: boolean;
  selectedPair: Pair | undefined;
  pairs: Pair[];
  index: number;
  onIndexChange: (index: number) => void;
  color: string;
  loadingTextColor: string;
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
  onScrollStart,
  onScrollEnd,
}: PracticePairSelectorProps) {
  if (isLoading || !selectedPair) {
    return (
      <View
        style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: loadingTextColor }}>Loading…</Text>
      </View>
    );
  }

  return (
    <PairPicker
      pairs={pairs}
      index={index}
      setIndex={onIndexChange}
      color={color}
      onScrollStart={onScrollStart}
      onScrollEnd={onScrollEnd}
    />
  );
}
