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
