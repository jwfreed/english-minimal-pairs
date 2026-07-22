// styles.ts
import { StyleSheet, Dimensions } from 'react-native';
import { FontFamily } from '@/src/constants/typography';

const { width } = Dimensions.get('window');
const isTablet = width > 700;

export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  primaryText: string;
  surface: string;
  surfaceTint: string;
  hairline: string;
  track: string;
  trackStrong: string;
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

export function getCardShadowStyles(colors: ThemeColors) {
  return {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: colors.background === '#2C3E50' ? 0.35 : 0.18,
    shadowRadius: 14,
    elevation: 4,
  };
}

export function getButtonShadowStyles() {
  return {
    shadowColor: '#E67E22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  };
}

// Idle "breathing" pulse on the Play button: a sharp ring plus a soft outer
// glow expanding together, one beat per 4.5s cycle (quiet from 64% onward).
const ambientGlowLight = {
  '0%': { boxShadow: '0 0 0 0 rgba(191, 87, 0, 0), 0 0 0 0 rgba(230, 126, 34, 0)' },
  '12%': { boxShadow: '0 0 0 4px rgba(191, 87, 0, 0.85), 0 0 18px 6px rgba(230, 126, 34, 0.6)' },
  '38%': { boxShadow: '0 0 0 13px rgba(191, 87, 0, 0.3), 0 0 32px 13px rgba(230, 126, 34, 0.28)' },
  '46%': { boxShadow: '0 0 0 22px rgba(191, 87, 0, 0), 0 0 36px 18px rgba(230, 126, 34, 0)' },
  '64%': { boxShadow: '0 0 0 0 rgba(191, 87, 0, 0), 0 0 0 0 rgba(230, 126, 34, 0)' },
  '100%': { boxShadow: '0 0 0 0 rgba(191, 87, 0, 0), 0 0 0 0 rgba(230, 126, 34, 0)' },
};

const ambientGlowDark = {
  '0%': { boxShadow: '0 0 0 0 rgba(247, 158, 74, 0), 0 0 0 0 rgba(247, 158, 74, 0)' },
  '12%': { boxShadow: '0 0 0 4px rgba(247, 158, 74, 0.85), 0 0 18px 6px rgba(247, 158, 74, 0.6)' },
  '38%': { boxShadow: '0 0 0 13px rgba(247, 158, 74, 0.32), 0 0 32px 13px rgba(247, 158, 74, 0.3)' },
  '46%': { boxShadow: '0 0 0 22px rgba(247, 158, 74, 0), 0 0 36px 18px rgba(247, 158, 74, 0)' },
  '64%': { boxShadow: '0 0 0 0 rgba(247, 158, 74, 0), 0 0 0 0 rgba(247, 158, 74, 0)' },
  '100%': { boxShadow: '0 0 0 0 rgba(247, 158, 74, 0), 0 0 0 0 rgba(247, 158, 74, 0)' },
};

export function getAmbientGlowKeyframes(colors: ThemeColors) {
  return colors.background === '#2C3E50' ? ambientGlowDark : ambientGlowLight;
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
      marginBottom: 12,
    },
    practiceHeaderTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    practiceHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    practiceTitle: {
      fontFamily: FontFamily.extraBold,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.text,
      textAlign: 'left',
    },
    helpButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
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
    feedbackStatusCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    correctFeedbackCircle: {
      backgroundColor: colors.success,
    },
    incorrectFeedbackCircle: {
      backgroundColor: colors.error,
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
      ...getCardShadowStyles(colors),
    },
    pairItemContainer: {
      marginBottom: 12,
      borderRadius: 16,
      padding: isTablet ? 20 : 16,
      backgroundColor: colors.surface,
      ...getCardShadowStyles(colors),
    },
    pairItemRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    pairItemHeadingRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 12,
    },
    pairItemTitle: {
      flex: 1,
      fontFamily: FontFamily.extraBold,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    pairItemAccuracy: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
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
      fontFamily: FontFamily.regular,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 6,
    },
    timePracticedText: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      marginBottom: 0,
      fontWeight: '600',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    pairTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
    },
    unpracticedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    unpracticedText: {
      fontFamily: FontFamily.regular,
      fontSize: 12,
      color: colors.textSecondary,
    },
    progressBarOuter: {
      flex: 1,
      height: 6,
      width: '100%',
      backgroundColor: colors.track,
      borderRadius: 3,
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
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingTop: 28,
      paddingHorizontal: 20,
      paddingBottom: 22,
      alignItems: 'center',
      ...getCardShadowStyles(colors),
      marginTop: 6,
    },
    contrastHeader: {
      width: '100%',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
    },
    eyebrow: {
      fontFamily: FontFamily.bold,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    contrastTitle: {
      fontFamily: FontFamily.extraBold,
      fontSize: 30,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    contrastInstruction: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 10,
    },
    contrastDetailsButton: {
      minHeight: 28,
      justifyContent: 'center',
    },
    contrastDetailsButtonText: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    pickerOverrideContainer: {
      width: '100%',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    practicePairCopy: {
      flex: 1,
      alignItems: 'flex-start',
    },
    practicePairLabel: {
      fontFamily: FontFamily.bold,
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textAlign: 'left',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    practicePairWords: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'left',
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
      fontFamily: FontFamily.bold,
      fontSize: 13,
      fontWeight: '700',
      color: colors.primaryText,
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
      ...getCardShadowStyles(colors),
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
      fontFamily: FontFamily.bold,
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: 26,
      marginBottom: 12,
    },
    answerTile: {
      flex: 1,
      paddingVertical: 20,
      paddingHorizontal: 10,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background === '#2C3E50' ? '#41566D' : colors.surfaceTint,
      borderWidth: colors.background === '#2C3E50' ? 1 : 0,
      borderColor: colors.background === '#2C3E50' ? '#57708A' : 'transparent',
    },
    answerTileWord: {
      fontFamily: FontFamily.extraBold,
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
    },
    answerTileIpa: {
      fontFamily: FontFamily.regular,
      fontSize: 13,
      color: colors.primaryText,
      marginTop: 4,
    },
    playButton: {
      width: '100%',
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.primary,
      ...getButtonShadowStyles(),
    },
    playButtonPlaying: {
      backgroundColor: '#B9640F',
    },
    playButtonGlow: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
    },
    playIconCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    playButtonLabel: {
      fontFamily: FontFamily.bold,
      fontSize: 17,
      fontWeight: '700',
      color: colors.buttonText,
    },
    section: {
      borderRadius: 18,
      marginBottom: 12,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      ...getCardShadowStyles(colors),
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
      width: 36,
      height: 36,
      borderRadius: 11,
      marginRight: 12,
      textAlign: 'center',
      textAlignVertical: 'center',
      lineHeight: 36,
      backgroundColor: colors.surfaceTint,
    },
    sectionTitle: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    sectionSubtitle: {
      fontFamily: FontFamily.regular,
      fontSize: 12,
      marginTop: 2,
      color: colors.text,
    },
    sectionContent: {
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },

    // ========== Header Styles ==========
    header: {
      marginBottom: 20,
      paddingTop: 8,
      alignItems: 'flex-start',
    },
    headerTitle: {
      fontFamily: FontFamily.extraBold,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginBottom: 4,
      color: colors.text,
      textAlign: 'left',
    },
    headerSubtitle: {
      fontFamily: FontFamily.regular,
      fontSize: 13,
      color: colors.text,
      textAlign: 'left',
    },

    // ========== List Item Styles ==========
    listOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isTablet ? 24 : 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.hairline,
    },
    selectedListOption: {
      backgroundColor: colors.surfaceTint,
    },
    lastListOption: {
      borderBottomWidth: 0,
    },
    listItemInfo: {
      flex: 1,
      marginRight: 12,
    },
    listItemName: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
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
      backgroundColor: colors.surface,
      borderRadius: 16,
      alignItems: 'center' as const,
      borderWidth: 1,
      borderColor: colors.hairline,
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
      backgroundColor: colors.surfaceTint,
    },
    compareButtonDisabled: {
      opacity: 0.55,
    },
    compareButtonPressed: {
      transform: [{ scale: 0.96 }],
    },
    compareButtonText: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '700' as const,
      color: colors.primaryText,
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
      width: '100%',
    },
    sessionTimerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    sessionTimerDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 7,
      backgroundColor: colors.success,
    },
    sessionTimerText: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600' as const,
      fontVariant: ['tabular-nums'] as const,
      color: colors.text,
    },
    sessionTimerGoal: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600' as const,
      fontVariant: ['tabular-nums'] as const,
      color: colors.text,
      marginLeft: 3,
    },
    sessionTimerBarBg: {
      width: '100%',
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.track,
      overflow: 'hidden' as const,
    },
    sessionTimerBarFill: {
      height: '100%' as const,
      borderRadius: 2,
      backgroundColor: colors.success,
    },

    // ========== Level Indicator ==========
    levelIndicatorRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 8,
      marginBottom: 4,
    },
    levelDotsRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 3,
    },
    levelDot: {
      borderWidth: 0,
    },
    levelLabel: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    levelLabelCompact: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
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
      backgroundColor: colors.surface,
      borderRadius: 18,
      paddingVertical: isTablet ? 16 : 12,
      paddingHorizontal: isTablet ? 24 : 16,
      marginBottom: 12,
      ...getCardShadowStyles(colors),
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
