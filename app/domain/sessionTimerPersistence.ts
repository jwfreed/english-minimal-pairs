export const SESSION_TIMER_STORAGE_KEY = '@sessionTimer';
export const SESSION_TIMER_CUMULATIVE_STORAGE_KEY = '@sessionTimerCumulative';

interface StoredSessionTimer {
  date?: unknown;
  seconds?: unknown;
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
