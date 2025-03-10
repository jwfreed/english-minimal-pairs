// results.tsx

import React from 'react';
import { View, Text, FlatList, StyleSheet, useColorScheme } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';

// 1) Define an interface for the flattened pair item
interface FlattenedPair {
  id: string; // unique ID, e.g. "road-load-(Japanese)"
  category: string; // e.g. "Japanese L1 Learners"
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
  // audio1, audio2 if you want them here, but for results, we mainly show attempts/correct
}

export default function ResultsScreen() {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  const { progress } = usePairProgress();
  // progress is { [pairID: string]: { attempts: number; correct: number } }

  // 2) Flatten all L1 categories into a single list of pairs
  const allPairs: FlattenedPair[] = minimalPairs.flatMap((catObj) => {
    return catObj.pairs.map((pairObj) => {
      // Generate a unique ID
      const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;

      return {
        id: pairID,
        category: catObj.category,
        word1: pairObj.word1,
        word2: pairObj.word2,
        ipa1: pairObj.ipa1,
        ipa2: pairObj.ipa2,
      };
    });
  });

  // 3) Rendering each pair in the results list
  const renderPair = ({ item }: { item: FlattenedPair }) => {
    // Look up attempts/correct from progress dictionary
    const stats = progress[item.id] || { attempts: 0, correct: 0 };
    const { attempts, correct } = stats;
    const avg = attempts > 0 ? (correct / attempts) * 100 : 0;

    return (
      <View style={styles.row}>
        {/* 
          Show something like "road-load (Japanese L1 Learners)" 
          or just item.word1-word2, your choice 
        */}
        <Text style={[styles.pairTitle, { color: textColor }]}>
          {item.word1} - {item.word2}
        </Text>

        <Text style={[styles.stats, { color: textColor }]}>
          {correct}/{attempts} ({avg.toFixed(1)}%)
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.header, { color: textColor }]}>Average by Pair</Text>

      {/* 4) Pass the flattened list to FlatList */}
      <FlatList
        data={allPairs}
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
