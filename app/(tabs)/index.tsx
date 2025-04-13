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
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { minimalPairs } from '../../constants/minimalPairs';
import {
  useProgress,
  useRecordAttempt,
} from '../../src/context/PairProgressContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { useCategory } from '../../src/context/CategoryContext';
import { useAllThemeColors } from '../../src/context/theme';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';
import { tKeys } from '../../constants/translationKeys';

LogBox.ignoreLogs?.(['Warning: Grid: Support for defaultProps']);

export default function HomeScreen() {
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();
  const { translate, language, setLanguage } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

  const categories = useMemo(() => minimalPairs.map((cat) => cat.category), []);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = useMemo(
    () => minimalPairs.find((cat) => cat.category === selectedCategoryName),
    [selectedCategoryName]
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

  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [startTime, setStartTime] = useState<number | null>(null);

  const correctButtonScale = useRef(new Animated.Value(1)).current;
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const soundRefs = useRef<Audio.Sound[]>([]);
  const soundCache = useRef<Record<string, Audio.Sound>>({});

  useEffect(() => {
    setLanguage(categories[categoryIndex]);
  }, [categoryIndex, categories, setLanguage]);

  const pairsInCategory = useMemo(() => catObj.pairs, [catObj]);
  const visiblePairs = useMemo(
    () => pairsInCategory.slice(0, 10),
    [pairsInCategory]
  );
  const selectedPair = useMemo(
    () => visiblePairs[pairIndex],
    [visiblePairs, pairIndex]
  );

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
      Object.values(soundCache.current).forEach((sound) =>
        sound?.unloadAsync()
      );
    };
  }, []);

  useEffect(() => {
    const preloadAudio = async () => {
      if (!selectedPair) return;
      try {
        const keys = [`${selectedPair.word1}`, `${selectedPair.word2}`];
        for (let i = 0; i < 2; i++) {
          const key = keys[i];
          if (!soundCache.current[key]) {
            const sound = new Audio.Sound();
            await sound.loadAsync(
              i === 0 ? selectedPair.audio1 : selectedPair.audio2
            );
            soundCache.current[key] = sound;
          }
        }
        soundRefs.current = [
          soundCache.current[keys[0]],
          soundCache.current[keys[1]],
        ];
      } catch (e) {
        console.warn('Failed to preload audio', e);
      }
    };

    preloadAudio();
  }, [pairIndex, categoryIndex, selectedPair]);

  const handlePlay = useCallback(async () => {
    setFeedback(null);
    setStartTime(Date.now());
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    try {
      await soundRefs.current[idx]?.replayAsync();
    } catch (err) {
      console.error('Error playing audio:', err);
      Alert.alert('Audio Error', 'Failed to play audio. Try again.');
    }
  }, []);

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

  const playAudioText =
    alternateLanguages[language]?.[tKeys.playAudio] || 'Play Audio';

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Text style={styles.title}>{translate(tKeys.practicePairs)}</Text>

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

      <Picker
        selectedValue={String(pairIndex)}
        onValueChange={(val) => {
          setPairIndex(Number(val));
          setFeedback(null);
        }}
        style={{ width: 250, color: themeColors.text, marginBottom: 10 }}
      >
        {visiblePairs.map((p, i) => {
          const label = `${p.word1} - ${p.word2}`;
          return <Picker.Item key={label} label={label} value={String(i)} />;
        })}
      </Picker>

      <TouchableOpacity style={styles.button} onPress={handlePlay}>
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      <View style={styles.answerContainer}>
        <View style={styles.buttonRow}>
          {[0, 1].map((idx) => {
            const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;
            const ipa = idx === 0 ? selectedPair.ipa1 : selectedPair.ipa2;
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
                  <Text style={styles.ipaText}>{ipa}</Text>
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
