import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';

import { usePracticeEntryState } from '@/src/hooks/usePracticeEntryState';
import { usePracticeSession } from '@/src/hooks/usePracticeSession';
import AnswerButtons from '@/src/components/AnswerButtons';
import HelpOverlay from '@/src/components/HelpOverlay';
import LearnerLanguagePicker from '@/src/components/LearnerLanguagePicker';
import LevelIndicator from '@/src/components/LevelIndicator';
import OnboardingScreen from '@/src/components/OnboardingScreen';
import PlacementTest from '@/src/components/PlacementTest';
import PlaybackFailureNotice from '@/src/components/PlaybackFailureNotice';
import ContrastDetailsModal from '@/src/components/practice/ContrastDetailsModal';
import LevelUpCelebration from '@/src/components/practice/LevelUpCelebration';
import ListenControls from '@/src/components/practice/ListenControls';
import NextContrastSuggestion from '@/src/components/practice/NextContrastSuggestion';
import PracticeHeader from '@/src/components/practice/PracticeHeader';
import PracticePairSelector from '@/src/components/practice/PracticePairSelector';
import { minimalPairs, type Pair } from '@/src/constants/minimalPairs';
import createStyles from '@/src/constants/styles';
import { tKeys } from '@/src/constants/translationKeys';
import { useCategory } from '@/src/context/CategoryContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import { isMasteredLevel } from '@/src/domain/masteryLevel';
import type { ContrastId } from '@/src/domain/identity';
import { useNextContrastSuggestion } from '@/src/hooks/useNextContrastSuggestion';
import { buildContrastLabel } from '@/utils/contrastLabel';

