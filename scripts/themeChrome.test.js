// D10: the saved app theme is the single source for content and chrome.
// Navigation theme, status bar and tab tint follow the saved preference, and
// follow the device scheme only in "system" mode — including live changes.
// Real React render of the real root/tab layouts and the real ThemeProvider.
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

const { Colors } = loadTsModule(path.join(ROOT, 'src', 'constants', 'Colors.ts'));

async function flush() {
  await TestRenderer.act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

async function mountApp({ device, saved }) {
  const env = { device, captured: {} };
  const values = new Map(saved ? [['@userThemePreference', saved]] : []);
  const storage = {
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
  const cache = new Map();
  const mocks = {
    'react-native': { useColorScheme: () => env.device },
    '@react-native-async-storage/async-storage': storage,
    '@react-navigation/native': {
      DarkTheme: { dark: true, colors: { primary: 'nav-dark' } },
      DefaultTheme: { dark: false, colors: { primary: 'nav-light' } },
      ThemeProvider: 'NavigationThemeProvider',
    },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native-reanimated': {},
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    '@expo-google-fonts/public-sans': {
      useFonts: () => [true, null],
      PublicSans_400Regular: 1,
      PublicSans_600SemiBold: 1,
      PublicSans_700Bold: 1,
      PublicSans_800ExtraBold: 1,
    },
    '@/src/analytics/masteryRolloutDiagnostics': { recordMasteryRolloutColdStart: () => {} },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'react-native-safe-area-context': {
      useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
    },
    '@/src/context/PairProgressContext': { PairProgressProvider: ({ children }) => children },
    '@/src/context/SettingsContext': { SettingsProvider: ({ children }) => children },
    '@/src/context/CategoryContext': { CategoryProvider: ({ children }) => children },
    '@/src/context/LanguageContext': {
      LanguageProvider: ({ children }) => children,
      useLanguage: () => ({ translate: (key) => key, language: 'English' }),
    },
  };
  const theme = loadTsModule(path.join(ROOT, 'src', 'context', 'theme.tsx'), cache, mocks);
  const { default: TabsLayout } = loadTsModule(
    path.join(ROOT, 'app', '(tabs)', '_layout.tsx'),
    cache,
    {
      ...mocks,
      'expo-router': {
        Tabs: Object.assign(
          function TabsMock({ screenOptions }) {
            env.captured.tabOptions = screenOptions({ route: { name: 'index' } });
            return null;
          },
          { Screen: 'TabsScreen' }
        ),
      },
    }
  );
  // The root Stack renders the tab layout and exposes the theme controls.
  function StackMock() {
    const { setThemeMode, themeMode } = theme.useTheme();
    env.captured.setThemeMode = setThemeMode;
    env.captured.themeMode = themeMode;
    return React.createElement(TabsLayout);
  }
  StackMock.Screen = 'StackScreen';
  const { default: RootLayout } = loadTsModule(
    path.join(ROOT, 'app', '_layout.tsx'),
    cache,
    { ...mocks, 'expo-router': { Stack: StackMock } }
  );

  let root;
  await TestRenderer.act(async () => {
    root = TestRenderer.create(React.createElement(RootLayout));
  });
  await flush();
  const chrome = () => ({
    navigation: root.root.findByType('NavigationThemeProvider').props.value.colors.background,
    statusBar: root.root.findByType('StatusBar').props.style,
    tabTint: env.captured.tabOptions.tabBarActiveTintColor,
  });
  return {
    env,
    chrome,
    rerender: async () => {
      await TestRenderer.act(async () => {
        root.update(React.createElement(RootLayout));
      });
      await flush();
    },
    setMode: async (mode) => {
      await TestRenderer.act(async () => {
        await env.captured.setThemeMode(mode);
      });
      await flush();
    },
    unmount: () => TestRenderer.act(() => root.unmount()),
  };
}

const LIGHT = {
  navigation: Colors.light.background,
  statusBar: 'dark',
  tabTint: Colors.light.primary,
};
const DARK = {
  navigation: Colors.dark.background,
  statusBar: 'light',
  tabTint: Colors.dark.primary,
};

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
  await runTest('a saved light preference gives light chrome on a dark device', async () => {
    const app = await mountApp({ device: 'dark', saved: 'light' });
    assert.deepStrictEqual(app.chrome(), LIGHT);
    app.unmount();
  });

  await runTest('a saved dark preference gives dark chrome on a light device', async () => {
    const app = await mountApp({ device: 'light', saved: 'dark' });
    assert.deepStrictEqual(app.chrome(), DARK);
    app.unmount();
  });

  await runTest('system mode follows the device scheme, including live device changes', async () => {
    const app = await mountApp({ device: 'light', saved: 'system' });
    assert.deepStrictEqual(app.chrome(), LIGHT);
    app.env.device = 'dark';
    await app.rerender();
    assert.deepStrictEqual(app.chrome(), DARK);
    app.unmount();
  });

  await runTest('tabs show no duplicate navigation header and keep content below the status bar', async () => {
    const app = await mountApp({ device: 'dark', saved: 'light' });
    const options = app.env.captured.tabOptions;
    assert.strictEqual(options.headerShown, false);
    assert.strictEqual(options.sceneStyle.paddingTop, 59);
    assert.strictEqual(options.sceneStyle.backgroundColor, Colors.light.background);
    app.unmount();
  });

  await runTest('changing the preference updates the chrome live without a remount', async () => {
    const app = await mountApp({ device: 'dark', saved: null });
    assert.strictEqual(app.env.captured.themeMode, 'system');
    assert.deepStrictEqual(app.chrome(), DARK);
    await app.setMode('light');
    assert.deepStrictEqual(app.chrome(), LIGHT);
    await app.setMode('dark');
    assert.deepStrictEqual(app.chrome(), DARK);
    // A saved override ignores later device changes.
    app.env.device = 'light';
    await app.rerender();
    assert.deepStrictEqual(app.chrome(), DARK);
    app.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
