// useAppStyles reads the window width live, so iPad Split View / Slide Over
// switches between phone and tablet sizing instead of keeping the launch size.
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

const window = { width: 1024 };
const { Colors } = loadTsModule(path.join(ROOT, 'src', 'constants', 'Colors.ts'));
const { useAppStyles } = loadTsModule(
  path.join(ROOT, 'src', 'hooks', 'useAppStyles.ts'),
  new Map(),
  {
    'react-native': {
      StyleSheet: { create: (styles) => styles },
      useWindowDimensions: () => ({ width: window.width, height: 1366 }),
    },
    '@/src/context/theme': { useAllThemeColors: () => Colors.light },
  }
);

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
  runTest('styles follow the live window width across the tablet breakpoint', () => {
    const seen = [];
    function Probe() {
      seen.push(useAppStyles().answerTileWord.fontSize);
      return null;
    }
    let root;
    TestRenderer.act(() => {
      root = TestRenderer.create(React.createElement(Probe));
    });
    window.width = 375; // Slide Over
    TestRenderer.act(() => root.update(React.createElement(Probe)));
    window.width = 1024; // back to full screen
    TestRenderer.act(() => root.update(React.createElement(Probe)));
    TestRenderer.act(() => root.unmount());
    assert.deepStrictEqual(seen, [40, 28, 40]);
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
