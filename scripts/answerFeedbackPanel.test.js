// Renders AnswerButtons' feedback panel through real React. After a wrong
// answer the compare buttons carry the correction: each word is tagged as the
// learner's choice or the correct answer, keeps its answer-tile position, and
// shows its contrasting phoneme highlighted.
const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

const HIGHLIGHT = { highlight: true };
const pair = {
  word1: 'rake',
  word2: 'lake',
  ipa1: '/reɪk/',
  ipa2: '/leɪk/',
  difficulty: 4,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

const { default: AnswerButtons } = loadTsModule(
  path.join(ROOT, 'src', 'components', 'AnswerButtons.tsx'),
  new Map(),
  {
    'react-native': {
      View: 'View',
      Text: 'Text',
      TouchableOpacity: 'TouchableOpacity',
      Pressable: 'Pressable',
      AccessibilityInfo: { announceForAccessibility: () => {} },
      Animated: {
        View: 'AnimatedView',
        Value: class {},
        timing: () => ({ start: () => {} }),
      },
    },
    'react-native-reanimated': {
      __esModule: true,
      default: { View: 'ReanimatedView', Text: 'ReanimatedText' },
      useReducedMotion: () => true,
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '@/src/constants/styles': {
      __esModule: true,
      default: () =>
        new Proxy({}, { get: (_, key) => (key === 'feedbackHighlight' ? HIGHLIGHT : {}) }),
    },
    '@/src/constants/motion': {},
    '@/src/context/theme': {
      useAllThemeColors: () => ({ success: 'green', error: 'red', buttonText: 'white' }),
    },
    '@/src/hooks/useHaptics': { useHaptics: () => ({ triggerHaptic: () => {} }) },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ translate: (key) => key }),
    },
  }
);

function renderIncorrect(playedIdx) {
  const played = [];
  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(
      React.createElement(AnswerButtons, {
        pair,
        onAnswer: () => {},
        feedback: 'incorrect',
        playedIdx,
        onCompareWord: (idx) => played.push(idx),
      })
    );
  });
  const buttons = root.root.findAllByType('Pressable').map((button) => {
    const texts = button.findAllByType('Text');
    return {
      label: button.props.accessibilityLabel,
      tag: texts[0].props.children,
      highlighted: texts
        .filter((text) => text.props.style === HIGHLIGHT)
        .map((text) => text.props.children),
      press: () => TestRenderer.act(() => button.props.onPress()),
    };
  });
  return { root, buttons, played };
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
  runTest('compare buttons keep tile order and tag the correct word and the choice', () => {
    const { root, buttons } = renderIncorrect(1);
    assert.deepStrictEqual(
      buttons.map(({ label, tag }) => [label, tag]),
      [
        ['play rake, youChose', 'youChose'],
        ['play lake, correct', 'correct'],
      ]
    );
    TestRenderer.act(() => root.unmount());
  });

  runTest('each compare button highlights its own contrasting phoneme', () => {
    const { root, buttons } = renderIncorrect(0);
    assert.deepStrictEqual(
      buttons.map(({ highlighted }) => highlighted),
      [['r'], ['l']]
    );
    TestRenderer.act(() => root.unmount());
  });

  runTest('compare buttons play the word they show', () => {
    const { root, buttons, played } = renderIncorrect(0);
    buttons[1].press();
    buttons[0].press();
    assert.deepStrictEqual(played, [1, 0]);
    TestRenderer.act(() => root.unmount());
  });

  runTest('the repeated listening instruction and attempt rows are gone', () => {
    const { root } = renderIncorrect(0);
    const copy = root.root
      .findAllByType('Text')
      .flatMap((node) => [].concat(node.props.children));
    assert.ok(!copy.includes('listenForSoundDifference'));
    assert.strictEqual(copy.filter((text) => text === 'youChose').length, 1);
    TestRenderer.act(() => root.unmount());
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
