// Replays real promotion flows through usePracticeSession with real React.
// Transport, contexts and analytics are mocked; useContrastPairs is replaced
// by an in-memory equivalent that derives visibility with the production
// selectVisiblePairsByMastery over practice tiers and the production level
// helper, so selection after promotion is exercised exactly as the practice
// screen consumes it.
const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const hookPath = path.join(ROOT, 'src', 'hooks', 'usePracticeSession.ts');
const { selectVisiblePairsByMastery } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'practiceSession.ts')
);
const { nextMasteryLevel, practiceTierMap } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'masteryLevel.ts')
);

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

// Promotion needs three fast streaks: speed 0 → 1 → 2 → next mastery tier.
const ANSWERS_PER_PROMOTION = 9;

function pairsFor(group, phoneme1, phoneme2) {
  const pairs = [];
  for (const difficulty of [1, 2, 6]) {
    for (const suffix of ['a', 'b']) {
      pairs.push({
        word1: `${phoneme1}${group}${difficulty}${suffix}`,
        word2: `${phoneme2}${group}${difficulty}${suffix}`,
        ipa1: `/${phoneme1}/`,
        ipa2: `/${phoneme2}/`,
        difficulty,
        group,
        contrastPhoneme1: phoneme1,
        contrastPhoneme2: phoneme2,
      });
    }
  }
  return pairs;
}

const category = {
  category: '日本語',
  pairs: [...pairsFor('rL', 'r', 'l'), ...pairsFor('bV', 'b', 'v')],
};

function mountSession(initialMastery) {
  const plays = [];
  const noop = () => {};
  const practiceStarted = [];
  const { usePracticeSession } = loadTsModule(hookPath, new Map(), {
    'react-native': { Alert: { alert: noop } },
    '@/src/analytics/practiceAnalytics': {
      practiceAnalytics: new Proxy(
        {},
        {
          get: (_target, name) =>
            name === 'practiceStarted'
              ? (event) => practiceStarted.push(event)
              : noop,
        }
      ),
    },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ translate: (key) => key }),
    },
    '@/src/context/PairProgressContext': {
      usePairProgress: () => ({ recordAttempt: noop }),
    },
    '@/src/context/SettingsContext': {
      useSettings: () => ({ getNextVoice: () => null }),
    },
    '@/src/hooks/useHaptics': { useHaptics: () => ({ triggerHaptic: noop }) },
    '@/src/hooks/useAudio': {
      useAudio: (selectedPair) => ({
        audioModeReady: true,
        isSpeaking: false,
        async play(idx, observer) {
          plays.push({ pair: selectedPair, idx, observer });
        },
      }),
    },
    '@/src/hooks/useContrastPairs': {
      useContrastPairs: (pairs) => {
        const [mastery, setMastery] = React.useState(initialMastery);
        const visible = React.useMemo(
          () => selectVisiblePairsByMastery(pairs, practiceTierMap(mastery)),
          [pairs, mastery]
        );
        return {
          visible,
          mastery,
          isLoading: false,
          promote: (group) =>
            setMastery((current) => ({
              ...current,
              [group]: nextMasteryLevel(current[group]),
            })),
          setPlacementLevels: noop,
        };
      },
    },
  });

  const view = { plays, practiceStarted, latest: null };
  function Probe() {
    view.latest = usePracticeSession({
      categoryIndex: 0,
      category,
      isPracticeReady: true,
    });
    return null;
  }
  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(React.createElement(Probe));
  });

  view.act = async (fn) => {
    await TestRenderer.act(async () => {
      await fn();
    });
  };
  view.selectGroup = async (group) => {
    const index = view.latest.stableVisible.findIndex((pair) => pair.group === group);
    await view.act(() => view.latest.handlePairChange(index));
  };
  view.answerCorrectly = async () => {
    await view.act(() => view.latest.handlePlay());
    const play = view.plays.at(-1);
    await view.act(() => play.observer({ kind: 'completed', requestId: 'r' }));
    assert.strictEqual(view.latest.canAnswer, true, 'playback completed');
    await view.act(() => view.latest.handleAnswer(view.latest.playedIdx));
  };
  view.unmount = () => TestRenderer.act(() => root.unmount());
  return view;
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

