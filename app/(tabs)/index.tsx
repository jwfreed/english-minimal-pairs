import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';

import { usePracticeEntryState } from '@/src/hooks/usePracticeEntryState';
import { usePracticeSession } from '@/src/hooks/usePracticeSession';
import AnswerButtons from '@/src/components/AnswerButtons';
import HelpOverlay from '@/src/components/HelpOverlay';
import LevelIndicator from '@/src/components/LevelIndicator';
import OnboardingScreen from '@/src/components/OnboardingScreen';
import PlacementTest from '@/src/components/PlacementTest';
import ContrastDetailsModal from '@/src/components/practice/ContrastDetailsModal';
import LevelUpCelebration from '@/src/components/practice/LevelUpCelebration';
import ListenControls from '@/src/components/practice/ListenControls';
import PracticeHeader from '@/src/components/practice/PracticeHeader';
import PracticePairSelector from '@/src/components/practice/PracticePairSelector';
import { minimalPairs, type Pair } from '@/src/constants/minimalPairs';
import createStyles from '@/src/constants/styles';
import { PROGRESS_SURGE_FRACTION } from '@/src/constants/motion';
import { tKeys } from '@/src/constants/translationKeys';
import { useCategory } from '@/src/context/CategoryContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';
import { buildContrastLabel } from '@/utils/contrastLabel';

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
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
  } = usePracticeEntryState(catKey);
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
    isSpeaking,
    mastery,
    playedIdx,
    promotedTier,
    safePairIndex,
    selectedPair,
    setAllGroupsToTier,
    stableVisible,
    timerRef,
  } = usePracticeSession({
    categoryIndex,
    category: catObj,
    isPracticeReady,
  });

  const contrastLabel = useMemo(
    () => buildContrastLabel(selectedPair),
    [selectedPair]
  );

  // Contrast details are purely visual state and should not survive a category change.
  useEffect(() => {
    setIsContrastDetailsVisible(false);
  }, [categoryIndex]);

  const handlePlacementComplete = useCallback(
    async (startTier: number) => {
      setAllGroupsToTier(startTier);
      await completePlacement();
    },
    [completePlacement, setAllGroupsToTier]
  );

  const handleContrastDetailPairSelect = useCallback(
    (pair: Pair) => {
      if (selectContrastDetailPair(pair)) {
        setIsContrastDetailsVisible(false);
      }
    },
    [selectContrastDetailPair]
  );

  // Show PlacementTest if the user hasn't completed it yet.
  if (isEntryLoading) {
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
    <View style={styles.container}>
      <PracticeHeader
        title={translate(tKeys.practicePairs)}
        helpAccessibilityLabel={translate(tKeys.helpLabel)}
        onHelpPress={() => setIsHelpVisible(true)}
        primaryColor={theme.primaryText}
        styles={styles}
        timerRef={timerRef}
        progressBoost={feedback === 'correct' ? PROGRESS_SURGE_FRACTION : 0}
      />

      <View style={styles.mainCard}>
        <View style={styles.contrastHeader}>
          <Text style={styles.eyebrow}>{translate(tKeys.trainContrast)}</Text>
          <Text accessibilityRole="header" style={styles.contrastTitle}>
            {contrastLabel}
          </Text>
          {selectedPair && (
            <LevelIndicator
              currentTier={mastery[selectedPair.group] ?? 1}
              highlightCurrentTier={feedback === 'correct'}
            />
          )}
          {selectedPair && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setIsContrastDetailsVisible(true)}
              style={styles.contrastDetailsButton}
            >
              <Text style={styles.contrastDetailsButtonText}>
                {translate(tKeys.viewContrastDetails)}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <LevelUpCelebration
          promotedTier={promotedTier}
          label={
            promotedTier == null
              ? translate(tKeys.levelUnlocked)
              : `${translate(tKeys.contrastMovedToLevel)} ${promotedTier}`
          }
          styles={styles}
        />

        <ListenControls
          label={playAudioText}
          onPlay={handlePlay}
          disabled={!audioModeReady || isSpeaking}
          isPlaying={isSpeaking}
          styles={styles}
        />

        <Text style={styles.contrastInstruction}>
          {translate(tKeys.listenForSoundDifference)}
        </Text>

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={playedIdx === null || feedback !== null || isSpeaking}
            isPlaybackActive={isSpeaking}
            playedIdx={playedIdx}
            onCompareWord={handleCompareWord}
            compareDisabled={!audioModeReady || isSpeaking}
          />
        )}

        {feedback === null && (
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
        )}
      </View>

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
    </View>
  );
}
