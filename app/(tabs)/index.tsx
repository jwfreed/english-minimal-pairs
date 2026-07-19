import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePracticeSession } from '@/src/hooks/usePracticeSession';
import AnswerButtons from '@/src/components/AnswerButtons';
import HelpOverlay from '@/src/components/HelpOverlay';
import LevelIndicator from '@/src/components/LevelIndicator';
import OnboardingScreen from '@/src/components/OnboardingScreen';
import PlacementTest from '@/src/components/PlacementTest';
import SessionTimer from '@/src/components/SessionTimer';
import ContrastDetailsModal from '@/src/components/practice/ContrastDetailsModal';
import LevelUpCelebration from '@/src/components/practice/LevelUpCelebration';
import ListenControls from '@/src/components/practice/ListenControls';
import PracticeHeader from '@/src/components/practice/PracticeHeader';
import PracticePairSelector from '@/src/components/practice/PracticePairSelector';
import { minimalPairs, type Pair } from '@/src/constants/minimalPairs';
import createStyles from '@/src/constants/styles';
import { tKeys } from '@/src/constants/translationKeys';
import { useCategory } from '@/src/context/CategoryContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { useAllThemeColors } from '@/src/context/theme';
import {
  PLACEMENT_DONE_KEY,
  PLACEMENT_LEGACY_MIGRATION_KEY,
  buildPlacementStorageKey,
  resolvePlacementStateForCategory,
  serializePlacementDone,
} from '@/src/domain/masteryPersistence';
import {
  ONBOARDING_SEEN_KEY,
  markOnboardingSeen,
  shouldShowOnboarding,
} from '@/src/storage/onboardingStorage';
import { buildContrastTrainingTitle } from '@/utils/contrastLabel';

export default function HomeScreen() {
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const playAudioText = useMemo(() => translate(tKeys.playAudio), [translate]);

  // Placement and onboarding remain screen-level entry flows.
  const [showPlacement, setShowPlacement] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isContrastDetailsVisible, setIsContrastDetailsVisible] =
    useState(false);

  const catObj = minimalPairs[categoryIndex];
  const catKey = catObj.category;
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
    isPracticeReady: showOnboarding === false && showPlacement === false,
  });

  const contrastTrainingTitle = useMemo(
    () => buildContrastTrainingTitle(selectedPair, translate),
    [selectedPair, translate]
  );

  // Re-check placement each time the category changes.
  // Delegates the migration decision to a pure helper so the logic is testable
  // without relying on component behavior.
  useEffect(() => {
    let cancelled = false;
    const perCatKey = buildPlacementStorageKey(catKey);
    Promise.all([
      AsyncStorage.getItem(perCatKey),
      AsyncStorage.getItem(PLACEMENT_DONE_KEY),
      AsyncStorage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
    ])
      .then(async ([categoryRaw, legacyRaw, sentinelRaw, onboardingRaw]) => {
        const decision = resolvePlacementStateForCategory({
          categoryRaw,
          legacyRaw,
          sentinelRaw,
        });
        if (decision.shouldSeedCurrentCategoryFromLegacy) {
          await AsyncStorage.setItem(
            perCatKey,
            serializePlacementDone()
          ).catch(() => {});
        }
        if (decision.shouldWriteLegacyMigrationSentinel) {
          await AsyncStorage.setItem(
            PLACEMENT_LEGACY_MIGRATION_KEY,
            serializePlacementDone()
          ).catch(() => {});
        }
        if (!cancelled) {
          setShowOnboarding(shouldShowOnboarding(onboardingRaw));
          setShowPlacement(decision.shouldShowPlacement);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowOnboarding(false);
          setShowPlacement(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catKey]);

  // Contrast details are purely visual state and should not survive a category change.
  useEffect(() => {
    setIsContrastDetailsVisible(false);
  }, [categoryIndex]);

  const handleOnboardingDismiss = useCallback(async () => {
    try {
      await markOnboardingSeen();
    } catch {
      // Write failure: onboarding may reappear on next cold launch.
      // User continues in the current session.
    }
    setShowOnboarding(false);
  }, []);

  const handlePlacementComplete = useCallback(
    async (startTier: number) => {
      const perCatKey = buildPlacementStorageKey(catKey);
      setAllGroupsToTier(startTier);
      await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(
        () => {}
      );
      setShowPlacement(false);
    },
    [catKey, setAllGroupsToTier]
  );

  const handlePlacementSkip = useCallback(async () => {
    const perCatKey = buildPlacementStorageKey(catKey);
    await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(
      () => {}
    );
    setShowPlacement(false);
  }, [catKey]);

  const handleContrastDetailPairSelect = useCallback(
    (pair: Pair) => {
      if (selectContrastDetailPair(pair)) {
        setIsContrastDetailsVisible(false);
      }
    },
    [selectContrastDetailPair]
  );

  // Show PlacementTest if the user hasn't completed it yet.
  if (showPlacement === null || showOnboarding === null) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <Text style={{ color: theme.textSecondary }}>
          {translate(tKeys.loading)}
        </Text>
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDismiss={handleOnboardingDismiss} />;
  }

  if (showPlacement) {
    return (
      <PlacementTest
        pairs={catObj.pairs}
        onComplete={handlePlacementComplete}
        onSkip={handlePlacementSkip}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PracticeHeader
        title={translate(tKeys.practicePairs)}
        helpAccessibilityLabel={translate(tKeys.helpLabel)}
        onHelpPress={() => setIsHelpVisible(true)}
        primaryColor={theme.primary}
        styles={styles}
      />

      <SessionTimer timerRef={timerRef} />

      <View style={styles.mainCard}>
        <View style={styles.contrastHeader}>
          <Text accessibilityRole="header" style={styles.contrastTitle}>
            {contrastTrainingTitle}
          </Text>
          {selectedPair && (
            <LevelIndicator
              currentTier={mastery[selectedPair.group] ?? 1}
              showCriteria
            />
          )}
          {selectedPair && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setIsContrastDetailsVisible(true)}
              style={styles.contrastDetailsButton}
            >
              <Ionicons
                name="information-circle-outline"
                size={17}
                color={theme.primary}
              />
              <Text style={styles.contrastDetailsButtonText}>
                {translate(tKeys.viewContrastDetails)}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.contrastInstruction}>
            {translate(tKeys.listenForSoundDifference)}
          </Text>
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
          styles={styles}
        />

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={playedIdx === null || feedback !== null}
            playedIdx={playedIdx}
            onCompareWord={handleCompareWord}
            compareDisabled={!audioModeReady || isSpeaking}
          />
        )}

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
