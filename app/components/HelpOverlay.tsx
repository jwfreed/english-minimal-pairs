import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import createStyles from '@/app/constants/styles';
import { useAllThemeColors } from '@/app/context/theme';
import { ThemedText } from '@/app/components/ThemedText';
import { ThemedView } from '@/app/components/ThemedView';

interface HelpOverlayProps {
  visible: boolean;
  onClose: () => void;
}

const TIPS = [
  'Practice each pair for about 60 minutes',
  'Speed increases as you level up',
  'Focus on hearing the sound difference',
];

export default function HelpOverlay({ visible, onClose }: HelpOverlayProps) {
  const theme = useAllThemeColors();
  const sharedStyles = useMemo(() => createStyles(theme), [theme]);
  const styles = useMemo(() => createHelpOverlayStyles(theme), [theme]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close help"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.cardContainer}>
          <ThemedView
            accessible
            accessibilityLabel="How to practice help"
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            style={styles.card}
          >
            <ThemedText style={styles.title} type="subtitle">
              How to practice
            </ThemedText>

            <ThemedText style={styles.body}>
              Listen to the word and tap what you hear.
            </ThemedText>

            <View style={styles.tipsSection}>
              <ThemedText style={styles.tipsHeading} type="defaultSemiBold">
                Tips
              </ThemedText>

              {TIPS.map((tip) => (
                <View key={tip} style={styles.tipRow}>
                  <ThemedText style={styles.bullet}>•</ThemedText>
                  <ThemedText style={styles.tipText}>{tip}</ThemedText>
                </View>
              ))}
            </View>

            <TouchableOpacity
              accessibilityLabel="Got it"
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={onClose}
              style={[sharedStyles.button, styles.button]}
            >
              <Text style={sharedStyles.buttonText}>Got it</Text>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </View>
    </Modal>
  );
}

const createHelpOverlayStyles = (theme: ReturnType<typeof useAllThemeColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    cardContainer: {
      width: '100%',
      alignItems: 'center',
    },
    card: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 24,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 8,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      marginBottom: 12,
      color: theme.text,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.text,
    },
    tipsSection: {
      marginTop: 20,
      gap: 10,
    },
    tipsHeading: {
      color: theme.text,
    },
    tipRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bullet: {
      width: 18,
      lineHeight: 24,
      color: theme.text,
    },
    tipText: {
      flex: 1,
      color: theme.text,
    },
    button: {
      marginTop: 24,
      marginBottom: 0,
      maxWidth: '100%',
    },
  });