// Behavioral tests for PlacementTest's answer gate, rendered through real
// React. Only native primitives, contexts and the audio transport are mocked:
// the mocked play() resolves on submission, exactly as useAudio's does, and
// native outcomes are delivered through the observer it receives.
const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const placementPath = path.join(ROOT, 'src', 'components', 'PlacementTest.tsx');

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

const FAILURE_REASONS = [
  'playback-error',
  'playback-stopped',
  'start-timeout',
  'completion-timeout',
  'request-rejected',
];

function placementPairs() {
  const pairs = [];
  for (let difficulty = 1; difficulty <= 6; difficulty++) {
    for (const suffix of ['a', 'b']) {
      pairs.push({
        word1: `right${difficulty}${suffix}`,
        word2: `light${difficulty}${suffix}`,
        ipa1: '/raɪt/',
        ipa2: '/laɪt/',
        difficulty,
        group: 'rL',
        contrastPhoneme1: 'r',
        contrastPhoneme2: 'l',
      });
    }
  }
  return pairs;
}

function mountPlacement() {
  const plays = [];
  const alerts = [];
  const announcements = [];
  const completions = [];
  const timers = [];
  const audio = {
    audioModeReady: true,
    isSpeaking: false,
    async play(idx, observer) {
      plays.push({ idx, observer });
      if (audio.throwOnPlay) throw new Error('speech submission failed');
    },
  };
  const { default: PlacementTest } = loadTsModule(
    placementPath,
    new Map(),
    {
      'react-native': {
        View: 'View',
        Text: 'Text',
        ScrollView: 'ScrollView',
        TouchableOpacity: 'TouchableOpacity',
        ActivityIndicator: 'ActivityIndicator',
        Alert: { alert: (...args) => alerts.push(args) },
        AccessibilityInfo: {
          announceForAccessibility: (message) => announcements.push(message),
        },
      },
      '@/src/constants/styles': {
        __esModule: true,
        default: () => new Proxy({}, { get: () => ({}) }),
      },
      '@/src/context/theme': { useAllThemeColors: () => ({ error: 'red' }) },
      '@/src/context/SettingsContext': {
        useSettings: () => ({ getNextVoice: () => null }),
      },
      '@/src/context/LanguageContext': {
        useLanguage: () => ({ translate: (key) => key }),
      },
      '@/src/hooks/useAudio': { useAudio: () => audio },
    },
    {
      // Deterministic prompts: word 0 is always the played word.
      Math: Object.assign(Object.create(Math), { random: () => 0.1 }),
      setTimeout: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimeout: () => {},
      // The thrown-submission case logs by design; keep the test output clean.
      console: { ...console, error: () => {} },
    }
  );

  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(
      React.createElement(PlacementTest, {
        pairs: placementPairs(),
        onComplete: (tier) => completions.push(tier),
        onSkip: () => {},
      })
    );
  });

  const buttons = () => root.root.findAllByType('TouchableOpacity');
  const text = (node) =>
    node
      .findAllByType('Text')
      .map((child) => child.props.children)
      .flat()
      .join('');
  const view = {
    root,
    audio,
    plays,
    alerts,
    announcements,
    completions,
    playButton: () => buttons()[0],
    answerButtons: () => buttons().slice(1, 3),
    answersEnabled() {
      const states = view.answerButtons().map((button) => !button.props.disabled);
      assert.strictEqual(states[0], states[1], 'answer buttons disagree');
      return states[0];
    },
    progress: () =>
      root.root
        .findAllByType('Text')
        .map((node) => node.props.children)
        .find((children) => typeof children === 'string' && children.includes(' / ')),
    failureShown: () =>
      root.root
        .findAllByType('Text')
        .some((node) => text(node) === 'audioPlaybackFailed'),
    async press(button) {
      await TestRenderer.act(async () => {
        await button.props.onPress();
      });
    },
    async deliver(play, outcome) {
      await TestRenderer.act(async () => {
        play.observer?.({ requestId: `request-${plays.indexOf(play)}`, ...outcome });
      });
    },
    async advance() {
      await TestRenderer.act(async () => {
        timers.splice(0).forEach((fn) => fn());
      });
    },
    unmount() {
      TestRenderer.act(() => root.unmount());
    },
  };
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
  await runTest('submission and start alone never enable placement answers', async () => {
    const view = mountPlacement();
    assert.strictEqual(view.answersEnabled(), false);

    await view.press(view.playButton());
    assert.strictEqual(view.plays.length, 1);
    assert.strictEqual(typeof view.plays[0].observer, 'function');
    assert.strictEqual(view.answersEnabled(), false, 'submitted');

    await view.deliver(view.plays[0], { kind: 'started' });
    assert.strictEqual(view.answersEnabled(), false, 'started');

    await view.deliver(view.plays[0], { kind: 'completed' });
    assert.strictEqual(view.answersEnabled(), true, 'completed');
    view.unmount();
  });

  await runTest('failure, cancellation, timeout and rejection never authorize an answer', async () => {
    for (const reason of FAILURE_REASONS) {
      const view = mountPlacement();
      await view.press(view.playButton());
      await view.deliver(view.plays[0], { kind: 'started' });
      await view.deliver(view.plays[0], { kind: 'failed', reason });
      assert.strictEqual(view.answersEnabled(), false, reason);
      assert.strictEqual(view.failureShown(), true, reason);
      assert.strictEqual(view.playButton().props.disabled, false, reason);

      // Retry uses the same Play control and still requires completion.
      await view.press(view.playButton());
      assert.strictEqual(view.failureShown(), false, reason);
      assert.strictEqual(view.answersEnabled(), false, reason);
      await view.deliver(view.plays[1], { kind: 'completed' });
      assert.strictEqual(view.answersEnabled(), true, reason);
      view.unmount();
    }
  });

  await runTest('a failed replay does not leave answers enabled from an earlier playback', async () => {
    const view = mountPlacement();
    await view.press(view.playButton());
    await view.deliver(view.plays[0], { kind: 'completed' });
    assert.strictEqual(view.answersEnabled(), true);

    await view.press(view.playButton());
    assert.strictEqual(view.answersEnabled(), false, 'replay pending');
    await view.deliver(view.plays[1], { kind: 'failed', reason: 'playback-error' });
    assert.strictEqual(view.answersEnabled(), false, 'replay failed');
    view.unmount();
  });

  await runTest('a thrown submission reports the error and keeps answers disabled', async () => {
    const view = mountPlacement();
    view.audio.throwOnPlay = true;
    await view.press(view.playButton());
    assert.strictEqual(view.alerts.length, 1);
    assert.strictEqual(view.answersEnabled(), false);
    assert.strictEqual(view.failureShown(), true);
    view.unmount();
  });

  await runTest('an unheard item cannot be scored even if an answer press slips through', async () => {
    const view = mountPlacement();
    await view.press(view.playButton());
    await view.deliver(view.plays[0], { kind: 'failed', reason: 'start-timeout' });
    await view.press(view.answerButtons()[0]);
    await view.advance();
    assert.strictEqual(view.progress(), '1 / 10');

    await view.press(view.playButton());
    await view.press(view.answerButtons()[0]);
    await view.advance();
    assert.strictEqual(view.progress(), '1 / 10', 'submission only');
    view.unmount();
  });

  await runTest('a stale completion from a previous question cannot authorize the next', async () => {
    const view = mountPlacement();
    await view.press(view.playButton());
    const firstQuestionPlay = view.plays[0];
    await view.deliver(firstQuestionPlay, { kind: 'completed' });
    await view.press(view.answerButtons()[0]);
    await view.advance();
    assert.strictEqual(view.progress(), '2 / 10');

    await view.deliver(firstQuestionPlay, { kind: 'completed' });
    assert.strictEqual(view.answersEnabled(), false, 'before play');

    await view.press(view.playButton());
    await view.deliver(firstQuestionPlay, { kind: 'completed' });
    assert.strictEqual(view.answersEnabled(), false, 'while pending');

    await view.deliver(view.plays[1], { kind: 'completed' });
    assert.strictEqual(view.answersEnabled(), true);
    view.unmount();
  });

  await runTest('placement content scrolls so enlarged text cannot clip its controls', async () => {
    const view = mountPlacement();
    const [scroll] = view.root.root.findAllByType('ScrollView');
    assert.ok(scroll, 'placement must render inside a ScrollView');
    const content = Object.assign({}, ...[scroll.props.contentContainerStyle].flat(Infinity));
    assert.notStrictEqual(content.flex, 1, 'flex: 1 would cap content at the viewport');
    const controls = [view.playButton(), ...view.answerButtons()];
    for (const control of controls) {
      let node = control;
      while (node && node !== scroll) node = node.parent;
      assert.strictEqual(node, scroll, 'critical control must be inside the scroll view');
    }
    view.unmount();
  });

  await runTest('completed playback per question yields the normal placement result', async () => {
    const view = mountPlacement();
    for (let question = 1; question <= 10; question++) {
      assert.strictEqual(view.progress(), `${question} / 10`);
      await view.press(view.playButton());
      await view.deliver(view.plays.at(-1), { kind: 'completed' });
      await view.press(view.answerButtons()[0]);
      assert.strictEqual(view.answersEnabled(), false, 'answered');
      await view.advance();
    }
    // recommendPlacementTier caps a perfect placement at tier 4.
    assert.deepStrictEqual(view.completions, [4]);
    view.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
