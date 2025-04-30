import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Animated,
  Pressable,
} from 'react-native';
import createStyles from '@/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';

interface Props {
  categories: string[];
  current: number;
  onSelect: (index: number) => void;
}

export default function CategoryDropdown({
  categories,
  current,
  onSelect,
}: Props) {
  const theme = useAllThemeColors();
  const styles = createStyles(theme);
  const [open, setOpen] = React.useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;

  const toggle = () => {
    if (open) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => setOpen(false));
    } else {
      setOpen(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.dropdownButton} onPress={toggle}>
        <Text style={styles.dropdownButtonText}>{categories[current]} ▼</Text>
      </TouchableOpacity>

      {open && (
        <Pressable style={styles.overlay} onPress={toggle}>
          <Animated.View style={[styles.dropdownCard, { opacity }]}>
            {categories.map((cat, i) => (
              <TouchableOpacity
                key={cat}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(i);
                  toggle();
                }}
              >
                <Text style={styles.dropdownItemText}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </Pressable>
      )}
    </>
  );
}
