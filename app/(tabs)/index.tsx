import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  Easing,
  LogBox,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { minimalPairs } from '../../constants/minimalPairs';
import {
  useProgress,
  useRecordAttempt,
} from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
// Import our consolidated theme hook:
import { useAllThemeColors } from '../../src/context/theme';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';

// Move LogBox config outside the component to avoid re-running it on each render
LogBox.ignoreLogs?.(['Warning: Grid: Support for defaultProps']);

export default function HomeScreen() {
  // Global context values
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();
  const { setLanguage, t, categoryIndex, setCategoryIndex, language } =
    useLanguageScheme();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

  // Memoized categories and current category object
  const categories = useMemo(() => minimalPairs.map((cat) => cat.category), []);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = useMemo(
    () => minimalPairs.find((cat) => cat.category === selectedCategoryName),
    [selectedCategoryName]
  );

  // Early return if no pairs are available
  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text
          style={styles.title}
        >{`No pairs found for ${selectedCategoryName}`}</Text>
      </View>
    );
  }

  // Local state for quiz logic
  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [startTime, setStartTime] = useState<number | null>(null);

  // Animation refs for correct answer feedback and dropdown opacity
  const correctButtonScale = useRef(new Animated.Value(1)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Audio: use one ref to store both preloaded audio sounds
  const soundRefs = useRef<Audio.Sound[]>([]);

  // Update language context when the category changes
  useEffect(() => {
    setLanguage(categories[categoryIndex]);
  }, [categoryIndex, categories, setLanguage]);

  // Extract active pairs from the selected category; memoize for performance
  const pairsInCategory = useMemo(() => catObj.pairs, [catObj]);
  const selectedPair = useMemo(
    () => pairsInCategory[pairIndex],
    [pairsInCategory, pairIndex]
  );

  // Configure audio mode on mount and clean up on unmount
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
      soundRefs.current.forEach((sound) => sound?.unloadAsync());
    };
  }, []);

  // Preload audio when the active pair changes
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
        soundRefs.current = [sound1, sound2];
      } catch (e) {
        console.warn('Failed to preload audio', e);
      }
    };

    preloadAudio();

    return () => {
      sound1?.unloadAsync();
      sound2?.unloadAsync();
    };
  }, [pairIndex, categoryIndex, selectedPair]);

  // Play a random word from the selected pair; time the attempt
  const handlePlay = useCallback(async () => {
    setFeedback(null);
    setStartTime(Date.now());
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    try {
      await soundRefs.current[idx]?.replayAsync();
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  }, []);

  // Animation for correct answer "pop" effect
  const popAnimation = useCallback(() => {
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
  }, [correctButtonScale]);

  // Handler for when the user selects an answer
  const handleAnswer = useCallback(
    (chosenIndex: 0 | 1) => {
      if (playedWordIndex === null) return;
      const isCorrect = chosenIndex === playedWordIndex;
      setFeedback(isCorrect ? 'correct' : 'incorrect');

      if (isCorrect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        popAnimation();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Use memoized values for pair ID and compute duration
      const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;
      const msElapsed = startTime ? Date.now() - startTime : 0;
      const durationMin = msElapsed / 60000;
      recordAttempt(pairID, isCorrect, durationMin);
    },
    [
      playedWordIndex,
      popAnimation,
      selectedPair,
      catObj,
      startTime,
      recordAttempt,
    ]
  );

  // Handlers for opening/closing the floating category dropdown
  const openDropdown = useCallback(() => {
    setShowCategoryDropdown(true);
    Animated.timing(dropdownOpacity, {
      toValue: 1,
      duration: 200,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [dropdownOpacity]);

  const closeDropdown = useCallback(() => {
    Animated.timing(dropdownOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => finished && setShowCategoryDropdown(false));
  }, [dropdownOpacity]);

  // Localized text for the Play Audio button
  const playAudioText = alternateLanguages[language]?.playAudio || 'Play Audio';

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

      {/* Play Audio Button */}
      <TouchableOpacity style={styles.button} onPress={handlePlay}>
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      {/* Answer Buttons and Feedback */}
      <View style={styles.answerContainer}>
        <View style={styles.buttonRow}>
          {[0, 1].map((idx) => {
            const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;
            const animatedStyle =
              playedWordIndex === idx && feedback === 'correct'
                ? { transform: [{ scale: correctButtonScale }] }
                : {};
            return (
              <Animated.View style={animatedStyle} key={idx}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => handleAnswer(idx as 0 | 1)}
                >
                  <Text style={styles.buttonText}>{word}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
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
