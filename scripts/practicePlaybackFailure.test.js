// Renders the Practice screen through real React with the session hook
// mocked, proving the screen presents the playback lifecycle it is given:
// a failed prompt is explained and announced, retry stays on the existing
// Play control, and answers stay unavailable until playback completes.
const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const screenPath = path.join(ROOT, 'app', '(tabs)', 'index.tsx');

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

const pair = {
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

const hostComponent = (name) => ({ __esModule: true, default: name });

function sessionState(overrides) {
  return {
    activeGroupPairs: [pair],
    audioModeReady: true,
    canAnswer: false,
    contrastDetailPairs: [pair],
    feedback: null,
    handleAnswer: () => {},
    handleCompareWord: () => {},
    handleContrastDetailPairSelect: () => false,
    handlePairChange: () => {},
    handlePickerScrollEnd: () => {},
    handlePickerScrollStart: () => {},
    handlePlay: () => {},
    isLoading: false,
    isPromptPlaybackActive: false,
    isSpeaking: false,
    mastery: { rL: 1 },
    playbackFailureReason: null,
    playbackStatus: 'idle',
    playedIdx: null,
    promotedTier: null,
    safePairIndex: 0,
    selectedPair: pair,
    setAllGroupsToTier: () => {},
    stableVisible: [pair],
    timerRef: { current: null },
    ...overrides,
  };
}

function mountScreen() {
  const announcements = [];
  let session = sessionState({});
  const { default: HomeScreen } = loadTsModule(screenPath, new Map(), {
    'react-native': {
      View: 'View',
      Text: 'Text',
      TouchableOpacity: 'TouchableOpacity',
      AccessibilityInfo: {
        announceForAccessibility: (message) => announcements.push(message),
      },
    },
    'expo-router': {
      useNavigation: () => ({ addListener: () => () => {} }),
    },
    '@/src/hooks/usePracticeEntryState': {
      usePracticeEntryState: () => ({
        showOnboarding: false,
        showPlacement: false,
        completeOnboarding: () => {},
        completePlacement: async () => {},
        skipPlacement: () => {},
        refreshEntryState: () => {},
        isLoading: false,
        isPracticeReady: true,
      }),
    },
    '@/src/hooks/usePracticeSession': { usePracticeSession: () => session },
    '@/src/hooks/useNextContrastSuggestion': {
      useNextContrastSuggestion: () => null,
    },
    '@/src/components/AnswerButtons': hostComponent('AnswerButtons'),
    '@/src/components/HelpOverlay': hostComponent('HelpOverlay'),
    '@/src/components/LevelIndicator': hostComponent('LevelIndicator'),
    '@/src/components/OnboardingScreen': hostComponent('OnboardingScreen'),
    '@/src/components/PlacementTest': hostComponent('PlacementTest'),
    '@/src/components/practice/ContrastDetailsModal': hostComponent('ContrastDetailsModal'),
    '@/src/components/practice/LevelUpCelebration': hostComponent('LevelUpCelebration'),
    '@/src/components/practice/ListenControls': hostComponent('ListenControls'),
    '@/src/components/practice/NextContrastSuggestion': hostComponent('NextContrastSuggestion'),
    '@/src/components/practice/PracticeHeader': hostComponent('PracticeHeader'),
    '@/src/components/practice/PracticePairSelector': hostComponent('PracticePairSelector'),
    '@/src/constants/minimalPairs': {
      minimalPairs: [{ category: '日本語', pairs: [pair] }],
    },
    '@/src/constants/styles': {
      __esModule: true,
      default: () => new Proxy({}, { get: () => ({}) }),
    },
    '@/src/context/CategoryContext': { useCategory: () => ({ categoryIndex: 0 }) },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ translate: (key) => key }),
    },
    '@/src/context/theme': { useAllThemeColors: () => ({ error: 'red' }) },
    '@/src/domain/contrast/contrastRegistry': {
      contrastRegistry: { getById: () => undefined },
    },
    '@/utils/contrastLabel': { buildContrastLabel: () => 'r / l' },
  });

  let root;
  const render = (overrides) => {
    session = sessionState(overrides);
    TestRenderer.act(() => {
      if (root) root.update(React.createElement(HomeScreen));
      else root = TestRenderer.create(React.createElement(HomeScreen));
    });
  };
  const texts = () =>
    root.root
      .findAllByType('Text')
      .map((node) => [node.props.children].flat().join(''));
  const one = (type) => root.root.findByType(type);

  return {
    announcements,
    render,
    texts,
    notice: () =>
      root.root
        .findAllByType('Text')
        .find((node) => node.props.children === 'audioPlaybackFailed'),
    listenControls: () => one('ListenControls'),
    answerButtons: () => one('AnswerButtons'),
    unmount: () => TestRenderer.act(() => root.unmount()),
  };
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

try {
  runTest('a failed prompt is explained, announced, and retryable from Play', () => {
    const screen = mountScreen();
    let retries = 0;
    for (const reason of [
      'playback-error',
      'playback-stopped',
      'start-timeout',
      'completion-timeout',
      'request-rejected',
      'deferred-prompt-mismatch',
    ]) {
      screen.render({
        playbackStatus: 'failed',
        playbackFailureReason: reason,
        playedIdx: 0,
        handlePlay: () => {
          retries += 1;
        },
      });
      const notice = screen.notice();
      assert.ok(notice, reason);
      assert.strictEqual(notice.props.accessibilityRole, 'alert');
      assert.ok(!screen.texts().includes('listenForSoundDifference'), reason);
      assert.strictEqual(screen.answerButtons().props.disabled, true, reason);
      assert.strictEqual(screen.listenControls().props.disabled, false, reason);
      screen.listenControls().props.onPlay();
    }
    assert.strictEqual(retries, 6);
    assert.deepStrictEqual(screen.announcements, ['audioPlaybackFailed']);
    screen.unmount();
  });

  runTest('retrying clears the notice and keeps answers unavailable until completion', () => {
    const screen = mountScreen();
    screen.render({ playbackStatus: 'failed', playbackFailureReason: 'start-timeout', playedIdx: 0 });
    assert.ok(screen.notice());

    screen.render({ playbackStatus: 'loading', isPromptPlaybackActive: true, playedIdx: 0 });
    assert.strictEqual(screen.notice(), undefined);
    assert.ok(screen.texts().includes('listenForSoundDifference'));
    assert.strictEqual(screen.answerButtons().props.disabled, true);
    assert.strictEqual(screen.listenControls().props.disabled, true);

    screen.render({ playbackStatus: 'failed', playbackFailureReason: 'playback-error', playedIdx: 0 });
    assert.deepStrictEqual(screen.announcements, [
      'audioPlaybackFailed',
      'audioPlaybackFailed',
    ]);

    screen.render({ playbackStatus: 'awaiting-answer', canAnswer: true, playedIdx: 0 });
    assert.strictEqual(screen.notice(), undefined);
    assert.strictEqual(screen.answerButtons().props.disabled, false);
    screen.unmount();
  });

  runTest('normal listening shows the instruction and no failure notice', () => {
    const screen = mountScreen();
    screen.render({});
    assert.strictEqual(screen.notice(), undefined);
    assert.ok(screen.texts().includes('listenForSoundDifference'));
    assert.deepStrictEqual(screen.announcements, []);
    screen.unmount();
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
