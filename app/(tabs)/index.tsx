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
import {
  useProgress,
  useRecordAttempt,
} from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';
import { LogBox } from 'react-native';

// This hides the "Warning: Grid: Support for defaultProps" message
if (LogBox?.ignoreLogs) {
  LogBox.ignoreLogs(['Warning: Grid: Support for defaultProps']);
}

/**
 * HomeScreen
 *
 * The main practice interface:
 *  - Category selection (dropdown)
 *  - Picker for Pair selection
 *  - "Play Audio" => times the user's attempt
 *  - Two answer buttons with immediate feedback
 *  - Micro-animations & haptics on correct/incorrect
 */
export default function HomeScreen() {
  // 1) Access global context
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();

  const { setLanguage, t, categoryIndex, setCategoryIndex, language } =
    useLanguageScheme();

  // 2) Gather categories
  const categories = minimalPairs.map((catObj) => catObj.category);

  // 3) Local quiz state
  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );

  // 4) Track the start time for each attempt (when user taps "Play Audio")
  const [startTime, setStartTime] = useState<number | null>(null);

  // Micro-animation for correct answers
  const correctButtonScale = useRef(new Animated.Value(1)).current;

  // Floating category dropdown
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const dropdownOpacity = useRef(new Animated.Value(0)).current;

  // Theming
  const themeColors = {
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    success: useThemeColor({}, 'success'),
    error: useThemeColor({}, 'error'),
    primary: useThemeColor({}, 'primary'),
    buttonText: useThemeColor({}, 'buttonText'),
    cardBackground: useThemeColor({}, 'cardBackground'),
    shadow: useThemeColor({}, 'shadow'),
    icon: useThemeColor({}, 'icon'),
  };

  const styles = createStyles(themeColors);

  /**
   * Keep the language context updated whenever categoryIndex changes
   */
  useEffect(() => {
    setLanguage(categories[categoryIndex]);
  }, [categoryIndex, categories, setLanguage]);

  /**
   * Identify the currently selected category object
   */
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

  // Extract pairs and find the active pair
  const pairsInCategory = catObj.pairs;
  const selectedPair = pairsInCategory[pairIndex];

  // Audio reference
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
   * (start timing the user's attempt)
   */
  // Declare soundRef to store both preloaded Audio.Sound instances
  const soundRefs = useRef<Audio.Sound[]>([]);

  // Preload audio whenever the selected pair or category changes
  useEffect(() => {
    let sound1: Audio.Sound;
    let sound2: Audio.Sound;

    const preloadAudio = async () => {
      if (!selectedPair) return;

      try {
        sound1 = new Audio.Sound();
        await sound1.loadAsync(selectedPair.audio1);

        sound2 = new Audio.Sound();
        await sound2.loadAsync(selectedPair.audio2);

        soundRefs.current = [sound1, sound2]; // store both loaded sounds
      } catch (e) {
        console.warn('Failed to preload audio', e);
      }
    };

    preloadAudio();

    // Cleanup: unload sounds on pair/category change
    return () => {
      sound1?.unloadAsync();
      sound2?.unloadAsync();
    };
  }, [pairIndex, categoryIndex, selectedPair]);

  // Event handler to play audio instantly
  async function handlePlay() {
    setFeedback(null);
    setStartTime(Date.now());

    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    try {
      await soundRefs.current[idx]?.replayAsync();
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  }

  /**
   * Show a little 'pop' for correct answers
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
   * The user selects which word they think was played
   */
  function handleAnswer(chosenIndex: 0 | 1) {
    if (playedWordIndex === null) return;

    // 1) Determine correctness
    const isCorrect = chosenIndex === playedWordIndex;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    // 2) Haptics
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      popAnimation();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // 3) Gather Pair ID for storage
    const catObj = minimalPairs.find(
      (cat) => cat.category === selectedCategoryName
    );
    if (!catObj || catObj.pairs.length === 0) return;
    const selectedPair = catObj.pairs[pairIndex];
    const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;

    // 4) Compute how long since user tapped "Play"
    const endTime = Date.now();
    const msElapsed = startTime ? endTime - startTime : 0;
    const durationMin = msElapsed / 60000; // convert ms to minutes

    // 5) Save attempt with time spent
    recordAttempt(pairID, isCorrect, durationMin);
  }

  // Localized text for "Play Audio"
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

      {/* Floating dropdown for categories */}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() =>
          showCategoryDropdown ? closeDropdown() : openDropdown()
        }
      >
        <Text style={styles.dropdownButtonText}>{selectedCategoryName} ▼</Text>
      </TouchableOpacity>

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

      {/* Pair Picker */}
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

      {/* Play Audio */}
      <TouchableOpacity style={styles.button} onPress={handlePlay}>
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      {/* Two answer buttons + feedback overlay */}
      <View style={styles.answerContainer}>
        <View style={styles.buttonRow}>
          {/* Left Option (word1) */}
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

          {/* Right Option (word2) */}
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

        {/* Correct / Incorrect overlay (✓ / ✗) */}
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
