import { StyleSheet } from 'react-native';

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
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 20,
      backgroundColor: themeColors.background,
    },
    title: {
      fontSize: 20,
      marginBottom: 8,
      color: themeColors.text,
    },
    
    // Custom dropdown button
    dropdownButton: {
      backgroundColor: themeColors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 10,
    },
    dropdownButtonText: {
      color: themeColors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },
    dropdownList: {
      width: 250,
      borderWidth: 1,
      borderColor: themeColors.shadow,
      borderRadius: 5,
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

    // Scroll container styling (if you use ScrollView)
    scrollContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingBottom: 20,
    },

    picker: {
      width: 250,
      color: themeColors.text,
      marginVertical: 4, 
    },

    // Main Buttons
    button: {
      backgroundColor: themeColors.primary,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    buttonText: {
      color: themeColors.buttonText,
      fontSize: 15,
      fontWeight: 'bold',
    },

    // Container for the "answer" buttons & feedback
    answerContainer: {
      position: 'relative',
      width: '80%',
      height: 100,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },

    // The row with the two answer buttons
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
    },

    // Absolutely positioned feedback overlay
    feedbackOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1,
      alignItems: 'center',
    },

    // Large ✓ or ✗ symbol
    feedbackSymbol: {
      fontSize: 60,
      fontWeight: 'bold',
    },

    // Colors for correct/incorrect feedback
    correctFeedback: { color: themeColors.success },
    incorrectFeedback: { color: themeColors.error },

    // Optional feedback text style
    feedbackText: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

export default createStyles;
