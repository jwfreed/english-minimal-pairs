import React, { useCallback } from 'react';
import { Picker } from '@react-native-picker/picker';
import { Dimensions } from 'react-native';
import { useHaptics } from '@/app/hooks/useHaptics';

const screenWidth = Dimensions.get('window').width;
const isTablet = screenWidth > 700;

interface Props {
  pairs: { word1: string; word2: string; ipa1: string; ipa2: string }[];
  index: number;
  setIndex: (i: number) => void;
  color: string;
}

export default function PairPicker({ pairs, index, setIndex, color }: Props) {
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

  return (
    <Picker
      selectedValue={String(index)}
      onValueChange={handleValueChange}
      style={{ width: '100%', color, marginBottom: 10 }}
      itemStyle={{ fontSize: isTablet ? 32 : 16, height: isTablet ? 180 : undefined }}
    >
      {pairs.map((p, i) => (
        <Picker.Item
          key={i}
          label={`${p.word1} (${p.ipa1}) - ${p.word2} (${p.ipa2})`}
          value={String(i)}
        />
      ))}
    </Picker>
  );
}
