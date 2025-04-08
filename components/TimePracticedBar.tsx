// components/TimePracticedBar.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
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
    marginBottom: 4,
    fontWeight: '500',
  },
  barBackground: {
    width: '100%',
    height: 12,
    backgroundColor: '#ccc',
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: 'blue',
  },
});
