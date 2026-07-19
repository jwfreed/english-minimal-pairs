import { useAudioPlayer } from 'expo-audio';

/** Native lifecycle-managed player for the iOS silent-mode warmup. */
export function useSilentWarmupPlayer(source: number | null) {
  return useAudioPlayer(source, { keepAudioSessionActive: true });
}
