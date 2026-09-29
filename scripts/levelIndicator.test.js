// Renders LevelIndicator through real React: reaching the final tier is
// labelled as that level in progress; only completing it (level 7) is
// labelled as contrast mastery.
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

const copy = {
  levelProgress: 'Level {level} of {total}',
  levelCompact: 'Lv {level}',
  levelCriteria: 'criteria',
  mastered: 'Contrast mastered',
};

const { default: LevelIndicator } = loadTsModule(
  path.join(ROOT, 'src', 'components', 'LevelIndicator.tsx'),
  new Map(),
  {
    'react-native': { View: 'View', Text: 'Text' },
    'react-native-reanimated': {
      __esModule: true,
      default: { View: 'ReanimatedView' },
      useReducedMotion: () => true,
    },
    '@/src/constants/styles': {
      __esModule: true,
      default: () => new Proxy({}, { get: () => ({}) }),
    },
    '@/src/constants/motion': { levelPopAnimation: {} },
    '@/src/context/theme': {
      useAllThemeColors: () => ({ accent: 'accent', track: 'grey', success: 'green' }),
    },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ translate: (key) => copy[key] ?? key }),
    },
  }
);

function labels(props) {
  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(React.createElement(LevelIndicator, props));
  });
  const texts = root.root.findAllByType('Text').map((node) => node.props.children);
  const filled = root.root
    .findAllByType('ReanimatedView')
    .filter((node) => node.props.style.some((style) => style?.backgroundColor === 'accent'))
    .length;
  TestRenderer.act(() => root.unmount());
  return { texts, filled };
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
  runTest('the final tier is labelled as the level being practiced, not mastery', () => {
    assert.deepStrictEqual(labels({ masteryLevel: 6, showCriteria: true }), {
      texts: ['Level 6 of 6', 'criteria'],
      filled: 6,
    });
    assert.deepStrictEqual(labels({ masteryLevel: 6, compact: true }).texts, ['Lv 6']);
  });

  runTest('completing the final tier is labelled as contrast mastery', () => {
    assert.deepStrictEqual(labels({ masteryLevel: 7, showCriteria: true }), {
      texts: ['✔ Contrast mastered'],
      filled: 6,
    });
    assert.deepStrictEqual(labels({ masteryLevel: 7, compact: true }), {
      texts: ['✔ Contrast mastered'],
      filled: 6,
    });
  });

  runTest('non-final tiers keep their existing labels', () => {
    assert.deepStrictEqual(labels({ masteryLevel: 3, showCriteria: true }), {
      texts: ['Level 3 of 6', 'criteria'],
      filled: 3,
    });
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
