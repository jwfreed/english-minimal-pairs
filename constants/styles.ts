import { StyleSheet } from 'react-native';

/**
 * ThemeColors Interface
 *
 * Represents the color properties needed by your theme.
 */
interface ThemeColors {
  background: string;
  text: string;
  success: string;
  error: string;
  primary: string;
  buttonText: string;
  cardBackground?: string;
  shadow?: string;
}

const createStyles = (themeColors: ThemeColors) =>
  StyleSheet.create({
    // Main screen container
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 20,
      backgroundColor: themeColors.background,
    },

    // Larger title for a stronger visual hierarchy
    title: {
      fontSize: 24,
      marginBottom: 10,
      color: themeColors.text,
      fontWeight: '600',
    },

    // Paragraph text for descriptions
    paragraph: {
      fontSize: 16,
      lineHeight: 24,
      marginBottom: 10,
      color: themeColors.text,
    },

    // Enhanced InfoScreen styles
    infoCard: {
      backgroundColor: themeColors.background,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 16,
    },
    infoTitle: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 28,
      marginBottom: 10,
      color: themeColors.text,
    },
    infoText: {
      fontSize: 16,
      lineHeight: 26,
      marginBottom: 12,
      color: themeColors.text,
    },
    infoList: {
      fontSize: 16,
      lineHeight: 28,
      marginBottom: 12,
      paddingLeft: 12,
      color: themeColors.text,
    },

    // Dropdown Trigger Button
    dropdownButton: {
      backgroundColor: themeColors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 10,
    },
    dropdownButtonText: {
      color: themeColors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },

    // Simple (non-floating) Dropdown List
    dropdownList: {
      width: 250,
      borderWidth: 1,
      borderColor: themeColors.shadow || '#ccc',
      borderRadius: 12,
      backgroundColor: themeColors.background,
      marginBottom: 10,
    },
    dropdownItem: {
      padding: 10,
    },
    dropdownItemText: {
      fontSize: 16,
      color: themeColors.text,
    },

    // Scroll container styling (if wrapping content in ScrollView)
    scrollContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingBottom: 20,
    },

    // Picker (native) styling
    picker: {
      width: 250,
      color: themeColors.text,
      marginVertical: 4,
    },

    // Main Buttons (e.g. “Play Audio,” answer choices)
    button: {
      backgroundColor: themeColors.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
    },
    buttonText: {
      color: themeColors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },

    buttonPressed: {
      backgroundColor: '#D76D1F',
    },

    // Container for answer buttons + feedback
    answerContainer: {
      position: 'relative',
      width: '80%',
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
    },

    // Feedback Overlay for ✓ or ✗
    feedbackOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      alignItems: 'center',
    },
    feedbackSymbol: {
      fontSize: 64,
      fontWeight: 'bold',
    },
    correctFeedback: {
      color: themeColors.success,
    },
    incorrectFeedback: {
      color: themeColors.error,
    },
    feedbackText: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: 'bold',
    },

    // Overlay for a floating, animated dropdown
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
    },

    // The floating dropdown card
    dropdownCard: {
      width: 280,
      backgroundColor: themeColors.background,
      borderRadius: 12,
      paddingVertical: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
  });

export default createStyles;
