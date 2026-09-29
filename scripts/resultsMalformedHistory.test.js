// D1: a Results pair card renders from well-formed attempts only, so a
// malformed stored entry can neither crash Results nor distort its numbers.
// Real React render of the real PairItem.
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

const { default: PairItem } = loadTsModule(
  path.join(ROOT, 'src', 'components', 'PairItem.tsx'),
  new Map(),
  {
    'react-native': { View: 'View', Text: 'Text' },
    './AccuracyTimeChart': { __esModule: true, default: 'AccuracyTimeChart' },
    '@react-native-async-storage/async-storage': {},
  }
);

function render(attempts) {
  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(
      React.createElement(PairItem, {
        item: { id: 'p', word1: 'rock', word2: 'lock', category: '日本語', group: 'rL' },
        stats: { attempts },
        translate: (key) =>
          key === 'correctOfWeighted' ? '{correct}/{total} · {weighted}%' : key,
        themeColors: new Proxy({}, { get: () => '#000000' }),
        styles: new Proxy({}, { get: () => ({}) }),
      })
    );
  });
  const texts = root.root
    .findAllByType('Text')
    .map((node) => [node.props.children].flat().join(''));
  const chart = root.root.findAllByType('AccuracyTimeChart')[0];
  const chartPoints = chart ? chart.props.practiceData.length : 0;
  TestRenderer.act(() => root.unmount());
  return { texts, chartPoints };
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
  runTest('a pair card with malformed history renders from its valid attempts only', () => {
    const valid = [
      { isCorrect: true, timestamp: 1000, durationMin: 0.5 },
      { isCorrect: false, timestamp: 2000, durationMin: 0.5 },
    ];
    const clean = render(valid);
    const mixed = render([null, valid[0], 7, { isCorrect: 'yes' }, valid[1], { timestamp: 'x' }]);
    assert.deepStrictEqual(mixed, clean);
    assert.strictEqual(mixed.chartPoints, 2);
  });

  runTest('a pair card whose history is entirely malformed shows as not yet practiced', () => {
    const { texts, chartPoints } = render([null, { isCorrect: true }]);
    assert.ok(texts.includes('notPracticedYet'));
    assert.strictEqual(chartPoints, 0);
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
