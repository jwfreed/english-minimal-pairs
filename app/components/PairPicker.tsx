import React, { useCallback } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Dimensions, Platform } from 'react-native';
import { useHaptics } from '@/app/hooks/useHaptics';

const screenWidth = Dimensions.get('window').width;
const isTablet = screenWidth > 700;
const IOS_PICKER_HEIGHT = isTablet ? 280 : 180;

interface Props {
  pairs: { word1: string; word2: string; ipa1: string; ipa2: string }[];
  index: number;
  setIndex: (i: number) => void;
  color: string;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
}

function PairPickerInner({ pairs, index, setIndex, color, onScrollStart, onScrollEnd }: Props) {
  const { triggerHaptic } = useHaptics();

  const handleValueChange = useCallback(
    (v: string) => {
      const nextIndex = Number(v);
      if (nextIndex === index) return;
      triggerHaptic('selection');
      setIndex(nextIndex);
    },
    [index, setIndex, triggerHaptic]
  );

  // Notify parent when scrolling starts/stops so it can freeze the items list
  const handleScrollStart = useCallback(() => {
    onScrollStart?.();
  }, [onScrollStart]);

  // After the value settles, signal scroll end
  const handleValueSettled = useCallback(
    (v: string) => {
      handleValueChange(v);
      // Small delay to let the native animation finish
      setTimeout(() => onScrollEnd?.(), 150);
    },
    [handleValueChange, onScrollEnd]
  );

  return (
    <Picker
      selectedValue={String(index)}
      onValueChange={Platform.OS === 'ios' ? handleValueSettled : handleValueChange}
      style={{
        width: '100%',
        color,
        marginBottom: 10,
        height: Platform.OS === 'ios' ? IOS_PICKER_HEIGHT : undefined,
      }}
      itemStyle={{ fontSize: isTablet ? 36 : 20, fontWeight: '600', color }}
      accessibilityLabel="Try a specific pair"
      {...(Platform.OS === 'ios' ? { onFocus: handleScrollStart } : {})}
    >
      {pairs.map((p, i) => (
        <Picker.Item
          key={`${p.word1}-${p.word2}-${i}`}
          label={`${p.word1} (${p.ipa1}) - ${p.word2} (${p.ipa2})`}
          value={String(i)}
        />
      ))}
    </Picker>
  );
}

const PairPicker = React.memo(PairPickerInner);
export default PairPicker;