module.exports = (async () => {
  await runTest('promoting a non-first contrast (bV) keeps every presentation on that contrast', async () => {
    const view = mountSession({ rL: 1, bV: 1 });
    await view.selectGroup('bV');
    assert.strictEqual(view.latest.selectedPair.group, 'bV');

    for (let answer = 1; answer < ANSWERS_PER_PROMOTION; answer++) {
      await view.answerCorrectly();
      assert.strictEqual(view.latest.promotedLevel, null, `answer ${answer}`);
    }
    await view.answerCorrectly();

    const session = view.latest;
    assert.strictEqual(session.promotedLevel, 2);
    assert.strictEqual(session.mastery.bV, 2);
    assert.strictEqual(session.mastery.rL, 1);
    // Heading, level and details are all derived from selectedPair.group.
    assert.strictEqual(session.selectedPair.group, 'bV');
    assert.strictEqual(session.selectedPair.difficulty, 2);
    assert.ok(session.contrastDetailPairs.every((pair) => pair.group === 'bV'));
    assert.ok(session.activeGroupPairs.length > 0);
    assert.ok(
      session.activeGroupPairs.every(
        (pair) => pair.group === 'bV' && pair.difficulty === 2
      )
    );

    // The scheduler's next prompt comes from the same contrast and tier.
    await view.act(() => view.latest.handlePlay());
    const next = view.plays.at(-1).pair;
    assert.strictEqual(next.group, 'bV');
    assert.strictEqual(next.difficulty, 2);
    assert.strictEqual(view.latest.selectedPair.group, 'bV');
    view.unmount();
  });

  await runTest('promoting the first contrast still selects its new-tier examples', async () => {
    const view = mountSession({ rL: 1, bV: 1 });
    await view.selectGroup('rL');
    for (let answer = 0; answer < ANSWERS_PER_PROMOTION; answer++) {
      await view.answerCorrectly();
    }
    assert.strictEqual(view.latest.promotedLevel, 2);
    assert.strictEqual(view.latest.selectedPair.group, 'rL');
    assert.strictEqual(view.latest.selectedPair.difficulty, 2);
    view.unmount();
  });

  await runTest('completing the final tier masters the contrast exactly once', async () => {
    const view = mountSession({ rL: 1, bV: 6 });
    await view.selectGroup('bV');
    for (let answer = 1; answer < ANSWERS_PER_PROMOTION; answer++) {
      await view.answerCorrectly();
      assert.strictEqual(view.latest.promotedLevel, null, `answer ${answer}`);
    }
    await view.answerCorrectly();
    assert.strictEqual(view.latest.promotedLevel, 7);
    assert.strictEqual(view.latest.mastery.bV, 7);
    // Mastery keeps practice on the same contrast's tier-6 material.
    assert.strictEqual(view.latest.selectedPair.group, 'bV');
    assert.strictEqual(view.latest.selectedPair.difficulty, 6);

    for (let answer = 1; answer <= ANSWERS_PER_PROMOTION * 2; answer++) {
      await view.answerCorrectly();
      assert.strictEqual(view.latest.promotedLevel, null, `after mastery ${answer}`);
      assert.strictEqual(view.plays.at(-1).pair.difficulty, 6);
    }
    assert.strictEqual(view.latest.mastery.bV, 7);
    view.unmount();
  });

  await runTest('a mastered contrast stays mastered across remounts without new events', async () => {
    const view = mountSession({ rL: 1, bV: 7 });
    await view.selectGroup('bV');
    for (let answer = 1; answer <= ANSWERS_PER_PROMOTION * 2; answer++) {
      await view.answerCorrectly();
      assert.strictEqual(view.latest.promotedLevel, null, `answer ${answer}`);
    }
    assert.strictEqual(view.latest.mastery.bV, 7);
    assert.strictEqual(view.latest.selectedPair.difficulty, 6);
    // Analytics reports the practice tier, never level 7.
    assert.ok(view.practiceStarted.length > 0);
    assert.ok(
      view.practiceStarted.every((event) => event.masteryLevel <= 6),
      JSON.stringify(view.practiceStarted)
    );
    assert.ok(
      view.practiceStarted.some(
        (event) => event.contrast === 'bV' && event.masteryLevel === 6
      )
    );
    view.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
