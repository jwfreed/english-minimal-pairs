// -----------------------------------------------------------------------------
// Custom hook for triggering haptic feedback throughout the app
// -----------------------------------------------------------------------------
import { useCallback, useRef, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useSettings } from '@/src/context/SettingsContext';

export type HapticType = 
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'warning'
  | 'error'
  | 'selection';

export const useHaptics = () => {
  const { hapticsEnabled } = useSettings();
  const enabledRef = useRef(hapticsEnabled);

  useEffect(() => {
    enabledRef.current = hapticsEnabled;
  }, [hapticsEnabled]);

  const triggerHaptic = useCallback(
    async (type: HapticType = 'light') => {
      // Only trigger haptics if enabled and on a supported platform
      if (!enabledRef.current || Platform.OS === 'web') {
        return;
      }

      try {
        switch (type) {
          case 'light':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case 'medium':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case 'heavy':
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case 'success':
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            break;
          case 'warning':
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
            break;
          case 'error':
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            );
            break;
          case 'selection':
            await Haptics.selectionAsync();
            break;
          default:
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        // Silently fail if haptics aren't supported
        if (__DEV__) {
          console.warn('Haptic feedback failed:', error);
        }
      }
    },
    []
  );

  return { triggerHaptic, hapticsEnabled };
};
