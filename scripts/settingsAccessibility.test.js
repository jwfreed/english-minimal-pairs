// D7 + M5: Settings controls expose the native accessibility semantics of what
// they actually do, and the learner-language control is distinct from the UI
// language and never implies a choice that was not made. Real React render.
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

const host = (name) => ({ __esModule: true, default: name });
const plain = (value) => JSON.parse(JSON.stringify(value));

function mountSettings({ isCategoryResolved, categoryIndex = 2, themeMode = 'dark' }) {
  const calls = { selected: [], refreshed: 0, toggledVoices: [], themes: [], englishUI: [] };
  const storage = {
    async getItem() {
      return null;
    },
    async setItem() {},
    async removeItem() {},
  };
  const { default: SettingsScreen } = loadTsModule(
    path.join(ROOT, 'app', '(tabs)', 'settings.tsx'),
    new Map(),
    {
      'react-native': {
        View: 'View',
        Text: 'Text',
        ScrollView: 'ScrollView',
        TouchableOpacity: 'TouchableOpacity',
        ActivityIndicator: 'ActivityIndicator',
        StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
        Alert: { alert: () => {} },
        useWindowDimensions: () => ({ width: 390, height: 844 }),
      },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '@react-native-async-storage/async-storage': storage,
      '@/src/components/ui/AnimatedToggle': host('AnimatedToggle'),
      '@/src/components/ui/FlashPressable': host('FlashPressable'),
      '@/src/dev/ContrastKnowledgeInspectionSection': {
        ContrastKnowledgeInspectionSection: 'ContrastKnowledgeInspectionSection',
      },
      '@/src/context/SettingsContext': {
        useSettings: () => ({
          allVoices: [
            { identifier: 'voice.a', name: 'Ava', language: 'en-US', quality: 'Enhanced' },
            { identifier: 'voice.b', name: 'Ben', language: 'en-GB', quality: 'Default' },
          ],
          voiceCount: 1,
          excludedVoiceIds: new Set(['voice.b']),
          toggleVoice: (id) => calls.toggledVoices.push(id),
          isLoadingVoices: false,
          refreshVoices: () => {
            calls.refreshed += 1;
          },
        }),
      },
      '@/src/context/LanguageContext': {
        useLanguage: () => ({
          translate: (key) => key,
          useEnglishUI: true,
          setUseEnglishUI: (value) => calls.englishUI.push(value),
          language: 'English',
        }),
      },
      '@/src/context/CategoryContext': {
        useCategory: () => ({
          categoryIndex,
          isCategoryResolved,
          selectLearnerCategory: (index) => calls.selected.push(index),
        }),
      },
      '@/src/context/theme': {
        useAllThemeColors: () => new Proxy({}, { get: () => '#000000' }),
        useTheme: () => ({
          themeMode,
          setThemeMode: (mode) => calls.themes.push(mode),
        }),
      },
      '@/src/constants/styles': {
        __esModule: true,
        default: () => new Proxy({}, { get: () => ({}) }),
      },
      '@/src/hooks/useHaptics': { useHaptics: () => ({ triggerHaptic: () => {} }) },
    }
  );

  let root;
  TestRenderer.act(() => {
    root = TestRenderer.create(React.createElement(SettingsScreen));
  });
  const pressables = () => root.root.findAllByType('FlashPressable');
  const byRole = (role) =>
    root.root.findAll(
      (node) => typeof node.type === 'string' && node.props.accessibilityRole === role
    );
  const headerFor = (title) =>
    pressables().find((node) =>
      node.findAllByType('Text').some((text) => text.props.children === title)
    );
  // Some handlers are async; never hand their promise to a synchronous act().
  const press = (node) =>
    TestRenderer.act(() => {
      node.props.onPress();
    });
  const texts = (node) => node.findAllByType('Text').map((text) => text.props.children);
  return { root, calls, pressables, byRole, headerFor, press, texts };
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
  runTest('section headers report their expanded state', () => {
    const view = mountSettings({ isCategoryResolved: true });
    for (const title of ['learnerLanguage', 'appearance', 'voiceSelection']) {
      const header = view.headerFor(title);
      assert.strictEqual(header.props.accessibilityRole, 'button', title);
      assert.deepStrictEqual(plain(header.props.accessibilityState), { expanded: false }, title);
      view.press(header);
      assert.deepStrictEqual(plain(view.headerFor(title).props.accessibilityState),
        { expanded: true },
        title
      );
    }
  });

  runTest('learner-language options are a single-choice group with the choice checked', () => {
    const view = mountSettings({ isCategoryResolved: true, categoryIndex: 2 });
    view.press(view.headerFor('learnerLanguage'));
    assert.strictEqual(view.byRole('radiogroup').length, 1);
    const radios = view.byRole('radio');
    assert.strictEqual(radios.length, 14);
    assert.deepStrictEqual(
      radios.map((radio) => radio.props.accessibilityState.checked),
      radios.map((_, index) => index === 2)
    );
    view.press(radios[5]);
    assert.deepStrictEqual(view.calls.selected, [5]);
  });

  runTest('an unresolved learner language shows no implied choice', () => {
    const view = mountSettings({ isCategoryResolved: false, categoryIndex: 0 });
    const header = view.headerFor('learnerLanguage');
    assert.ok(view.texts(header).includes('chooseLearnerLanguage'));
    view.press(header);
    assert.ok(view.byRole('radio').every((radio) => radio.props.accessibilityState.checked === false));
    assert.ok(
      view.root.root
        .findAllByType('Text')
        .some((text) => text.props.children === 'learnerLanguageHint')
    );
  });

  runTest('the English UI row is a switch reporting its state', () => {
    const view = mountSettings({ isCategoryResolved: true });
    const [toggle] = view.byRole('switch');
    assert.ok(view.texts(toggle).includes('useEnglishUI'));
    assert.deepStrictEqual(plain(toggle.props.accessibilityState), { checked: true });
  });

  runTest('theme modes are a single-choice group with the saved mode checked', () => {
    const view = mountSettings({ isCategoryResolved: true, themeMode: 'dark' });
    view.press(view.headerFor('appearance'));
    const radios = view.byRole('radio');
    assert.deepStrictEqual(
      radios.map((radio) => [view.texts(radio)[0], radio.props.accessibilityState.checked]),
      [
        ['systemMode', false],
        ['lightMode', false],
        ['darkMode', true],
      ]
    );
  });

  runTest('voices are checkboxes and refresh is a separately reachable labelled button', () => {
    const view = mountSettings({ isCategoryResolved: true });
    view.press(view.headerFor('voiceSelection'));
    assert.deepStrictEqual(
      view.byRole('checkbox').map((row) => row.props.accessibilityState.checked),
      [true, false]
    );
    const refresh = view.root.root
      .findAllByType('TouchableOpacity')
      .find((node) => node.props.accessibilityLabel === 'refresh');
    assert.ok(refresh, 'refresh button needs an accessible label');
    assert.strictEqual(refresh.props.accessibilityRole, 'button');
    for (let node = refresh.parent; node; node = node.parent) {
      assert.notStrictEqual(node.type, 'FlashPressable', 'refresh must not be nested in the header');
    }
    view.press(refresh);
    assert.strictEqual(view.calls.refreshed, 1);
  });

  runTest('retaking placement is exposed as a button', () => {
    const view = mountSettings({ isCategoryResolved: true });
    assert.strictEqual(view.headerFor('placementTest').props.accessibilityRole, 'button');
  });
} finally {
  Object.assign(globalThis, previousGlobals);
}
