const webSilentWarmupPlayer = {
  play() {},
};

/**
 * The silent warmup is iOS-only. Avoid constructing expo-audio's web player,
 * which requires the browser Audio API and cannot render during static export.
 */
export function useSilentWarmupPlayer(_source: number | null) {
  return webSilentWarmupPlayer;
}
