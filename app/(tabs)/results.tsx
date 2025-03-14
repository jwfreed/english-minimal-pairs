// results.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet, useColorScheme } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
}

export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { t, categoryIndex, setCategoryIndex } = useLanguageScheme();
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  // Get the list of languages (categories) from minimalPairs.
  const categories = minimalPairs.map((catObj) => catObj.category);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = minimalPairs.find(
    (cat) => cat.category === selectedCategoryName
  );

  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.header, { color: textColor }]}>
          {`No pairs found for ${selectedCategoryName}`}
        </Text>
      </View>
    );
  }

  const flattenedPairs: FlattenedPair[] = catObj.pairs.map((pairObj) => {
    const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;
    return { id: pairID, word1: pairObj.word1, word2: pairObj.word2 };
  });

  const renderPair = ({ item }: { item: FlattenedPair }) => {
    const stats = progress[item.id] || { attempts: 0, correct: 0 };
    const { attempts, correct } = stats;
    const avg = attempts > 0 ? (correct / attempts) * 100 : 0;
    return (
      <View style={styles.row}>
        <Text
          style={[styles.pairTitle, { color: textColor }]}
        >{`${item.word1} - ${item.word2}`}</Text>
        <Text
          style={[styles.stats, { color: textColor }]}
        >{`${correct}/${attempts} (${avg.toFixed(1)}%)`}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header using language context */}
      <Text style={[styles.header, { color: textColor }]}>
        {t('averageByPair')}
      </Text>

      {/* Use the global category state */}
      <Picker
        selectedValue={String(categoryIndex)}
        onValueChange={(val) => setCategoryIndex(Number(val))}
        style={{ width: 250, color: textColor, marginBottom: 16 }}
      >
        {categories.map((catName, i) => (
          <Picker.Item key={catName} label={catName} value={String(i)} />
        ))}
      </Picker>

      <FlatList
        data={flattenedPairs}
        keyExtractor={(item) => item.id}
        renderItem={renderPair}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 40 },
  header: { fontSize: 22, marginBottom: 8, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  pairTitle: { fontSize: 18, fontWeight: '600' },
  stats: { fontSize: 16 },
});