export default function HomeScreen() {
  const { translate, learnerLanguageStatus } = useLanguage();
  const { categoryIndex, isCategoryResolved, selectLearnerCategory } =
    useCategory();
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const playAudioText = useMemo(() => translate(tKeys.playAudio), [translate]);

  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isContrastDetailsVisible, setIsContrastDetailsVisible] =
    useState(false);

  const catObj = minimalPairs[categoryIndex];
  const catKey = catObj.category;
  const {
    showOnboarding,
    showPlacement,
    completeOnboarding,
    completePlacement,
    skipPlacement,
    refreshEntryState,
    isLoading: isEntryLoading,
    isPracticeReady,
  } = usePracticeEntryState(isCategoryResolved ? catKey : null);
  const navigation = useNavigation();

  // The Practice tab remains mounted while Settings clears placement state.
  // Re-read the entry gate whenever this tab regains focus.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', refreshEntryState);
    return unsubscribe;
  }, [navigation, refreshEntryState]);
  const {
    activeGroupPairs,
    audioModeReady,
    canAnswer,
    contrastDetailPairs,
    feedback,
    handleAnswer,
    handleCompareWord,
    handleContrastDetailPairSelect: selectContrastDetailPair,
    handlePairChange,
    handlePickerScrollEnd,
    handlePickerScrollStart,
    handlePlay,
    isLoading,
    isPromptPlaybackActive,
    isSpeaking,
    mastery,
    nextLevelProgress,
    playbackFailureReason,
    playedIdx,
    promotedLevel,
    safePairIndex,
    selectedPair,
    setPlacementLevels,
    stableVisible,
    timerRef,
  } = usePracticeSession({
    categoryIndex,
    category: catObj,
    isPracticeReady,
  });
  const suggestion = useNextContrastSuggestion(selectedPair?.group);

  const contrastLabel = useMemo(
    () => buildContrastLabel(selectedPair),
    [selectedPair]
  );
  const handleSuggestionSelect = useCallback(
    (contrastId: ContrastId) => {
      const suggestedContrast = contrastRegistry.getById(contrastId);
      if (!suggestedContrast) return;
      const suggestedPairIndex = stableVisible.findIndex(
        (pair) => pair.group === suggestedContrast.legacyGroup
      );
      if (suggestedPairIndex === -1) return;
      handlePairChange(suggestedPairIndex);
    },
    [handlePairChange, stableVisible]
  );

  // Contrast details are purely visual state and should not survive a category change.
  useEffect(() => {
    setIsContrastDetailsVisible(false);
  }, [categoryIndex]);

  const handlePlacementComplete = useCallback(
    async (levels: Record<string, number>) => {
      setPlacementLevels(levels);
      await completePlacement();
    },
    [completePlacement, setPlacementLevels]
  );

  const handleContrastDetailPairSelect = useCallback(
    (pair: Pair) => {
      if (selectContrastDetailPair(pair)) {
        setIsContrastDetailsVisible(false);
      }
    },
    [selectContrastDetailPair]
  );

  // The learner's L1 background must be an explicit choice before any
  // category-dependent onboarding, placement or practice state is read.
  if (learnerLanguageStatus === 'unresolved') {
    return <LearnerLanguagePicker onSelect={selectLearnerCategory} />;
  }

  // Show PlacementTest if the user hasn't completed it yet.
  if (!isCategoryResolved || isEntryLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>
          {translate(tKeys.loading)}
        </Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDismiss={completeOnboarding} />;
  }

  if (showPlacement) {
    return (
      <PlacementTest
        pairs={catObj.pairs}
        onComplete={handlePlacementComplete}
        onSkip={skipPlacement}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scrollScreen}
      contentContainerStyle={styles.scrollContent}
    >
      <PracticeHeader
        title={translate(tKeys.practicePairs)}
        helpAccessibilityLabel={translate(tKeys.helpLabel)}
        onHelpPress={() => setIsHelpVisible(true)}
        primaryColor={theme.primaryText}
        styles={styles}
        timerRef={timerRef}
        highlightProgress={feedback === 'correct'}
      />

      <View style={styles.mainCard}>
        <View style={styles.contrastHeader}>
          <Text accessibilityRole="header" style={styles.contrastTitle}>
            {contrastLabel}
          </Text>
          {selectedPair && (
            <LevelIndicator
              masteryLevel={mastery[selectedPair.group] ?? 1}
              highlightCurrentTier={feedback === 'correct'}
              nextLevelProgress={nextLevelProgress}
            />
          )}
          {selectedPair && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setIsContrastDetailsVisible(true)}
              hitSlop={8}
              style={styles.contrastDetailsButton}
            >
              <Text style={styles.contrastDetailsButtonText}>
                {translate(tKeys.viewContrastDetails)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <LevelUpCelebration
          promotedLevel={promotedLevel}
          label={
            promotedLevel == null
              ? translate(tKeys.levelUnlocked)
              : isMasteredLevel(promotedLevel)
                ? translate(tKeys.mastered)
                : `${translate(tKeys.contrastMovedToLevel)} ${promotedLevel}`
          }
          styles={styles}
        />

        <ListenControls
          label={playAudioText}
          onPlay={handlePlay}
          disabled={!audioModeReady || isPromptPlaybackActive || isSpeaking}
          isPlaying={isPromptPlaybackActive || isSpeaking}
          styles={styles}
        />

        {playbackFailureReason ? (
          <PlaybackFailureNotice style={styles.contrastInstruction} />
        ) : (
          <Text style={styles.contrastInstruction}>
            {translate(tKeys.listenForSoundDifference)}
          </Text>
        )}

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={!canAnswer}
            isPlaybackActive={isPromptPlaybackActive}
            playedIdx={playedIdx}
            onCompareWord={handleCompareWord}
            compareDisabled={!audioModeReady || isSpeaking}
          />
        )}
      </View>

      {/* Secondary controls sit outside the drill card so the card holds only
          the listen-and-choose loop. Hidden while feedback is showing. */}
      {feedback === null && (
        <View style={styles.practiceSecondary}>
          <PracticePairSelector
            isLoading={isLoading}
            selectedPair={selectedPair}
            pairs={stableVisible}
            index={safePairIndex}
            onIndexChange={handlePairChange}
            color={theme.text}
            accentColor={theme.primary}
            loadingTextColor={theme.textSecondary}
            styles={styles}
            onScrollStart={handlePickerScrollStart}
            onScrollEnd={handlePickerScrollEnd}
          />
          <NextContrastSuggestion
            suggestion={suggestion}
            onSelect={handleSuggestionSelect}
          />
        </View>
      )}

      <HelpOverlay
        visible={isHelpVisible}
        onClose={() => setIsHelpVisible(false)}
      />
      <ContrastDetailsModal
        visible={isContrastDetailsVisible}
        representativePair={selectedPair}
        pairs={contrastDetailPairs}
        availablePairs={activeGroupPairs}
        masteryLevel={selectedPair ? mastery[selectedPair.group] ?? 1 : 1}
        onSelectPair={handleContrastDetailPairSelect}
        onClose={() => setIsContrastDetailsVisible(false)}
      />
    </ScrollView>
  );
}
