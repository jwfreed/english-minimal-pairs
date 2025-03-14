// index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { useColorScheme } from 'react-native';

export default function HomeScreen() {
  const { recordAttempt } = usePairProgress();
  const { setLanguage, t, categoryIndex, setCategoryIndex } =
    useLanguageScheme();

  // Get the list of languages (categories) from minimalPairs
  const categories = minimalPairs.map((catObj) => catObj.category);

  // Remove local state for category index; it's now global.
  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // Update language context when global categoryIndex changes.
  useEffect(() => {
    setLanguage(categories[categoryIndex]);
  }, [categoryIndex, categories, setLanguage]);

  // Get selected category and pair.
  const selectedCategoryName = categories[categoryIndex];
  const catObj = minimalPairs.find(
    (cat) => cat.category === selectedCategoryName
  );

  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text
          style={styles.title}
        >{`No pairs found for ${selectedCategoryName}`}</Text>
      </View>
    );
  }

  const pairsInCategory = catObj.pairs;
  const selectedPair = pairsInCategory[pairIndex];
  const soundRef = React.useRef<Audio.Sound | null>(null);

  // Configure audio on mount.
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

  async function handlePlay() {
    setFeedback(null);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
    }
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

  function handleAnswer(chosenIndex: 0 | 1) {
    if (playedWordIndex === null) return;
    const isCorrect = chosenIndex === playedWordIndex;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    const catObj = minimalPairs.find(
      (cat) => cat.category === selectedCategoryName
    );
    if (!catObj || catObj.pairs.length === 0) return;
    const selectedPair = catObj.pairs[pairIndex];
    const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;
    recordAttempt(pairID, isCorrect);
  }

  // Dark mode styling.
  const colorScheme = useColorScheme(); // returns "light" or "dark"
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff';
  const textColor = colorScheme === 'dark' ? '#fff' : '#000';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Use the language context for dynamic text */}
      <Text style={[styles.title, { color: textColor }]}>
        {t('practicePairs')}
      </Text>

      {/* Category Picker uses global category state */}
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

      {/* Pair Picker */}
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

      <Button title="Play Audio" onPress={handlePlay} />
      <View style={styles.buttonRow}>
        <Button title={selectedPair.word1} onPress={() => handleAnswer(0)} />
        <Button title={selectedPair.word2} onPress={() => handleAnswer(1)} />
      </View>

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
  container: { flex: 1, alignItems: 'center', paddingTop: 40 },
  title: { fontSize: 22, marginBottom: 10 },
  buttonRow: {
    flexDirection: 'row',
    marginVertical: 20,
    justifyContent: 'space-around',
    width: '60%',
  },
  feedbackText: { marginTop: 10, fontSize: 18 },
});
