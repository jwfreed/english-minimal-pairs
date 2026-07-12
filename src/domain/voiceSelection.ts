// Pure voice-selection policy for device TTS. No React, no expo-speech
// imports, no storage: everything here is deterministic and unit-testable.
// SettingsContext owns device I/O, persistence, and mutable rotation state.

export interface SelectableVoice {
  identifier: string;
  name: string;
  /** expo-speech VoiceQuality serializes to 'Default' | 'Enhanced'. */
  quality: string;
  language: string;
}

/** Novelty / low-quality voice name substrings excluded from the pool. */
const DEFAULT_EXCLUDED_NAMES = [
  'zarvox', 'wobble', 'whisper', 'trinoids', 'superstar', 'organ',
  'kathy', 'jester', 'good news', 'cellos', 'bubbles', 'boing',
  'bells', 'bahh', 'bad news', 'albert',
];

/** Locale+name combos excluded from the pool. */
const DEFAULT_EXCLUDED_LOCALE_NAMES: [string, string][] = [
  ['en-GB', 'sandy'],
];

function isEnhanced(voice: SelectableVoice): boolean {
  return (voice.quality ?? '').toLowerCase().includes('enhanced');
}

function isEnglish(voice: SelectableVoice): boolean {
  return voice.language.toLowerCase().startsWith('en');
}

function isUsEnglish(voice: SelectableVoice): boolean {
  return voice.language.toLowerCase() === 'en-us';
}

function isNoveltyVoice(voice: SelectableVoice): boolean {
  const lowerName = voice.name.toLowerCase();
  if (DEFAULT_EXCLUDED_NAMES.some((n) => lowerName.includes(n))) return true;
  return DEFAULT_EXCLUDED_LOCALE_NAMES.some(
    ([locale, name]) =>
      voice.language.toLowerCase() === locale.toLowerCase() &&
      lowerName.includes(name.toLowerCase())
  );
}

function compareLexical(a: SelectableVoice, b: SelectableVoice): number {
  const byLanguage = a.language.localeCompare(b.language);
  if (byLanguage !== 0) return byLanguage;
  const byName = a.name.localeCompare(b.name);
  if (byName !== 0) return byName;
  return a.identifier.localeCompare(b.identifier);
}

/** Duplicate winner: enhanced > default, en-US > other, then lexical. */
function compareDedupeWinner(a: SelectableVoice, b: SelectableVoice): number {
  const byQuality = Number(isEnhanced(b)) - Number(isEnhanced(a));
  if (byQuality !== 0) return byQuality;
  const byUs = Number(isUsEnglish(b)) - Number(isUsEnglish(a));
  if (byUs !== 0) return byUs;
  return compareLexical(a, b);
}

/** Settings-UI order (existing behavior): enhanced first, locale, name. */
function compareUiOrder(a: SelectableVoice, b: SelectableVoice): number {
  const byQuality = Number(isEnhanced(b)) - Number(isEnhanced(a));
  if (byQuality !== 0) return byQuality;
  return compareLexical(a, b);
}

/**
 * en-* filter, novelty exclusion, deterministic dedupe, UI sort.
 * Duplicate identifiers keep an input-order-independent winner
 * (enhanced > default, en-US > other locale, then lexical).
 */
export function collectEligibleVoices<V extends SelectableVoice>(
  voices: readonly V[]
): V[] {
  const eligible = voices.filter((v) => isEnglish(v) && !isNoveltyVoice(v));
  const rankedForDedupe = [...eligible].sort(compareDedupeWinner);
  const seen = new Set<string>();
  const deduped: V[] = [];
  for (const voice of rankedForDedupe) {
    if (!seen.has(voice.identifier)) {
      seen.add(voice.identifier);
      deduped.push(voice);
    }
  }
  return deduped.sort(compareUiOrder);
}

/** Active pool shown in Settings: eligible voices minus user exclusions. */
export function applyUserExclusions<V extends SelectableVoice>(
  eligible: readonly V[],
  excludedIds: ReadonlySet<string>
): V[] {
  return eligible.filter((voice) => !excludedIds.has(voice.identifier));
}

/** Rotation priority tier: lower cycles earlier. Tiers order, never gate. */
function rotationTier(voice: SelectableVoice): number {
  if (isUsEnglish(voice)) return isEnhanced(voice) ? 0 : 1;
  return isEnhanced(voice) ? 2 : 3;
}

/**
 * Prioritized rotation pool. Contains every voice from the input — defaults
 * are never discarded because enhanced voices exist. Order:
 *   1. en-US enhanced  2. en-US default  3. other en-* enhanced
 *   4. other en-* default; lexical tie-break within a tier.
 * Empty input returns [] (callers fall back to the system default voice).
 */
export function buildVoiceRotationPool<V extends SelectableVoice>(
  pool: readonly V[]
): V[] {
  return [...pool].sort((a, b) => {
    const byTier = rotationTier(a) - rotationTier(b);
    if (byTier !== 0) return byTier;
    return compareLexical(a, b);
  });
}

/**
 * Reset/clamp the rotation index against the current pool. If the pool's
 * identifier sequence changed in any way, restart at 0; otherwise keep the
 * previous index (clamped into range as a corruption guard).
 */
export function resolveRotationIndex(
  previousPoolIds: readonly string[],
  previousIndex: number,
  currentPool: readonly SelectableVoice[]
): number {
  const samePool =
    previousPoolIds.length === currentPool.length &&
    currentPool.every((voice, i) => voice.identifier === previousPoolIds[i]);
  if (!samePool) return 0;
  if (!Number.isInteger(previousIndex)) return 0;
  if (previousIndex < 0 || previousIndex >= currentPool.length) return 0;
  return previousIndex;
}

/** Advance round-robin: (index + 1) mod poolLength; 0 for empty pools. */
export function advanceRotationIndex(index: number, poolLength: number): number {
  if (poolLength <= 0) return 0;
  return (index + 1) % poolLength;
}
