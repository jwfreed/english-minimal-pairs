// styles.ts
import { StyleSheet, Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width > 700;

export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  success: string;
  error: string;
  primary: string;
  primaryLight: string;
  buttonText: string;
  cardBackground: string;
  shadow: string;
  icon: string;
  border: string;
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

function getShadowStyles() {
  if (Platform.OS === 'android') {
    return {
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.22,
      shadowRadius: 3,
    };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  };
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 20,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: isTablet ? 42 : 28,
      fontWeight: '700',
      marginBottom: 8,
      color: colors.text,
      textAlign: 'center',
    },
    practiceHeader: {
      width: '100%',
      maxWidth: isTablet ? 800 : 600,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    practiceHeaderSpacer: {
      width: isTablet ? 52 : 44,
      height: isTablet ? 52 : 44,
    },
    practiceTitle: {
      flex: 1,
      fontSize: isTablet ? 42 : 28,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    helpButton: {
      width: isTablet ? 52 : 44,
      height: isTablet ? 52 : 44,
      borderRadius: isTablet ? 26 : 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    paragraph: {
      ...baseFont(colors.text),
      textAlign: 'center',
      lineHeight: 24, // Better line height
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
      fontSize: isTablet ? 32 : 22,
      fontWeight: '800',
      marginTop: 28,
      marginBottom: 10,
      color: colors.text,
    },
    infoText: {
      ...baseFont(colors.text),
      fontSize: isTablet ? 24 : 16,
      lineHeight: isTablet ? 36 : 26,
      marginBottom: 12,
    },
    infoList: {
      ...baseFont(colors.text),
      fontSize: isTablet ? 24 : 16,
      lineHeight: isTablet ? 36 : 28,
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
      paddingVertical: isTablet ? 24 : 16, // Taller buttons
      paddingHorizontal: 32,
      borderRadius: 16, // More rounded
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      width: '100%',
      maxWidth: isTablet ? 700 : 500,
      ...getShadowStyles(),
    },
    buttonText: {
      color: colors.buttonText,
      fontSize: isTablet ? 32 : 18, // Larger text
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    buttonPressed: {
      backgroundColor: colors.primaryLight,
    },
    ipaText: {
      fontSize: isTablet ? 24 : 14,
      fontStyle: 'italic',
      color: colors.text,
      textAlign: 'center',
      marginTop: 4,
    },

    answerContainer: {
      width: '100%',
      maxWidth: isTablet ? 700 : 500,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
      gap: 16, // Add gap between buttons
    },
    feedbackSymbol: {
      fontSize: isTablet ? 42 : 32,
      fontWeight: 'bold',
      marginBottom: 2,
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
      padding: isTablet ? 20 : 12,
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
    pairItemStatsText: {
      fontSize: isTablet ? 18 : 14,
      color: colors.text,
      marginTop: 4,
    },
    timePracticedText: {
      fontSize: isTablet ? 18 : 14,
      marginBottom: 6,
      fontWeight: '600',
      color: colors.text,
    },
    progressBarOuter: {
      height: 12,
      width: '100%',
      backgroundColor: colors.border,
      borderRadius: 6,
      overflow: 'hidden',
    },
    progressBarInner: {
      height: '100%',
      backgroundColor: colors.primary,
    },

    // ========== Shared Section/Card Styles ==========
    mainCard: {
      width: '100%',
      maxWidth: isTablet ? 800 : 600,
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      padding: isTablet ? 32 : 16,
      alignItems: 'center',
      ...getShadowStyles(),
      marginTop: 6,
    },
    contrastHeader: {
      width: '100%',
      alignItems: 'center',
      gap: 8,
      marginBottom: 16,
    },
    contrastTitle: {
      fontSize: isTablet ? 34 : 24,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    contrastInstruction: {
      fontSize: isTablet ? 18 : 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    contrastDetailsButton: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    contrastDetailsButtonText: {
      fontSize: isTablet ? 17 : 13,
      fontWeight: '700',
      color: colors.primary,
    },
    pickerOverrideContainer: {
      width: '100%',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    practicePairLabel: {
      fontSize: isTablet ? 16 : 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    practicePairWords: {
      fontSize: isTablet ? 24 : 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 4,
    },
    pairPickerToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minHeight: 44,
      paddingHorizontal: 12,
      marginTop: 2,
    },
    pairPickerToggleText: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    pairPickerPanel: {
      width: '100%',
    },
    pairPickerModalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    pairPickerModalCard: {
      maxWidth: isTablet ? 700 : 500,
      paddingTop: 12,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.cardBackground,
      ...getShadowStyles(),
    },
    pairPickerModalHeader: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 12,
    },
    pairPickerModalTitle: {
      flex: 1,
      fontSize: isTablet ? 22 : 17,
      fontWeight: '700',
      color: colors.text,
    },
    pairPickerModalClose: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    answerPrompt: {
      fontSize: isTablet ? 20 : 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    section: {
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
      backgroundColor: colors.cardBackground,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isTablet ? 24 : 16,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    sectionIcon: {
      marginRight: 12,
    },
    sectionTitle: {
      fontSize: isTablet ? 24 : 18,
      fontWeight: '600',
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: isTablet ? 18 : 14,
      marginTop: 2,
      color: colors.text,
    },
    sectionContent: {
      borderTopWidth: 1,
      borderTopColor: colors.shadow,
    },

    // ========== Header Styles ==========
    header: {
      marginBottom: 24,
      paddingTop: 8,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: isTablet ? 48 : 32,
      fontWeight: 'bold',
      marginBottom: 4,
      color: colors.text,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: isTablet ? 24 : 16,
      color: colors.text,
      textAlign: 'center',
    },

    // ========== List Item Styles ==========
    listOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isTablet ? 24 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.shadow,
    },
    selectedListOption: {
      backgroundColor: colors.primary + '15',
    },
    lastListOption: {
      borderBottomWidth: 0,
    },
    listItemInfo: {
      flex: 1,
      marginRight: 12,
    },
    listItemName: {
      fontSize: isTablet ? 24 : 16,
      fontWeight: '500',
      marginBottom: 4,
      color: colors.text,
    },
    listItemDetails: {
      fontSize: isTablet ? 18 : 14,
      color: colors.text,
    },

    // ========== Loading & Empty States ==========
    loadingContainer: {
      padding: 32,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.text,
    },
    emptyContainer: {
      padding: 32,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 16,
      color: colors.text,
    },

    // ========== Button Variants ==========
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
    },
    refreshButtonText: {
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },

    // ========== Layout Helpers ==========
    contentContainer: {
      padding: 16,
    },
    footer: {
      height: 32,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    infoLabel: {
      fontSize: isTablet ? 24 : 16,
      color: colors.text,
    },
    infoValue: {
      fontSize: isTablet ? 24 : 16,
      fontWeight: '600',
      color: colors.text,
    },

    // ========== Rich Feedback Panel ==========
    feedbackPanel: {
      marginTop: 6,
      paddingVertical: 6,
      paddingHorizontal: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: colors.border,
    },
    feedbackWord: {
      fontSize: isTablet ? 22 : 17,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 2,
      textAlign: 'center' as const,
    },
    feedbackDetail: {
      fontSize: isTablet ? 18 : 14,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginBottom: 6,
    },
    feedbackAttemptRows: {
      width: '100%' as const,
      marginTop: 4,
      marginBottom: 10,
      gap: 6,
    },
    feedbackAttemptRow: {
      width: '100%' as const,
      flexDirection: 'row' as const,
      alignItems: 'baseline' as const,
      justifyContent: 'space-between' as const,
      gap: 16,
    },
    feedbackAttemptLabel: {
      fontSize: isTablet ? 17 : 13,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    feedbackAttemptValue: {
      flexShrink: 1,
      fontSize: isTablet ? 19 : 15,
      fontWeight: '700' as const,
      color: colors.text,
      textAlign: 'right' as const,
    },
    feedbackIPA: {
      fontSize: isTablet ? 20 : 15,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    feedbackHighlight: {
      color: colors.primary,
      fontWeight: '700' as const,
    },
    replayButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.primary + '22',
    },
    replayButtonText: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    compareContainer: {
      width: '100%' as const,
      alignItems: 'center' as const,
      marginTop: 2,
    },
    compareTitle: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 4,
      textAlign: 'center' as const,
    },
    contrastContext: {
      fontSize: isTablet ? 21 : 16,
      fontWeight: '800' as const,
      color: colors.primary,
      marginBottom: 8,
      textAlign: 'center' as const,
    },
    compareButtonRow: {
      flexDirection: 'row' as const,
      width: '100%' as const,
      gap: 10,
    },
    compareButton: {
      flex: 1,
      minHeight: 48,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.primary + '22',
    },
    compareButtonDisabled: {
      opacity: 0.55,
    },
    compareButtonText: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '700' as const,
      color: colors.primary,
      textAlign: 'center' as const,
    },
    compareButtonIpa: {
      fontSize: isTablet ? 16 : 12,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginTop: 2,
    },

    // ========== Session Timer ==========
    sessionTimerContainer: {
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    sessionTimerRow: {
      flexDirection: 'row' as const,
      alignItems: 'baseline' as const,
      marginBottom: 4,
    },
    sessionTimerText: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '600' as const,
      color: colors.text,
    },
    sessionTimerGoal: {
      fontSize: isTablet ? 14 : 11,
      color: colors.textSecondary,
      marginLeft: 4,
    },
    sessionTimerBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden' as const,
    },
    sessionTimerBarFill: {
      height: '100%' as const,
      borderRadius: 3,
      backgroundColor: colors.success,
    },

    // ========== Level Indicator ==========
    levelIndicatorRow: {
      flexDirection: 'column' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 4,
      marginBottom: 4,
    },
    levelDotsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 4,
    },
    levelDot: {
      borderWidth: 1.5,
    },
    levelLabel: {
      fontSize: isTablet ? 16 : 13,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    levelLabelCompact: {
      fontSize: isTablet ? 14 : 11,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    levelCriteriaText: {
      fontSize: isTablet ? 13 : 11,
      color: colors.textSecondary,
      marginTop: 2,
      textAlign: 'center' as const,
    },

    // ========== Level-Up Celebration ==========
    levelUpContainer: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.primary + '18',
      alignItems: 'center' as const,
    },
    levelUpText: {
      fontSize: isTablet ? 18 : 15,
      fontWeight: '700' as const,
      color: colors.primary,
      marginBottom: 4,
    },

    // ========== Mastery Badge (Results) ==========
    masteryBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginTop: 4,
    },

    // ========== Mastery Summary Card (Results) ==========
    masterySummaryCard: {
      flexDirection: 'row' as const,
      justifyContent: 'space-around' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      paddingVertical: isTablet ? 16 : 12,
      paddingHorizontal: isTablet ? 24 : 16,
      marginBottom: 12,
      ...getShadowStyles(),
    },
    masterySummaryItem: {
      alignItems: 'center' as const,
    },
    masterySummaryValue: {
      fontSize: isTablet ? 28 : 22,
      fontWeight: '700' as const,
      color: colors.primary,
    },
    masterySummaryLabel: {
      fontSize: isTablet ? 14 : 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // ========== Placement Status Chip ==========
    placementStatusRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      marginTop: 4,
      gap: 4,
    },
    placementStatusText: {
      fontSize: isTablet ? 13 : 11,
      fontWeight: '600' as const,
    },
  });

export type AppStyles = ReturnType<typeof createStyles>;

export default createStyles;
