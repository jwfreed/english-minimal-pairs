import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, StyleSheet, useColorScheme } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio } from 'expo-av';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';

export default function HomeScreen() {
  const { recordAttempt } = usePairProgress();
  const colorScheme = useColorScheme();

  // Build an array of unique categories
  const categories = Array.from(new Set(minimalPairs.map((mp) => mp.category)));
  // e.g. ["Consonant Minimal Pairs", "Vowel Minimal Pairs"]

  // State for which category + which pair is chosen
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);

  // Filter the minimalPairs to only those in the selected category
  const selectedCategory = categories[categoryIndex];
  const pairsInCategory = minimalPairs.filter(
    (mp) => mp.category === selectedCategory
  );
  // pairsInCategory might be e.g. [ {id:"bat-pat", category:"Consonant", pair:[...]}, ... ]

  // The chosen minimal pair
  const selectedPair = pairsInCategory[pairIndex];

  // States for the played word + feedback
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // For audio playback (if you add `audio` fields)
  const soundRef = useRef<Audio.Sound | null>(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Play one of the two words in the selected pair
  async function handlePlay() {
    setFeedback(null);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }

    // pick 0 or 1 randomly
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    try {
      const newSound = new Audio.Sound();
      // If you have audio fields like `selectedPair.pair[idx].audio`, load them here:
      // await newSound.loadAsync(selectedPair.pair[idx].audio);

      soundRef.current = newSound;
      // await soundRef.current.playAsync();
    } catch (err) {
      console.error('Error playing audio', err);
    }
  }

  // Handle user guess: "0" or "1"?
  function handleAnswer(chosenIndex: 0 | 1) {
    if (playedWordIndex === null) return;

    const isCorrect = chosenIndex === playedWordIndex;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    // record in context
    recordAttempt(selectedPair.id, isCorrect);
  }

  // Dark mode styles
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  // If there's no pairs in this category, handle edge case
  if (!selectedPair) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Text style={[styles.title, { color: textColor }]}>
          No pairs found for this category
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Practice Pairs</Text>

      {/* Category Picker */}
      <Picker
        selectedValue={String(categoryIndex)} // pass a string
        onValueChange={(itemValue) => {
          const numVal = Number(itemValue); // convert back to number
          setCategoryIndex(numVal);
          setPairIndex(0);
        }}
        style={{ width: 250, color: textColor }}
      >
        {categories.map((cat, i) => (
          <Picker.Item key={cat} label={cat} value={String(i)} />
        ))}
      </Picker>

      {/* Pair Picker */}
      <Picker
        selectedValue={String(pairIndex)}
        onValueChange={(itemValue) => {
          setPairIndex(Number(itemValue));
        }}
        style={{ width: 250, color: textColor }}
      >
        {pairsInCategory.map((p, i) => (
          <Picker.Item key={p.id} label={p.id} value={String(i)} />
        ))}
      </Picker>

      {/* Show which pair is selected + controls */}
      <Button title="Play Audio" onPress={handlePlay} />

      {/* The 2 words in the pair for user guess */}
      <View style={styles.buttonRow}>
        <Button
          title={selectedPair.pair[0].word}
          onPress={() => handleAnswer(0)}
        />
        <Button
          title={selectedPair.pair[1].word}
          onPress={() => handleAnswer(1)}
        />
      </View>

      {/* Feedback: Correct or Incorrect */}
      {feedback === 'correct' && (
        <Text style={{ color: 'green' }}>✓ Correct!</Text>
      )}
      {feedback === 'incorrect' && (
        <Text style={{ color: 'red' }}>✗ Incorrect!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 50,
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginVertical: 20,
    justifyContent: 'space-around',
    width: '60%',
  },
});
