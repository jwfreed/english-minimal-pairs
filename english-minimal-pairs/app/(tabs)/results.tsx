import React from 'react';
import { View, Text, FlatList, StyleSheet, useColorScheme } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';

interface MinimalPair {
  id: string;
  category: string;
  pair: { word: string; ipa: string }[];
}

export default function ResultsScreen() {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  const { progress } = usePairProgress();
  // progress is { [pairId: string]: { attempts: number; correct: number } }

  const renderPair = ({ item }: { item: MinimalPair }) => {
    // Look up attempts/correct from progress context
    const stats = progress[item.id] || { attempts: 0, correct: 0 };
    const { attempts, correct } = stats;
    const avg = attempts > 0 ? (correct / attempts) * 100 : 0;

    return (
      <View style={styles.row}>
        <Text style={[styles.pairTitle, { color: textColor }]}>{item.id}</Text>
        <Text style={[styles.stats, { color: textColor }]}>
          {correct}/{attempts} &nbsp; ({avg.toFixed(1)}%)
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.header, { color: textColor }]}>
        Batting Average by Pair
      </Text>
      <FlatList<MinimalPair>
        data={minimalPairs}
        keyExtractor={(item) => item.id}
        renderItem={renderPair}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontSize: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  pairTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  stats: {
    fontSize: 16,
  },
});
