// components/SessionTimer.tsx
// -----------------------------------------------------------------------------
// Tracks active practice time for the current session using AppState to detect
// foreground / background transitions.  Automatically pauses after IDLE_TIMEOUT
// seconds of no user interaction and resumes on the next touch / play / answer.
// Persists today's total to AsyncStorage.
// -----------------------------------------------------------------------------
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createStyles from '@/src/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';
import {
  SESSION_TIMER_CUMULATIVE_STORAGE_KEY,
  SESSION_TIMER_STORAGE_KEY,
  parseStoredCumulativeTimerSeconds,
  parseStoredSessionTimerSeconds,
  serializeCumulativeTimerSeconds,
  serializeSessionTimerSeconds,
} from '@/src/domain/sessionTimerPersistence';

const DAILY_GOAL_MINUTES = 15;
/** Pause the timer after this many seconds of inactivity */
const IDLE_TIMEOUT_SEC = 120; // 2 minutes

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface SessionTimerHandle {
  /** Call this from the parent whenever the user does something (play, answer, scroll). */
  poke: () => void;
}

/** Read the cumulative all-time practice seconds from AsyncStorage. */
export async function getCumulativeSeconds(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_TIMER_CUMULATIVE_STORAGE_KEY);
    return parseStoredCumulativeTimerSeconds(raw);
  } catch {
    // ignore
  }
  return 0;
}

interface Props {
  /** Optional ref so the parent can call poke() */
  timerRef?: React.MutableRefObject<SessionTimerHandle | null>;
}

export default function SessionTimer({ timerRef }: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [elapsedToday, setElapsedToday] = useState(0);
  const sessionStartRef = useRef(Date.now());
  const savedBaseRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const pausedRef = useRef(false);
  /** Accumulated seconds before the timer was paused */
  const accumulatedRef = useRef(0);

  // Expose poke() so the parent can signal activity
  const poke = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (pausedRef.current) {
      // Resume: start a new counting window from now
      pausedRef.current = false;
      sessionStartRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    if (timerRef) timerRef.current = { poke };
  }, [timerRef, poke]);

  // Track cumulative total loaded at mount
  const cumulativeBaseRef = useRef(0);
  const lastPersistedTodayRef = useRef(0);

  // Load persisted time for today on mount
  useEffect(() => {
    (async () => {
      try {
        const todaySeconds = parseStoredSessionTimerSeconds(
          await AsyncStorage.getItem(SESSION_TIMER_STORAGE_KEY),
          todayKey()
        );
        savedBaseRef.current = todaySeconds;
        lastPersistedTodayRef.current = todaySeconds;
        accumulatedRef.current = 0;
        setElapsedToday(todaySeconds);

        // Load cumulative total
        cumulativeBaseRef.current = parseStoredCumulativeTimerSeconds(
          await AsyncStorage.getItem(SESSION_TIMER_CUMULATIVE_STORAGE_KEY)
        );
      } catch {
        // ignore
      }
    })();
  }, []);

  // Tick every second, but respect idle timeout
  useEffect(() => {
    sessionStartRef.current = Date.now();
    accumulatedRef.current = 0;
    pausedRef.current = false;

    const interval = setInterval(() => {
      if (pausedRef.current) return; // already paused – skip tick

      const now = Date.now();
      const idleSec = (now - lastActivityRef.current) / 1000;

      if (idleSec >= IDLE_TIMEOUT_SEC) {
        // Freeze: save the time accrued up to the last activity moment
        const activeSec = Math.floor((lastActivityRef.current - sessionStartRef.current) / 1000);
        accumulatedRef.current += Math.max(activeSec, 0);
        pausedRef.current = true;
        // Update display one last time with frozen total
        setElapsedToday(savedBaseRef.current + accumulatedRef.current);
        return;
      }

      const sessionSec = Math.floor((now - sessionStartRef.current) / 1000);
      setElapsedToday(savedBaseRef.current + accumulatedRef.current + sessionSec);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist helper
  const persist = useCallback(async () => {
    let total: number;
    if (pausedRef.current) {
      total = savedBaseRef.current + accumulatedRef.current;
    } else {
      const sessionSec = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      total = savedBaseRef.current + accumulatedRef.current + sessionSec;
    }
    try {
      // Daily
      await AsyncStorage.setItem(
        SESSION_TIMER_STORAGE_KEY,
        serializeSessionTimerSeconds(todayKey(), total)
      );
      // Cumulative: base + delta since last persist
      const delta = total - lastPersistedTodayRef.current;
      if (delta > 0) {
        const newCumulative = cumulativeBaseRef.current + delta;
        cumulativeBaseRef.current = newCumulative;
        lastPersistedTodayRef.current = total;
        await AsyncStorage.setItem(
          SESSION_TIMER_CUMULATIVE_STORAGE_KEY,
          serializeCumulativeTimerSeconds(newCumulative)
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        persist();
      } else if (state === 'active') {
        // Reload in case date rolled over
        (async () => {
          try {
            savedBaseRef.current = parseStoredSessionTimerSeconds(
              await AsyncStorage.getItem(SESSION_TIMER_STORAGE_KEY),
              todayKey()
            );
          } catch {
            savedBaseRef.current = 0;
          }
          accumulatedRef.current = 0;
          sessionStartRef.current = Date.now();
          lastActivityRef.current = Date.now();
          pausedRef.current = false;
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
          / {DAILY_GOAL_MINUTES}:00{pausedRef.current ? '  ⏸' : ''}
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
