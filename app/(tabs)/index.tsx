// app/(tabs)/index.tsx   ← full patched file
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
  Dimensions,
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

const { width: screenWidth } = Dimensions.get('window');
LogBox.ignoreLogs?.(['Warning: Grid: Support for defaultProps']);

const MAX_SESSION_MS = 30_000;

/* ★ playback-rate table per difficulty tier */
const PLAYBACK_RATES: Record<1 | 2 | 3 | 4, number> = {
  1: 0.8, // easy  – slower
  2: 1.0, // medium – normal
  3: 1.1, // hard   – slightly faster
  4: 1.2, // v-hard – fastest
};

export default function HomeScreen() {
  /* ─── Context & theme ───────────────────────────────────── */
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();
  const { translate, language } = useLanguage();
  const { categoryIndex, setCategoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

  /* ─── Refs & local state ───────────────────────────────── */
  const soundRefs = useRef<Audio.Sound[]>([]);
  const soundCache = useRef<Record<string, Audio.Sound>>({});
  const accumulatedMs = useRef(0);

  const [pairIndex, setPairIndex] = useState(0);
  const [playedWordIndex, setPlayedWordIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null
  );
  const [startTime, setStartTime] = useState<number | null>(null);

  const dropdownOpacity = useRef(new Animated.Value(0)).current;
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  /* ★ difficulty tier state (manual for now) */
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4>(1);

  /* ─── Categories & pair selection ───────────────────────── */
  const categories = useMemo(() => minimalPairs.map((c) => c.category), []);
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

  /* ─── Filter list by difficulty ───────────────────────────── */
  const visiblePairs = useMemo(() => {
    return catObj.pairs
      .filter((p) => p.difficulty === difficulty) // keep only this tier
      .slice(0, 10); // cap to 10 for the picker
  }, [catObj, difficulty]);

  /* 🚦 If nothing matches this tier, show a placeholder instead of crashing */
  if (visiblePairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          {`No pairs recorded for difficulty ${difficulty}.`}
        </Text>
      </View>
    );
  }

  const selectedPair = visiblePairs[pairIndex];

  /* ─── Audio mode & preloading ───────────────────────────── */
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
  }, [selectedPair]);

  /* ─── Dropdown helpers ─────────────────────────────────── */
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

  /* ─── UI labels ─────────────────────────────────────────── */
  const playAudioText =
    alternateLanguages[language]?.[tKeys.playAudio] || 'Play Audio';

  /* ─── Play audio ───────────────────────────────────────── */
  const handlePlay = useCallback(async () => {
    if (startTime) accumulatedMs.current += Date.now() - startTime;
    setFeedback(null);
    setStartTime(Date.now());

    const idx = Math.random() < 0.5 ? 0 : 1;
    setPlayedWordIndex(idx);

    const sound = soundRefs.current[idx];
    if (!sound) return Alert.alert('Audio Error', 'Audio not ready');

    try {
      /* ★ set playback rate per difficulty */
      await sound.setRateAsync(PLAYBACK_RATES[difficulty], true);
      await sound.replayAsync();
    } catch {
      Alert.alert('Audio Error', 'Playback failed');
    }
  }, [startTime, difficulty]);

  /* ─── Answer handler ───────────────────────────────────── */
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

  /* ─── Reset pair index on category/difficulty change ───── */
  useEffect(() => {
    setPairIndex(0);
  }, [categoryIndex, difficulty]);
  useEffect(() => {
    if (pairIndex >= visiblePairs.length) {
      setPairIndex(0);
    }
  }, [visiblePairs.length, pairIndex]);

  /* ─── Render ───────────────────────────────────────────── */
  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Text style={styles.title}>{translate(tKeys.practicePairs)}</Text>

      {/* Category dropdown toggle */}
      <TouchableOpacity
        style={styles.dropdownButton}
        onPress={() =>
          showCategoryDropdown ? closeDropdown() : openDropdown()
        }
      >
        <Text style={styles.dropdownButtonText}>{selectedCategoryName} ▼</Text>
      </TouchableOpacity>

      {/* Floating dropdown */}
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

      {/* ★ Difficulty tier buttons (temp for testing) */}
      <View style={{ flexDirection: 'row', marginVertical: 6 }}>
        {[1, 2, 3, 4].map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.button,
              { marginHorizontal: 2 },
              difficulty === t && { opacity: 0.7 },
            ]}
            onPress={() => setDifficulty(t as 1 | 2 | 3 | 4)}
          >
            <Text style={styles.buttonText}>
              {['Easy', 'Med', 'Hard', 'V-Hard'][t - 1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pair picker */}
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

      {/* Play button */}
      <TouchableOpacity style={styles.button} onPress={handlePlay}>
        <Text style={styles.buttonText}>{playAudioText}</Text>
      </TouchableOpacity>

      {/* Answer buttons */}
      <View style={styles.answerContainer}>
        <View style={styles.buttonRow}>
          {[0, 1].map((idx) => {
            const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;
            const ipa = idx === 0 ? selectedPair.ipa1 : selectedPair.ipa2;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.button}
                onPress={() => handleAnswer(idx as 0 | 1)}
              >
                <Text style={styles.buttonText}>{word}</Text>
                <Text style={styles.ipaText}>{ipa}</Text>
              </TouchableOpacity>
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
