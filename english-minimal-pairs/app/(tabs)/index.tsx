import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, StyleSheet, useColorScheme } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';

export default function HomeScreen() {
  const { recordAttempt } = usePairProgress();
  const colorScheme = useColorScheme();

  // 1) Gather the category names from minimalPairs
  const categories = minimalPairs.map((catObj) => catObj.category);

  // 2) State for which category + which pair is chosen
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);

  // 3) Find the selected category object
  const selectedCategoryName = categories[categoryIndex];
  const catObj = minimalPairs.find(
    (cat) => cat.category === selectedCategoryName
  );

  // If we can’t find the category or there are no pairs, show a message
  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          No pairs found for {selectedCategoryName}
        </Text>
      </View>
    );
  }

  // 4) The array of pairs in this category
  const pairsInCategory = catObj.pairs;

  // 5) The chosen minimal pair from that array
  const selectedPair = pairsInCategory[pairIndex];

  // Track which word was played (0 or 1) + feedback
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // Audio reference
  const soundRef = useRef<Audio.Sound | null>(null);

  // Configure audio and unload on unmount
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      playThroughEarpieceAndroid: false,
    });

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Handle audio playback
  async function handlePlay() {
    setFeedback(null); // reset feedback for a new round

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }

    // Randomly pick word1 or word2
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    try {
      const newSound = new Audio.Sound();
      const audioToLoad = idx === 0 ? selectedPair.audio1 : selectedPair.audio2;
      await newSound.loadAsync(audioToLoad);

      soundRef.current = newSound;
      await newSound.playAsync();
    } catch (err) {
      console.error('Error playing audio', err);
    }
  }

  // When user chooses which word they heard
  function handleAnswer(chosenIndex: 0 | 1) {
    if (playedWordIndex === null) return;
    const isCorrect = chosenIndex === playedWordIndex;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    const catObj = minimalPairs.find(
      (cat) => cat.category === selectedCategoryName
    );

    if (!catObj || catObj.pairs.length === 0) {
      return (
        <View style={[styles.container, { backgroundColor }]}>
          <Text style={[styles.title, { color: textColor }]}>
            No pairs found for {selectedCategoryName}
          </Text>
        </View>
      );
    }

    const pairsInCategory = catObj.pairs;
    const selectedPair = pairsInCategory[pairIndex];

    // Build a unique ID for progress tracking
    const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;
    recordAttempt(pairID, isCorrect);
  }

  // Dark mode styling
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>Practice Pairs</Text>

      {/* Category Picker */}
      <Picker
        selectedValue={String(categoryIndex)}
        onValueChange={(val) => {
          setCategoryIndex(Number(val));
          setPairIndex(0);
          setFeedback(null);
        }}
        style={{ width: 250, color: textColor }}
      >
        {categories.map((catName, i) => (
          <Picker.Item key={catName} label={catName} value={String(i)} />
        ))}
      </Picker>

      {/* Pair Picker (within selected category) */}
      <Picker
        selectedValue={String(pairIndex)}
        onValueChange={(val) => {
          setPairIndex(Number(val));
          setFeedback(null);
        }}
        style={{ width: 250, color: textColor }}
      >
        {pairsInCategory.map((p, i) => {
          const label = `${p.word1} - ${p.word2}`;
          return <Picker.Item key={label} label={label} value={String(i)} />;
        })}
      </Picker>

      {/* Play & Answer */}
      <Button title="Play Audio" onPress={handlePlay} />
      <View style={styles.buttonRow}>
        <Button title={selectedPair.word1} onPress={() => handleAnswer(0)} />
        <Button title={selectedPair.word2} onPress={() => handleAnswer(1)} />
      </View>

      {/* Instant feedback */}
      {feedback === 'correct' && (
        <Text style={[styles.feedbackText, { color: 'green' }]}>
          ✓ Correct!
        </Text>
      )}
      {feedback === 'incorrect' && (
        <Text style={[styles.feedbackText, { color: 'red' }]}>
          ✗ Incorrect!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
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
  feedbackText: {
    marginTop: 10,
    fontSize: 18,
  },
});
