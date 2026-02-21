// components/SessionTimer.tsx
// -----------------------------------------------------------------------------
// Tracks active practice time for the current session using AppState to detect
// foreground / background transitions. Persists today's total to AsyncStorage.
// Renders a compact bar showing elapsed time and daily goal progress.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';

const SESSION_KEY = '@sessionTimer';
const DAILY_GOAL_MINUTES = 15;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionTimer() {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [elapsedToday, setElapsedToday] = useState(0); // total seconds for today
  const sessionStartRef = useRef(Date.now());
  const savedBaseRef = useRef(0); // seconds already saved from previous sessions today

  // Load persisted time for today on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          if (data.date === todayKey()) {
            savedBaseRef.current = data.seconds ?? 0;
            setElapsedToday(data.seconds ?? 0);
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Tick every second while app is active
  useEffect(() => {
    sessionStartRef.current = Date.now();
    const interval = setInterval(() => {
      const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      setElapsedToday(savedBaseRef.current + sessionSec);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist when app goes to background or unmounts
  const persist = useCallback(async () => {
    const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    const total = savedBaseRef.current + sessionSec;
    try {
      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ date: todayKey(), seconds: total })
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        persist();
        // When coming back, reset the session clock
      } else if (state === 'active') {
        // Reload in case date rolled over
        (async () => {
          try {
            const raw = await AsyncStorage.getItem(SESSION_KEY);
            if (raw) {
              const data = JSON.parse(raw);
              if (data.date === todayKey()) {
                savedBaseRef.current = data.seconds ?? 0;
              } else {
                savedBaseRef.current = 0;
              }
            } else {
              savedBaseRef.current = 0;
            }
          } catch {
            savedBaseRef.current = 0;
          }
          sessionStartRef.current = Date.now();
        })();
      }
    });
    return () => {
      persist();
      sub.remove();
    };
  }, [persist]);

  const goalSeconds = DAILY_GOAL_MINUTES * 60;
  const progress = Math.min(elapsedToday / goalSeconds, 1);

  return (
    <View style={styles.sessionTimerContainer}>
      <View style={styles.sessionTimerRow}>
        <Text style={styles.sessionTimerText}>
          {formatTime(elapsedToday)}
        </Text>
        <Text style={styles.sessionTimerGoal}>
          / {DAILY_GOAL_MINUTES}:00
        </Text>
      </View>
      <View style={styles.sessionTimerBarBg}>
        <View
          style={[
            styles.sessionTimerBarFill,
            { width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}
