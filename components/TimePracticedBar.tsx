// src/components/TimePracticedBar.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  minutes: number;
  goal?: number;
}

export default function TimePracticedBar({ minutes, goal = 60 }: Props) {
  const progress = Math.min(minutes / goal, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Time Practiced: {minutes.toFixed(0)} / {goal} min
      </Text>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
