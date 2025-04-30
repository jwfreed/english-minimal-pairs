// src/storage/progressStorage.ts – single‑source of truth for practice analytics
// -----------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pairProgress_v2'; // bump key to avoid legacy format clashes

/* ─── types ──────────────────────────────────────────────────────────────── */
export interface PairAttempt {
  isCorrect: boolean;
  timestamp: number; // epoch ms – MUST be present for charting
  durationMin: number; // minutes spent on this attempt (0‑based ok)
}

export interface PairStats {
  attempts: PairAttempt[];
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const safeParse = (raw: string | null) => {
  if (!raw) return {} as Record<string, PairStats>;
  try {
    return JSON.parse(raw) as Record<string, PairStats>;
  } catch {
    return {} as Record<string, PairStats>;
  }
};

/* ─── public API ──────────────────────────────────────────────────────────── */
export async function getProgress(): Promise<Record<string, PairStats>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

export async function saveAttempt(
  pairId: string,
  isCorrect: boolean,
  durationMin = 0
) {
  const progress = await getProgress();
  const stats = progress[pairId] ?? { attempts: [] };

  stats.attempts.push({
    isCorrect,
    timestamp: Date.now(),
    durationMin,
  });

  progress[pairId] = stats;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/* ─── analytics helpers used across the UI ────────────────────────────────── */

/**
 * Simple recency‑weighted accuracy.
 * Newer attempts get exponentially more weight (half‑life = 10 minutes).
 */
export function getWeightedAccuracy(attempts: PairAttempt[]): number {
  if (attempts.length === 0) return 0;
  const now = Date.now();
  const HALF_LIFE_MIN = 10; // tweak as desired

  let weightedCorrect = 0;
  let totalWeight = 0;

  attempts.forEach((a) => {
    const ageMin = (now - a.timestamp) / 60000;
    const w = Math.pow(0.5, ageMin / HALF_LIFE_MIN);
    totalWeight += w;
    if (a.isCorrect) weightedCorrect += w;
  });

  return weightedCorrect / totalWeight;
}

/**
 * Cumulative running accuracy over time – for spark‑line charting.
 * Returns values in **0‑1 range** (the chart multiplies by 100).
 */
export function getAccuracyAndTimeOverTime(
  attempts: PairAttempt[]
): { accuracy: number; timestamp: number }[] {
  if (attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  let correctSoFar = 0;

  return sorted.map((a, idx) => {
    if (a.isCorrect) correctSoFar += 1;
    return {
      accuracy: correctSoFar / (idx + 1),
      timestamp: a.timestamp,
    };
  });
}

/**
 * Sum of all attempt durations in **milliseconds** (UI divides by 60 000).
 */
export function estimateActivePracticeTime(attempts: PairAttempt[]): number {
  return attempts.reduce((sum, a) => sum + a.durationMin * 60000, 0);
}
