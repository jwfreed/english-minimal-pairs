// components/SessionTimer.tsx
// -----------------------------------------------------------------------------
// Tracks active practice time for the current session using AppState to detect
// foreground / background transitions.  Automatically pauses after IDLE_TIMEOUT
// seconds of no user interaction and resumes on the next touch / play / answer.
// Persists today's total to AsyncStorage.
// -----------------------------------------------------------------------------
import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, AppState, AppStateStatus } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStyles } from '@/src/hooks/useAppStyles';
import {
  barFillTransition,
  goalBarPulseAnimation,
  liveDotAnimation,
} from '@/src/constants/motion';
import {
  SESSION_TIMER_CUMULATIVE_STORAGE_KEY,
  SESSION_TIMER_STORAGE_KEY,
  localDayKey,
  parseStoredCumulativeTimerSeconds,
  parseStoredSessionTimerSeconds,
  serializeCumulativeTimerSeconds,
  serializeSessionTimerSeconds,
} from '@/src/domain/sessionTimerPersistence';

const DAILY_GOAL_MINUTES = 15;
/** Pause the timer after this many seconds of inactivity */
const IDLE_TIMEOUT_SEC = 120; // 2 minutes
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_SEC * 1000;

/**
 * The most recent daily total this process wrote. A remount reads storage
 * before a just-unmounted timer's write may have landed; taking the larger
 * value keeps the day's total from moving backward.
 */
let latestPersistedDay: { day: string; seconds: number } | null = null;

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
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Briefly emphasize the truthful goal progress without changing its value. */
  highlightProgress?: boolean;
}

