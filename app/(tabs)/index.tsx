import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics'; // 1) Import Expo Haptics
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['Warning: Grid: Support for defaultProps']);

/**
 * HomeScreen
 *
 * The main practice interface:
 *  - Floating dropdown for Category selection
 *  - Native Picker for Pair selection
 *  - "Play Audio" to hear a random word from the selected pair
 *  - Two answer buttons with ✓/✗ feedback
 *  - Micro-animation & haptic feedback on correct answers
 */
export default function HomeScreen() {
  // Global context usage
  const { recordAttempt } = usePairProgress();
  const { setLanguage, t, categoryIndex, setCategoryIndex, language } =
    useLanguageScheme();

  // Categories from minimalPairs
  const categories = minimalPairs.map((catObj) => catObj.category);

  // Local quiz state
  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // 2) Micro-animation: track an Animated.Value for correct button scale
  const correctButtonScale = useRef(new Animated.Value(1)).current;

  // Floating dropdown toggle
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Fade/Scale animation for the floating dropdown
  const dropdownOpacity = useRef(new Animated.Value(0)).current;

  // Theming
  const themeColors = {
    background: useThemeColor({}, 'background')(),
    text: useThemeColor({}, 'text')(),
    success: useThemeColor({}, 'success')(),
    error: useThemeColor({}, 'error')(),
    primary: useThemeColor({}, 'primary')(),
    buttonText: useThemeColor({}, 'buttonText')(),
  };
  const styles = createStyles(themeColors);

  /**
   * Keep the language context updated whenever categoryIndex changes
   */
  useEffect(() => {
    setLanguage(categories[categoryIndex]);
  }, [categoryIndex, categories, setLanguage]);

  /**
   * Identify the currently selected category object, or show fallback if empty
   */
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

  // Extract pairs and find the active pair
  const pairsInCategory = catObj.pairs;
  const selectedPair = pairsInCategory[pairIndex];
  const soundRef = useRef<Audio.Sound | null>(null);

  /**
   * Configure audio on mount
   */
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

  /**
   * Play a random word from the pair
   */
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

  /**
   * 3) Define a "pop" animation for correct answers
   */
  function popAnimation() {
    correctButtonScale.setValue(0.9);
    Animated.sequence([
      Animated.spring(correctButtonScale, {
        toValue: 1.2,
        friction: 2,
        useNativeDriver: true,
      }),
      Animated.spring(correctButtonScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }

  /**
   * Determine if the user answered correctly or not
   */
  function handleAnswer(chosenIndex: 0 | 1) {
    if (playedWordIndex === null) return;
    const isCorrect = chosenIndex === playedWordIndex;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    // 4) Provide haptic feedback
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      popAnimation(); // Trigger the pop on the correct button
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Re-fetch catObj in case the category changed mid-flow
    const catObj = minimalPairs.find(
      (cat) => cat.category === selectedCategoryName
    );
    if (!catObj || catObj.pairs.length === 0) return;

    const selectedPair = catObj.pairs[pairIndex];
    const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;
    recordAttempt(pairID, isCorrect);
  }

  // Localized or custom text for "Play Audio"
  const playAudioText = alternateLanguages[language]?.playAudio || 'Play Audio';

  /**
   * Animate the floating dropdown open
   */
  function openDropdown() {
    setShowCategoryDropdown(true);
    Animated.timing(dropdownOpacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }

  /**
   * Animate the floating dropdown closed
   */
  function closeDropdown() {
    Animated.timing(dropdownOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowCategoryDropdown(false);
      }
    });
  }

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Text style={styles.title}>{t('practicePairs')}</Text>

      {/**
       * Floating dropdown trigger for categories
       */}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() =>
          showCategoryDropdown ? closeDropdown() : openDropdown()
        }
      >
        <Text style={styles.dropdownButtonText}>{selectedCategoryName} ▼</Text>
      </TouchableOpacity>

      {/**
       * If open, show an overlay and an animated dropdown card
       */}
      {showCategoryDropdown && (
        <Pressable style={styles.overlay} onPress={closeDropdown}>
          <Animated.View
            style={[
              styles.dropdownCard,
              {
                opacity: dropdownOpacity,
                transform: [
                  {
                    scale: dropdownOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {categories.map((catName, i) => (
              <TouchableOpacity
                key={catName}
                style={styles.dropdownItem}
                onPress={() => {
                  setCategoryIndex(i);
                  setPairIndex(0);
                  setFeedback(null);
                  closeDropdown();
                }}
              >
                <Text style={styles.dropdownItemText}>{catName}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      )}

      {/**
       * Pair Picker (native)
       * Lets the user pick which minimal pair to practice next
       */}
      <Picker
        selectedValue={String(pairIndex)}
        onValueChange={(val) => {
          setPairIndex(Number(val));
          setFeedback(null);
        }}
        style={{ width: 250, color: themeColors.text, marginBottom: 10 }}
      >
        {pairsInCategory.map((p, i) => {
          const label = `${p.word1} - ${p.word2}`;
          return <Picker.Item key={label} label={label} value={String(i)} />;
        })}
      </Picker>

      {/**
       * Play Audio button
       */}
      <TouchableOpacity style={styles.button} onPress={handlePlay}>
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      {/**
       * Two answer buttons (the minimal pair words) + feedback overlay.
       * We'll conditionally wrap the correct button with an Animated.View
       * so it "pops" if the user is correct.
       */}
      <View style={styles.answerContainer}>
        <View style={styles.buttonRow}>
          {/**
           * If the correct answer was button 0, and user got it right,
           * wrap it in an Animated.View to run the pop.
           */}
          {playedWordIndex === 0 && feedback === 'correct' ? (
            <Animated.View
              style={{ transform: [{ scale: correctButtonScale }] }}
            >
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleAnswer(0)}
              >
                <Text style={styles.buttonText}>{selectedPair.word1}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleAnswer(0)}
            >
              <Text style={styles.buttonText}>{selectedPair.word1}</Text>
            </TouchableOpacity>
          )}

          {/**
           * Same logic for button 1
           */}
          {playedWordIndex === 1 && feedback === 'correct' ? (
            <Animated.View
              style={{ transform: [{ scale: correctButtonScale }] }}
            >
              <TouchableOpacity
                style={styles.button}
                onPress={() => handleAnswer(1)}
              >
                <Text style={styles.buttonText}>{selectedPair.word2}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={() => handleAnswer(1)}
            >
              <Text style={styles.buttonText}>{selectedPair.word2}</Text>
            </TouchableOpacity>
          )}
        </View>

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
  );
}
