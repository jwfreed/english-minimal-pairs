import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PairPicker from '@/src/components/PairPicker';
import type { Pair } from '@/src/constants/minimalPairs';
import type { AppStyles } from '@/src/constants/styles';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';

type PracticePairSelectorStyles = Pick<
  AppStyles,
  | 'pickerOverrideContainer'
  | 'practicePairLabel'
  | 'practicePairWords'
  | 'pairPickerToggle'
  | 'pairPickerToggleText'
  | 'pairPickerPanel'
>;

interface PracticePairSelectorProps {
  isLoading: boolean;
  selectedPair: Pair | undefined;
  pairs: Pair[];
  index: number;
  onIndexChange: (index: number) => void;
  color: string;
  accentColor: string;
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
  accentColor,
  loadingTextColor,
  styles,
  onScrollStart,
  onScrollEnd,
}: PracticePairSelectorProps) {
  const { translate } = useLanguage();
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const handleTogglePicker = () => {
    if (isPickerVisible) {
      onScrollEnd();
    }
    setIsPickerVisible((visible) => !visible);
  };

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
      <Text style={styles.practicePairLabel}>{translate(tKeys.practicePair)}</Text>
      <Text
        accessibilityLabel={`${translate(tKeys.practicePair)}: ${selectedPair.word1}, ${selectedPair.word2}`}
        style={styles.practicePairWords}
      >
        {selectedPair.word1} ↔ {selectedPair.word2}
      </Text>
      <TouchableOpacity
        aria-controls="practice-pair-picker"
        aria-expanded={isPickerVisible}
        accessibilityRole="button"
        accessibilityLabel={translate(tKeys.chooseAnotherExample)}
        accessibilityState={{ expanded: isPickerVisible }}
        activeOpacity={0.8}
        onPress={handleTogglePicker}
        style={styles.pairPickerToggle}
      >
        <Text style={styles.pairPickerToggleText}>
          {translate(tKeys.chooseAnotherExample)}
        </Text>
        <Ionicons
          name={isPickerVisible ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={accentColor}
        />
      </TouchableOpacity>
      {isPickerVisible && (
        <View nativeID="practice-pair-picker" style={styles.pairPickerPanel}>
          <PairPicker
            pairs={pairs}
            index={index}
            setIndex={onIndexChange}
            color={color}
            onScrollStart={onScrollStart}
            onScrollEnd={onScrollEnd}
            accessibilityLabel={translate(tKeys.chooseAnotherExample)}
          />
        </View>
      )}
    </View>
  );
}