export default function SessionTimer({
  timerRef,
  leading,
  trailing,
  highlightProgress = false,
}: Props) {
  const styles = useAppStyles();
  const reduceMotion = useReducedMotion();

  const [elapsedToday, setElapsedToday] = useState(0);
  // Today's practice seconds: the persisted base for the current local day,
  // plus completed counting windows this mount, plus the open window.
  const dayRef = useRef(localDayKey(new Date()));
  const savedBaseRef = useRef(0);
  const accumulatedRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const cumulativeBaseRef = useRef(0);
  const lastPersistedTodayRef = useRef(0);

  // A counting window stays active until IDLE_TIMEOUT after the last activity
  // — exactly what the display counts — so pausing never takes time back.
  const openWindowSec = useCallback((now: number) => {
    if (pausedRef.current) return 0;
    const activeUntil = Math.min(now, lastActivityRef.current + IDLE_TIMEOUT_MS);
    return Math.max(0, Math.floor((activeUntil - sessionStartRef.current) / 1000));
  }, []);

  const todayTotal = useCallback(
    (now: number) =>
      savedBaseRef.current + accumulatedRef.current + openWindowSec(now),
    [openWindowSec]
  );

  const pauseAt = useCallback(
    (now: number) => {
      accumulatedRef.current += openWindowSec(now);
      pausedRef.current = true;
    },
    [openWindowSec]
  );

  const persistDay = useCallback(async (day: string, total: number) => {
    // Within one day the recorded total never decreases.
    const seconds = Math.max(
      total,
      latestPersistedDay?.day === day ? latestPersistedDay.seconds : 0
    );
    latestPersistedDay = { day, seconds };
    const delta = seconds - lastPersistedTodayRef.current;
    lastPersistedTodayRef.current = seconds;
    try {
      await AsyncStorage.setItem(
        SESSION_TIMER_STORAGE_KEY,
        serializeSessionTimerSeconds(day, seconds)
      );
      if (delta > 0) {
        cumulativeBaseRef.current += delta;
        await AsyncStorage.setItem(
          SESSION_TIMER_CUMULATIVE_STORAGE_KEY,
          serializeCumulativeTimerSeconds(cumulativeBaseRef.current)
        );
      }
    } catch {
      // ignore
    }
  }, []);

  /** Applies idle pausing and local-midnight rollover as of `now`. */
  const settle = useCallback(
    (now: number) => {
      if (!pausedRef.current && now - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
        pauseAt(now);
      }
      const day = localDayKey(new Date(now));
      if (day !== dayRef.current) {
        // Close out the previous day, then start the new day from zero.
        void persistDay(dayRef.current, todayTotal(now));
        dayRef.current = day;
        savedBaseRef.current = 0;
        accumulatedRef.current = 0;
        lastPersistedTodayRef.current = 0;
        sessionStartRef.current = now;
      }
    },
    [pauseAt, persistDay, todayTotal]
  );

  // Expose poke() so the parent can signal activity
  const poke = useCallback(() => {
    const now = Date.now();
    settle(now);
    lastActivityRef.current = now;
    if (pausedRef.current) {
      // Resume: start a new counting window from now
      pausedRef.current = false;
      sessionStartRef.current = now;
    }
  }, [settle]);

  useEffect(() => {
    if (timerRef) timerRef.current = { poke };
  }, [timerRef, poke]);

  // Load persisted time for today on mount
  useEffect(() => {
    const day = dayRef.current;
    (async () => {
      try {
        const stored = parseStoredSessionTimerSeconds(
          await AsyncStorage.getItem(SESSION_TIMER_STORAGE_KEY),
          day
        );
        // A write from a just-unmounted timer may not have landed yet.
        const todaySeconds = Math.max(
          stored,
          latestPersistedDay?.day === day ? latestPersistedDay.seconds : 0
        );
        cumulativeBaseRef.current = parseStoredCumulativeTimerSeconds(
          await AsyncStorage.getItem(SESSION_TIMER_CUMULATIVE_STORAGE_KEY)
        );
        if (dayRef.current !== day) return;
        savedBaseRef.current = todaySeconds;
        lastPersistedTodayRef.current = todaySeconds;
        setElapsedToday(todayTotal(Date.now()));
      } catch {
        // ignore
      }
    })();
  }, [todayTotal]);

  // Tick every second, respecting the idle timeout and local midnight
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      settle(now);
      setElapsedToday(todayTotal(now));
    }, 1000);
    return () => clearInterval(interval);
  }, [settle, todayTotal]);

  // Persist helper
  const persist = useCallback(async () => {
    const now = Date.now();
    settle(now);
    await persistDay(dayRef.current, todayTotal(now));
  }, [persistDay, settle, todayTotal]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const now = Date.now();
      if (state === 'background' || state === 'inactive') {
        // In-memory time stays authoritative for the day; no reload on return.
        settle(now);
        if (!pausedRef.current) pauseAt(now);
        void persist();
      } else if (state === 'active') {
        settle(now);
        lastActivityRef.current = now;
        if (pausedRef.current) {
          pausedRef.current = false;
          sessionStartRef.current = now;
        }
        setElapsedToday(todayTotal(now));
      }
    });
    return () => {
      persist();
      sub.remove();
    };
  }, [pauseAt, persist, settle, todayTotal]);

  const goalSeconds = DAILY_GOAL_MINUTES * 60;
  const progress = Math.min(elapsedToday / goalSeconds, 1);

  return (
    <View style={styles.sessionTimerContainer}>
      <View style={styles.practiceHeaderTopRow}>
        {leading}
        <View style={styles.practiceHeaderActions}>
          <View style={styles.sessionTimerRow}>
            <Reanimated.View
              style={[styles.sessionTimerDot, !reduceMotion && liveDotAnimation]}
            />
            <Text style={styles.sessionTimerText}>
              {formatTime(elapsedToday)}
            </Text>
            <Text style={styles.sessionTimerGoal}>
              / {DAILY_GOAL_MINUTES}:00{pausedRef.current ? '  ⏸' : ''}
            </Text>
          </View>
          {trailing}
        </View>
      </View>
      <Reanimated.View
        style={[
          styles.sessionTimerBarBg,
          highlightProgress && !reduceMotion && goalBarPulseAnimation,
        ]}
      >
        <Reanimated.View
          style={[
            styles.sessionTimerBarFill,
            { width: `${Math.round(progress * 100)}%` },
            !reduceMotion && barFillTransition,
          ]}
        />
      </Reanimated.View>
    </View>
  );
}
