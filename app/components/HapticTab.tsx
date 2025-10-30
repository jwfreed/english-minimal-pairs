import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import { useHaptics } from '@/app/hooks/useHaptics';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { triggerHaptic } = useHaptics();

  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        // Add a soft haptic feedback when pressing down on the tabs
        triggerHaptic('light');
        props.onPressIn?.(ev);
      }}
    />
  );
}
