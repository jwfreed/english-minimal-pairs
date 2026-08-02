const path = require('path');

const { createHookHarness } = require('./hookHarness');
const { loadTsModule } = require('../load-ts-module');

const ROOT = path.join(__dirname, '..', '..');
const practiceSessionPath = path.join(
  ROOT,
  'src',
  'domain',
  'practiceSession.ts'
);
const practiceSessionHookPath = path.join(
  ROOT,
  'src',
  'hooks',
  'usePracticeSession.ts'
);
const trialSchedulingPath = path.join(
  ROOT,
  'src',
  'domain',
  'practice',
  'trialScheduling.ts'
);

const plain = (value) => JSON.parse(JSON.stringify(value));

function createPracticeTrialSchedulingHarness(fixture) {
  const domain = loadTsModule(practiceSessionPath);
  const events = [];
  const categories = new Map(
    fixture.categories.map((category) => [category.category, category])
  );
  const masteryByCategory = Object.fromEntries(
    Object.entries(fixture.initialMastery).map(([category, mastery]) => [
      category,
      { ...mastery },
    ])
  );

  let currentCategory = categories.get(fixture.initialCategory);
  if (!currentCategory) {
    throw new Error(`Unknown initial category: ${fixture.initialCategory}`);
  }
  let categoryIndex = fixture.categories.indexOf(currentCategory);
  let targetGroup = null;
  let nowMs = fixture.clockStartMs;
  let randomIndex = 0;
  let contrastRevisionSetter = null;
  let currentResult = null;

  const record = (event) => events.push(plain(event));
  const buildPairId = (pair) =>
    pair ? domain.buildTrialPairId(pair) : null;

  const harness = createHookHarness({
    onStateChange({ next }) {
      if (next === 'correct' || next === 'incorrect') {
        record({ type: 'feedback-committed', feedback: next });
      }
    },
  });

  const controlledRandom = () => {
    if (randomIndex >= fixture.randomValues.length) {
      throw new Error(
        `Random fixture exhausted after ${fixture.randomValues.length} draws`
      );
    }
    const value = fixture.randomValues[randomIndex];
    record({ type: 'random-draw', index: randomIndex, value });
    randomIndex += 1;
    return value;
  };

  const controlledMath = Object.create(Math);
  Object.defineProperty(controlledMath, 'random', {
    value: controlledRandom,
  });

  class ControlledDate extends Date {
    static now() {
      return nowMs;
    }
  }

  const wrappedDomain = {
    ...domain,

    choosePlaybackForRound(input) {
      const decision = domain.choosePlaybackForRound(input);
      record({
        type: decision.startsNewRound ? 'round-started' : 'round-replayed',
        playedIdx: decision.playedIdx,
        randomValue: input.randomValue,
      });
      return decision;
    },

    selectNextTrialPair(input) {
      record({
        type: 'selection-input',
        activeGroup: input.activeGroup,
        eligiblePairIds: input.eligiblePairs.map(buildPairId),
        lastPairId: input.lastPairId ?? null,
        seenThisCycle: [...(input.seenThisCycle ?? [])],
        recentlyMissedPairId: input.recentlyMissedPairId ?? null,
      });
      const selectedPair = domain.selectNextTrialPair(input);
      record({
        type: 'selection-output',
        pairId: buildPairId(selectedPair),
      });
      return selectedPair;
    },

    advanceTrialCycleSeenIds(input) {
      const nextSeen = domain.advanceTrialCycleSeenIds(input);
      record({
        type: 'mark-scheduled-pair',
        pairId: buildPairId(input.selectedPair),
        seenBefore: [...(input.seenThisCycle ?? [])],
        seenAfter: [...nextSeen],
      });
      return nextSeen;
    },

    updateRecentMissState(input) {
      const nextState = domain.updateRecentMissState(input);
      record({
        type: 'recent-miss-updated',
        answeredPairId: input.answeredPairId,
        wasCorrect: input.wasCorrect,
        previous: input.state,
        next: nextState,
      });
      return nextState;
    },
  };

  const trialScheduling = loadTsModule(
    trialSchedulingPath,
    new Map(),
    { '@/src/domain/practiceSession': wrappedDomain }
  );
  const wrappedTrialScheduling = {
    ...trialScheduling,

    planNextTrial(input) {
      record({ type: 'trial-scheduling-query' });
      return trialScheduling.planNextTrial(input);
    },

    reduceTrialScheduling(state, event) {
      if (event.kind === 'round-started' || event.kind === 'trial-presented') {
        record({ type: `trial-scheduling-${event.kind}` });
      }
      return trialScheduling.reduceTrialScheduling(state, event);
    },
  };

  function useContrastPairs(pairs, categoryKey) {
    const [, setRevision] = harness.react.useState(0);
    contrastRevisionSetter = setRevision;
    const mastery = masteryByCategory[categoryKey] ?? {};
    const visible = harness.react.useMemo(
      () => domain.selectVisiblePairsByMastery(pairs, mastery),
      [pairs, mastery]
    );
    const promote = harness.react.useCallback(
      (group) => {
        const previousTier = masteryByCategory[categoryKey]?.[group] ?? 1;
        const promotedTier = Math.min(previousTier + 1, 6);
        masteryByCategory[categoryKey] = {
          ...(masteryByCategory[categoryKey] ?? {}),
          [group]: promotedTier,
        };
        record({
          type: 'mastery-promoted',
          category: categoryKey,
          group,
          previousTier,
          promotedTier,
        });
        setRevision((revision) => revision + 1);
      },
      [categoryKey]
    );
    const setAllGroupsToTier = harness.react.useCallback(
      (tier) => {
        masteryByCategory[categoryKey] = domain.buildMasteryForAllGroups(
          pairs,
          tier
        );
        setRevision((revision) => revision + 1);
      },
      [categoryKey, pairs]
    );

    return {
      visible,
      promote,
      mastery,
      setAllGroupsToTier,
      isLoading: false,
    };
  }

  const consumeTarget = () => {
    record({ type: 'target-consumed', group: targetGroup });
    targetGroup = null;
  };
  const recordAttempt = (pairId, correct, durationMin) => {
    record({
      type: 'attempt-recorded',
      pairId,
      correct,
      durationMin,
    });
  };
  const triggerHaptic = () => {};
  const getNextVoice = () => null;

  const practiceAnalytics = {
    practiceStarted({ contrast, masteryLevel }) {
      record({
        type: 'practice-started',
        contrast,
        masteryLevel,
      });
    },
    pairPresented({ pair, category }) {
      record({
        type: 'pair-presented',
        pairId: buildPairId(pair),
        category,
      });
    },
    answerSubmitted({ pair, correct, responseTimeMs }) {
      record({
        type: 'answer-submitted',
        pairId: buildPairId(pair),
        correct,
        responseTimeMs,
      });
    },
    comparisonOpened({ pair, chosenIndex, correctIndex, responseTimeMs }) {
      record({
        type: 'comparison-opened',
        pairId: buildPairId(pair),
        chosenIndex,
        correctIndex,
        responseTimeMs,
      });
    },
    pairSelected({ pair, category }) {
      record({
        type: 'pair-selected',
        pairId: buildPairId(pair),
        category,
      });
    },
  };

  function useAudio(selectedPair, rate) {
    const play = harness.react.useCallback(
      async (playedIdx) => {
        record({
          type: 'audio-played',
          pairId: buildPairId(selectedPair),
          playedIdx,
          rate,
        });
        if (!selectedPair) throw new Error('No pair selected');
      },
      [selectedPair, rate]
    );
    return {
      play,
      audioModeReady: true,
      isSpeaking: false,
    };
  }

  const moduleMocks = {
    react: harness.react,
    'react-native': {
      Alert: {
        alert(title, message) {
          record({ type: 'alert-shown', title, message });
        },
      },
    },
    '@/src/analytics/practiceAnalytics': { practiceAnalytics },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ translate: (key) => key }),
    },
    '@/src/context/PairProgressContext': {
      usePairProgress: () => ({ recordAttempt }),
    },
    '@/src/context/PracticeTargetContext': {
      usePracticeTarget: () => ({ targetGroup, consumeTarget }),
    },
    '@/src/context/SettingsContext': {
      useSettings: () => ({ getNextVoice }),
    },
    '@/src/domain/practiceSession': wrappedDomain,
    '@/src/domain/practice/trialScheduling': wrappedTrialScheduling,
    '@/src/hooks/useAudio': { useAudio },
    '@/src/hooks/useContrastPairs': { useContrastPairs },
    '@/src/hooks/useHaptics': {
      useHaptics: () => ({ triggerHaptic }),
    },
  };

  const quietConsole = {
    log() {},
    warn() {},
    error(error) {
      record({
        type: 'console-error',
        message: error instanceof Error ? error.message : String(error),
      });
    },
  };
  const usePracticeSession = loadTsModule(
    practiceSessionHookPath,
    new Map(),
    moduleMocks,
    {
      Math: controlledMath,
      Date: ControlledDate,
      console: quietConsole,
    }
  ).usePracticeSession;

  const renderHook = () =>
    usePracticeSession({
      categoryIndex,
      category: currentCategory,
      isPracticeReady: true,
    });

  function render() {
    currentResult = harness.renderUntilStable(renderHook);
    return currentResult;
  }

  function setCategory(categoryName) {
    const nextCategory = categories.get(categoryName);
    if (!nextCategory) throw new Error(`Unknown category: ${categoryName}`);
    currentCategory = nextCategory;
    categoryIndex = fixture.categories.indexOf(nextCategory);
  }

  function setTarget(group) {
    targetGroup = group;
  }

  function replaceMastery(categoryName, mastery, reason) {
    masteryByCategory[categoryName] = { ...mastery };
    record({
      type: 'mastery-replaced',
      category: categoryName,
      mastery,
      reason,
    });
    contrastRevisionSetter?.((revision) => revision + 1);
  }

  return {
    advanceClock(durationMs) {
      nowMs += durationMs;
    },
    buildPairId,
    events,
    get current() {
      return currentResult;
    },
    get mastery() {
      return plain(masteryByCategory[currentCategory.category] ?? {});
    },
    get nowMs() {
      return nowMs;
    },
    get randomDrawCount() {
      return randomIndex;
    },
    render,
    replaceMastery,
    setCategory,
    setTarget,
  };
}

module.exports = {
  createPracticeTrialSchedulingHarness,
  plain,
};
