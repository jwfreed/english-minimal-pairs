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
import { addPairSession } from '../../src/storage/sessionStorage';
import { useLanguage } from '../../src/context/LanguageContext';
import { useCategory } from '../../src/context/CategoryContext';
import { useAllThemeColors } from '../../src/context/theme';
import createStyles from '../../constants/styles';
import { alternateLanguages } from '../../constants/alternateLanguages';
import { tKeys } from '../../constants/translationKeys';
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;
LogBox.ignoreLogs?.(['Warning: Grid: Support for defaultProps']);

// Cap each session at 30 seconds
const MAX_SESSION_MS = 30_000;

export default function HomeScreen() {
  // Contexts: retrieve & record progress
  const progress = useProgress();
  const recordAttempt = useRecordAttempt(); // ■ recordAttempt → saveAttempt → AsyncStorage (progressStorage)
  const { translate, language, setLanguage } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

  // Refs for audio & session timing
  const soundRefs = useRef<Audio.Sound[]>([]);
  const soundCache = useRef<Record<string, Audio.Sound>>({});
  const accumulatedMs = useRef(0);

  // Local state
  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [startTime, setStartTime] = useState<number | null>(null);

  // Dropdown state
  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Categories & pairs
  const categories = useMemo(() => minimalPairs.map((cat) => cat.category), []);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = useMemo(
    () => minimalPairs.find((c) => c.category === selectedCategoryName),
    [selectedCategoryName]
  );
  if (!catObj || catObj.pairs.length === 0)
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No pairs found</Text>
      </View>
    );

  const visiblePairs = useMemo(() => catObj.pairs.slice(0, 10), [catObj]);
  const selectedPair = visiblePairs[pairIndex];

  // Audio setup
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
    return () =>
      Object.values(soundCache.current).forEach((s) => s?.unloadAsync());
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedPair) return;
      const keys = [selectedPair.word1, selectedPair.word2];
      for (let i = 0; i < 2; i++) {
        const key = keys[i];
        if (!soundCache.current[key]) {
          const s = new Audio.Sound();
          await s.loadAsync(
            i === 0 ? selectedPair.audio1 : selectedPair.audio2
          );
          soundCache.current[key] = s;
        }
      }
      soundRefs.current = [
        soundCache.current[keys[0]],
        soundCache.current[keys[1]],
      ];
    })();
  }, [pairIndex, categoryIndex, selectedPair]);

  // Dropdown controls
  const openDropdown = useCallback(() => {
    setShowCategoryDropdown(true);
    Animated.timing(dropdownOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, []);
  const closeDropdown = useCallback(() => {
    Animated.timing(dropdownOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(({ finished }) => finished && setShowCategoryDropdown(false));
  }, []);

  // UI text
  const playAudioText =
    alternateLanguages[language]?.[tKeys.playAudio] || 'Play Audio';

  // Play button handler: accumulate prior interval and reset startTime
  const handlePlay = useCallback(async () => {
    if (startTime) accumulatedMs.current += Date.now() - startTime;
    setFeedback(null);
    setStartTime(Date.now());
    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);
    const sound = soundRefs.current[idx];
    if (!sound) return Alert.alert('Audio Error', 'Audio not ready');
    try {
      await sound.replayAsync();
    } catch {
      Alert.alert('Audio Error', 'Playback failed');
    }
  }, [startTime]);

  // Answer handler: compute, cap, record, save session, reset
  const handleAnswer = useCallback(
    async (chosenIndex: 0 | 1) => {
      if (playedWordIndex === null) return;
      const isCorrect = chosenIndex === playedWordIndex;
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      Haptics.notificationAsync(
        isCorrect
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );

      const now = Date.now();
      const lastInterval = startTime ? now - startTime : 0;
      const totalMs = accumulatedMs.current + lastInterval;
      const cappedMs = Math.min(totalMs, MAX_SESSION_MS);
      const durationMin = cappedMs / 60000;

      const pairID = `${selectedPair.word1}-${selectedPair.word2}-(${catObj.category})`;
      recordAttempt(pairID, isCorrect, durationMin);
      await addPairSession(pairID, {
        sessionId: `${pairID}-${Date.now()}`,
        startTime: now - cappedMs,
        endTime: now,
        attempts: 1,
        correct: isCorrect ? 1 : 0,
        durationMs: cappedMs,
      });

      accumulatedMs.current = 0;
      setStartTime(null);
    },
    [playedWordIndex, startTime]
  );

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
        style={{
          width: screenWidth - 48,
          color: themeColors.text,
          marginBottom: 10,
        }}
      >
        {visiblePairs.map((p, i) => {
          const label = `${p.word1} (${p.ipa1}) - ${p.word2} (${p.ipa2})`;
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
                ? { transform: [{ scale: new Animated.Value(1) }] }
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
