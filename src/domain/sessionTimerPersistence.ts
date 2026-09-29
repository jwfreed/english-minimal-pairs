export const SESSION_TIMER_STORAGE_KEY = '@sessionTimer';
export const SESSION_TIMER_CUMULATIVE_STORAGE_KEY = '@sessionTimerCumulative';

interface StoredSessionTimer {
  date?: unknown;
  seconds?: unknown;
}

/**
 * The practice day is the device's local calendar day (YYYY-MM-DD). UTC dates
 * are never used for day boundaries.
 */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDefaultSessionTimerSeconds(): number {
  return 0;
}

export function getDefaultCumulativeTimerSeconds(): number {
  return 0;
}

export function normalizeTimerSeconds(value: unknown, fallback = 0): number {
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  ) {
    return value;
  }
  return fallback;
}

function isStoredSessionTimer(value: unknown): value is StoredSessionTimer {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseStoredSessionTimerSeconds(
  raw: string | null,
  currentDate: string,
  fallback = getDefaultSessionTimerSeconds()
): number {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw);
    if (!isStoredSessionTimer(parsed) || parsed.date !== currentDate) {
      return fallback;
    }
    return normalizeTimerSeconds(parsed.seconds, fallback);
  } catch {
    return fallback;
  }
}

export function parseStoredCumulativeTimerSeconds(
  raw: string | null,
  fallback = getDefaultCumulativeTimerSeconds()
): number {
  if (!raw) return fallback;

  try {
    return normalizeTimerSeconds(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function serializeSessionTimerSeconds(date: string, seconds: number): string {
  return JSON.stringify({ date, seconds: normalizeTimerSeconds(seconds) });
}

export function serializeCumulativeTimerSeconds(seconds: number): string {
  return JSON.stringify(normalizeTimerSeconds(seconds));
}
