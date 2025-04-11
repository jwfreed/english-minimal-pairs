// components/TimePracticedBar.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Progress from 'react-native-progress';
import { useLanguageScheme } from '@/hooks/useLanguageScheme';

interface Props {
  minutes: number;
  goal?: number;
}

export default function TimePracticedBar({ minutes, goal = 60 }: Props) {
  const { t } = useLanguageScheme();
  const progress = Math.min(minutes / goal, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {`${t('timePracticed')}: ${minutes.toFixed(0)} / ${goal} ${t('min')}`}
      </Text>
      <Progress.Bar
        progress={progress}
        width={null}
        height={12}
        borderRadius={6}
        color="#3b82f6"
        unfilledColor="#e5e7eb"
        borderWidth={0}
        animated
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '600',
  },
});
