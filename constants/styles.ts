// styles.ts
import { StyleSheet, Platform } from 'react-native';
import { Colors } from './Colors';

export type ThemeColors = {
  background: string;
  text: string;
  success: string;
  error: string;
  primary: string;
  buttonText: string;
  cardBackground: string;
  shadow: string;
  icon: string;
};

// We define constants for repeated values
const Z_INDEX = {
  feedback: 500,
  dropdown: 900,
  overlay: 1000,
};

function baseFont(color: string) {
  return {
    fontSize: 16,
    color,
  };
}

const padding = {
  vertical: 10,
  horizontal: 20,
};

function getShadowStyles() {
  if (Platform.OS === 'android') {
    return {
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  };
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      marginBottom: 10,
      color: colors.text,
    },
    paragraph: {
      ...baseFont(colors.text),
      textAlign: 'center',
    },
    chartTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
      color: colors.text,
    },
    chartContainer: {
      marginTop: 20,
      paddingHorizontal: 20,
    },
    infoCard: {
      backgroundColor: colors.background,
      borderRadius: 16,
      paddingVertical: 20,
      paddingHorizontal: 16,
    },
    infoTitle: {
      fontSize: 22,
      fontWeight: '800',
      marginTop: 28,
      marginBottom: 10,
      color: colors.text,
    },
    infoText: {
      ...baseFont(colors.text),
      lineHeight: 26,
      marginBottom: 12,
    },
    infoList: {
      ...baseFont(colors.text),
      lineHeight: 28,
      marginBottom: 12,
      paddingLeft: 12,
    },
    dropdownButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      marginBottom: 10,
    },
    dropdownButtonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },
    dropdownList: {
      width: 250,
      borderWidth: 1,
      borderColor: colors.shadow,
      borderRadius: 12,
      backgroundColor: colors.background,
      marginBottom: 10,
    },
    dropdownItem: {
      padding: 10,
    },
    dropdownItemText: {
      ...baseFont(colors.text),
    },
    scrollContainer: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingBottom: 20,
    },
    picker: {
      width: 250,
      color: colors.text,
      marginVertical: 4,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: padding.vertical,
      paddingHorizontal: padding.horizontal,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      ...getShadowStyles(),
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: 16,
      fontWeight: 'bold',
    },
    buttonPressed: {
      backgroundColor: '#D76D1F',
    },
    ipaText: {
      fontSize: 14,
      fontStyle: 'italic',
      color: colors.text,
      textAlign: 'center',
      marginTop: 4,
    },

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
    feedbackOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: Z_INDEX.feedback,
      alignItems: 'center',
    },
    feedbackSymbol: {
      fontSize: 64,
      fontWeight: 'bold',
    },
    correctFeedback: {
      color: colors.success,
    },
    incorrectFeedback: {
      color: colors.error,
    },
    feedbackText: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: Z_INDEX.overlay,
    },
    dropdownCard: {
      width: 280,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 10,
      ...getShadowStyles(),
    },
    pairItemContainer: {
      marginBottom: 24,
      borderRadius: 12,
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.125)',
    },
    pairItemRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    pairItemLeftColumn: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 140,
      paddingRight: 8,
    },
    pairItemRightColumn: {
      flexGrow: 1,
      minWidth: 180,
      maxWidth: '100%',
    },
    progressBarOuter: {
      height: 12,
      width: '100%',
      backgroundColor: '#e5e7eb',
      borderRadius: 6,
      overflow: 'hidden',
    },
    progressBarInner: {
      height: '100%',
      backgroundColor: '#3b82f6',
    },
  });

export default createStyles;
