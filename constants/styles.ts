import { StyleSheet } from 'react-native';

interface ThemeColors {
  background: string;
  text: string;
  success: string;
  error: string;
  primary: string;
  buttonText: string;
  cardBackground?: string; // Optional in case some screens don't use it
  shadow?: string; // Optional in case some screens don't use it
}

const createStyles = (themeColors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 40,
      backgroundColor: themeColors.background, // Dynamic background
    },
    title: {
      fontSize: 22,
      marginBottom: 10,
      color: themeColors.text, // Dynamic text color
    },
    buttonRow: {
      flexDirection: 'row',
      marginVertical: 20,
      justifyContent: 'space-around',
      width: '60%',
    },
    feedbackText: {
      marginTop: 10,
      fontSize: 18,
      fontWeight: 'bold',
    },
    correctFeedback: {
      color: themeColors.success,
      fontSize: 80,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    incorrectFeedback: {
      color: themeColors.error,
      fontSize: 80,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    picker: {
      width: 250,
      color: themeColors.text, // Dynamic picker text color
    },
    button: {
      backgroundColor: themeColors.primary, // Custom background color
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },

    buttonText: {
      color: themeColors.buttonText, // Ensure proper text contrast
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

export default createStyles;
