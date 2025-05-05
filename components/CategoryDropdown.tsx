import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { TouchableOpacity, Text, Animated, Pressable } from 'react-native';
import createStyles from '@/constants/styles';
import { useAllThemeColors } from '@/src/context/theme';

interface Props {
  /** List of category names shown in the dropdown */
  categories: string[];
  /** Zero‑based index of the currently active category */
  current: number;
  /** Callback fired when the user selects a category */
  onSelect: (index: number) => void;
}

/**
 * High‑performance dropdown for selecting minimal‑pair categories.
 * ------------------------------------------------------------------
 * • `visible` controls mounting → keeps fade‑out visible before unmount
 * • `open` controls animated opacity target
 * • All handlers/styling are memoised to avoid needless re‑renders
 * • Uses `useNativeDriver` for fluid 60 fps animations
 */
const CategoryDropdown: React.FC<Props> = React.memo(
  ({ categories, current, onSelect }) => {
    /* ─── THEME & MEMO STYLES ─────────────────────────────── */
    const theme = useAllThemeColors();
    const styles = useMemo(() => createStyles(theme), [theme]);

    /* ─── STATE & ANIMATION ───────────────────────────────── */
    const [open, setOpen] = useState(false); // controls opacity target
    const [visible, setVisible] = useState(false); // controls mounting
    const opacity = useRef(new Animated.Value(0)).current;

    /* Show dropdown when opening */
    useEffect(() => {
      if (open) setVisible(true);

      Animated.timing(opacity, {
        toValue: open ? 1 : 0,
        duration: open ? 200 : 150,
        useNativeDriver: true,
      }).start(({ finished }) => {
        // Fully remove from tree after fade‑out completes
        if (!open && finished) {
          setVisible(false);
        }
      });
    }, [open, opacity]);

    /* ─── HANDLERS ────────────────────────────────────────── */
    const toggle = useCallback(() => setOpen((prev) => !prev), []);

    const handleSelect = useCallback(
      (idx: number) => {
        if (idx !== current) onSelect(idx);
        setOpen(false); // triggers fade‑out via effect
      },
      [current, onSelect]
    );

    /* ─── RENDER ──────────────────────────────────────────── */
    return (
      <>
        {/* Anchor Button */}
        <TouchableOpacity
          style={styles.dropdownButton}
          activeOpacity={0.7}
          onPress={toggle}
        >
          <Text style={styles.dropdownButtonText}>{categories[current]} ▼</Text>
        </TouchableOpacity>

        {/* Dropdown overlay + card */}
        {visible && (
          <Pressable
            style={styles.overlay}
            onPress={toggle}
            android_disableSound
          >
            <Animated.View style={[styles.dropdownCard, { opacity }]}>
              {categories.map((cat, i) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.dropdownItem}
                  onPress={() => handleSelect(i)}
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
);

export default CategoryDropdown;
