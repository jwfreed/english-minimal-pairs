// D9: critical first-run content must stay reachable when text is enlarged or
// the screen is short. These flows scroll instead of clipping, and nothing in
// the app disables or caps font scaling to make layouts fit. (Placement and
// Practice reachability is asserted in their own renderer suites.)
const assert = require('assert');
const fs = require('fs');
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

const sharedMocks = {
  'react-native': {
    View: 'View',
    Text: 'Text',
    ScrollView: 'ScrollView',
    TouchableOpacity: 'TouchableOpacity',
    StyleSheet: { create: (styles) => styles },
  },
  '@/src/context/theme': { useAllThemeColors: () => new Proxy({}, { get: () => '#000000' }) },
  '@/src/context/LanguageContext': { useLanguage: () => ({ translate: (key) => key }) },
  '@/src/hooks/useAppStyles': { useAppStyles: () => new Proxy({}, { get: (_target, name) => ({ name }) }) },
  '@/src/constants/styles': {
    __esModule: true,
    default: () => new Proxy({}, { get: (_target, name) => ({ name }) }),
  },
  '@/src/components/ThemedText': { ThemedText: 'Text' },
};

function render(relativePath, props) {
  const { default: Component } = loadTsModule(
    path.join(ROOT, relativePath),
    new Map(),
    sharedMocks
  );
  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(React.createElement(Component, props));
  });
  return root;
}

function assertScrollsAround(root, controls, label) {
  const [scroll] = root.root.findAllByType('ScrollView');
  assert.ok(scroll, `${label} must render inside a ScrollView`);
  const content = Object.assign({}, ...[scroll.props.contentContainerStyle].flat(Infinity));
  assert.notStrictEqual(content.flex, 1, `${label}: flex: 1 would cap content at the viewport`);
  assert.ok(controls.length > 0, `${label}: expected critical controls`);
  for (const control of controls) {
    let node = control;
    while (node && node !== scroll) node = node.parent;
    assert.strictEqual(node, scroll, `${label}: control must be inside the scroll view`);
  }
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
  runTest('onboarding scrolls so its continue action cannot be clipped', () => {
    const root = render('src/components/OnboardingScreen.tsx', { onDismiss: async () => {} });
    const cta = root.root
      .findAllByType('TouchableOpacity')
      .filter((node) => node.props.accessibilityLabel === 'onboardingCTA');
    assertScrollsAround(root, cta, 'onboarding');
    assert.strictEqual(
      root.root.findAllByType('ScrollView')[0].props.contentContainerStyle.name,
      'scrollContent'
    );
    TestRenderer.act(() => root.unmount());
  });

  runTest('the learner-language picker scrolls so every language stays reachable', () => {
    const root = render('src/components/LearnerLanguagePicker.tsx', { onSelect: () => {} });
    const options = root.root.findAllByType('TouchableOpacity');
    assert.strictEqual(options.length, 14);
    assertScrollsAround(root, options, 'learner-language picker');
    TestRenderer.act(() => root.unmount());
  });

  runTest('no app source disables or caps font scaling', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (/allowFontScaling=\{false\}|allowFontScaling:\s*false|maxFontSizeMultiplier/.test(source)) {
            offenders.push(path.relative(ROOT, full));
          }
        }
      }
    };
    walk(path.join(ROOT, 'src'));
    walk(path.join(ROOT, 'app'));
    assert.deepStrictEqual(offenders, []);
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
