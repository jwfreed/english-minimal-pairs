import React, { useCallback } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Platform, useWindowDimensions } from 'react-native';
import { useHaptics } from '@/src/hooks/useHaptics';
import { TABLET_MIN_WIDTH } from '@/src/constants/styles';
import { font } from '@/src/constants/typography';


interface Props {
  pairs: { word1: string; word2: string; ipa1: string; ipa2: string }[];
  index: number;
  setIndex: (i: number) => void;
  color: string;
  onScrollStart?: () => void;
  onScrollEnd?: () => void;
  accessibilityLabel?: string;
}

function PairPickerInner({ pairs, index, setIndex, color, onScrollStart, onScrollEnd, accessibilityLabel }: Props) {
  const { triggerHaptic } = useHaptics();
  const isTablet = useWindowDimensions().width > TABLET_MIN_WIDTH;

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
        height: Platform.OS === 'ios' ? (isTablet ? 280 : 180) : undefined,
      }}
      itemStyle={{ ...font('600'), fontSize: isTablet ? 36 : 20, color }}
      accessibilityLabel={accessibilityLabel}
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
