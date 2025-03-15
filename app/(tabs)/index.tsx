import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';

export default function HomeScreen() {
  const { recordAttempt } = usePairProgress();
  const { setLanguage, t, categoryIndex, setCategoryIndex, language } =
    useLanguageScheme();

  // Get the list of languages (categories) from minimalPairs
  const categories = minimalPairs.map((catObj) => catObj.category);

  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // Fetch theme-based colors inside the component
  const themeColors = {
    background: useThemeColor({}, 'background')(),
    text: useThemeColor({}, 'text')(),
    success: useThemeColor({}, 'success')(),
    error: useThemeColor({}, 'error')(),
    primary: useThemeColor({}, 'primary')(),
    buttonText: useThemeColor({}, 'buttonText')(),
  };

  const styles = createStyles(themeColors);

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
        <Text style={styles.title}>
          {`No pairs found for ${selectedCategoryName}`}
        </Text>
      </View>
    );
  }

  const pairsInCategory = catObj.pairs;
  const selectedPair = pairsInCategory[pairIndex];
  const soundRef = React.useRef<Audio.Sound | null>(null);

  // Configure audio
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

  const playAudioText = alternateLanguages[language]?.playAudio || 'Play Audio';

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Text style={styles.title}>{t('practicePairs')}</Text>

      {/* Category Picker */}
      <Picker
        selectedValue={String(categoryIndex)}
        onValueChange={(val) => {
          setCategoryIndex(Number(val));
          setPairIndex(0);
          setFeedback(null);
        }}
        style={{ width: 250, color: themeColors.text }}
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
        style={{ width: 250, color: themeColors.text }}
      >
        {pairsInCategory.map((p, i) => {
          const label = `${p.word1} - ${p.word2}`;
          return <Picker.Item key={label} label={label} value={String(i)} />;
        })}
      </Picker>

      {/* Play Audio Button */}
      <View
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <TouchableOpacity style={styles.button} onPress={handlePlay}>
          <Text style={styles.buttonText}>{playAudioText}</Text>
        </TouchableOpacity>

        <View style={styles.answerContainer}>
          {/* The button row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleAnswer(0)}
            >
              <Text style={styles.buttonText}>{selectedPair.word1}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => handleAnswer(1)}
            >
              <Text style={styles.buttonText}>{selectedPair.word2}</Text>
            </TouchableOpacity>
          </View>

          {/* The feedback symbol */}
          {feedback && (
            <View style={styles.feedbackOverlay}>
              <Text
                style={[
                  styles.feedbackSymbol,
                  feedback === 'correct'
                    ? styles.correctFeedback
                    : styles.incorrectFeedback,
                ]}
              >
                {feedback === 'correct' ? '✓' : '✗'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
