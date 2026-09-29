// M5: the learner's L1 background (training inventory) is resolved only by an
// explicit choice. UI-language fallback from the device locale must never
// select an inventory, and nothing category-dependent runs before resolution.
// Rendered through real React with the real Language/Category providers.
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

const { minimalPairs } = loadTsModule(
  path.join(ROOT, 'src', 'constants', 'minimalPairs.ts')
);

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    failReads: false,
    async getItem(key) {
      reads.push(key);
      if (this.failReads) throw new Error('storage unavailable');
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

function locale(tag) {
  const [languageCode, regionCode] = tag.split('-');
  return { languageCode, regionCode, languageTag: tag };
}

async function flush() {
  await TestRenderer.act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

async function mountProviders({ tag, storage }) {
  const cache = new Map();
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    'expo-localization': { getLocales: () => [locale(tag)] },
  };
  const { LanguageProvider, useLanguage } = loadTsModule(
    path.join(ROOT, 'src', 'context', 'LanguageContext.tsx'),
    cache,
    mocks
  );
  const { CategoryProvider, useCategory } = loadTsModule(
    path.join(ROOT, 'src', 'context', 'CategoryContext.tsx'),
    cache,
    mocks
  );
  const renders = [];
  const view = { renders, latest: null };
  function Probe() {
    const language = useLanguage();
    const category = useCategory();
    view.latest = { ...language, ...category };
    renders.push({
      status: language.learnerLanguageStatus,
      language: language.language,
      category: minimalPairs[category.categoryIndex].category,
      isCategoryResolved: category.isCategoryResolved,
    });
    return null;
  }
  let root;
  await TestRenderer.act(async () => {
    root = TestRenderer.create(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(CategoryProvider, null, React.createElement(Probe))
      )
    );
  });
  await flush();
  view.uiLanguage = () => view.latest.uiLanguage;
  view.inventory = () => minimalPairs[view.latest.categoryIndex].category;
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
  await runTest('fresh en-US install uses an English UI without selecting any inventory', async () => {
    const storage = createStorage();
    const view = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(view.renders[0].status, 'loading');
    assert.strictEqual(view.renders[0].isCategoryResolved, false);
    assert.strictEqual(view.latest.learnerLanguageStatus, 'unresolved');
    assert.strictEqual(view.latest.isCategoryResolved, false);
    assert.strictEqual(view.uiLanguage(), 'English');
    assert.notStrictEqual(view.latest.language, '日本語');
    assert.strictEqual(storage.values.has('@userLanguage'), false);
    view.unmount();
  });

  await runTest('unsupported locales fall back to an English UI but stay unresolved', async () => {
    for (const tag of ['fr-FR', 'de-DE', 'sw-KE']) {
      const storage = createStorage();
      const view = await mountProviders({ tag, storage });
      assert.strictEqual(view.latest.learnerLanguageStatus, 'unresolved', tag);
      assert.strictEqual(view.latest.isCategoryResolved, false, tag);
      assert.strictEqual(view.uiLanguage(), 'English', tag);
      assert.strictEqual(storage.values.has('@userLanguage'), false, tag);
      view.unmount();
    }
  });

  await runTest('a supported non-English locale localizes the UI but still needs confirmation', async () => {
    const storage = createStorage();
    const view = await mountProviders({ tag: 'ja-JP', storage });
    assert.strictEqual(view.uiLanguage(), '日本語');
    assert.strictEqual(view.latest.learnerLanguageStatus, 'unresolved');
    assert.strictEqual(view.latest.isCategoryResolved, false);
    assert.strictEqual(storage.values.has('@userLanguage'), false);
    view.unmount();
  });

  await runTest('a persisted explicit choice loads as the resolved inventory', async () => {
    const storage = createStorage({ '@userLanguage': 'ภาษาไทย' });
    const view = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(view.latest.learnerLanguageStatus, 'resolved');
    assert.strictEqual(view.latest.isCategoryResolved, true);
    assert.strictEqual(view.inventory(), 'ภาษาไทย');
    // Until the stored choice is read, no render claims a resolved category.
    const firstResolved = view.renders.findIndex((render) => render.isCategoryResolved);
    assert.ok(firstResolved > 0);
    assert.ok(
      view.renders.every(
        (render) => !render.isCategoryResolved || render.category === 'ภาษาไทย'
      )
    );
    view.unmount();
  });

  await runTest('legacy migrated choices still resolve and a stored non-inventory value does not', async () => {
    const migrated = createStorage({ '@userLanguage': 'idioma español' });
    const migratedView = await mountProviders({ tag: 'es-MX', storage: migrated });
    assert.strictEqual(migratedView.latest.learnerLanguageStatus, 'resolved');
    assert.strictEqual(migratedView.inventory(), 'Español');
    migratedView.unmount();

    const english = createStorage({ '@userLanguage': 'English' });
    const englishView = await mountProviders({ tag: 'en-US', storage: english });
    assert.strictEqual(englishView.latest.learnerLanguageStatus, 'unresolved');
    assert.strictEqual(englishView.latest.isCategoryResolved, false);
    englishView.unmount();
  });

  await runTest('an explicit choice resolves atomically and persists', async () => {
    const storage = createStorage();
    const view = await mountProviders({ tag: 'en-US', storage });
    const spanish = minimalPairs.findIndex((category) => category.category === 'Español');
    const rendersBefore = view.renders.length;
    await TestRenderer.act(async () => {
      view.latest.selectLearnerCategory(spanish);
    });
    await flush();
    assert.strictEqual(view.latest.learnerLanguageStatus, 'resolved');
    assert.strictEqual(view.latest.isCategoryResolved, true);
    assert.strictEqual(view.inventory(), 'Español');
    assert.strictEqual(storage.values.get('@userLanguage'), 'Español');
    // No intermediate render pairs a resolved language with another inventory.
    for (const render of view.renders.slice(rendersBefore)) {
      if (render.isCategoryResolved) assert.strictEqual(render.category, 'Español');
    }
    view.unmount();
  });

  await runTest('unreadable language preferences leave the learner able to choose', async () => {
    const storage = createStorage();
    storage.failReads = true;
    const view = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(view.latest.learnerLanguageStatus, 'unresolved');
    assert.strictEqual(view.latest.isCategoryResolved, false);
    view.unmount();
  });

  await runTest('choosing a native language never changes the UI language, now or after restart', async () => {
    const thai = minimalPairs.findIndex((candidate) => candidate.category === 'ภาษาไทย');
    for (const [tag, expectedUI] of [
      ['fr-FR', 'English'],
      ['sw-KE', 'English'],
      ['en-US', 'English'],
      ['ja-JP', '日本語'],
      ['th-TH', 'ภาษาไทย'],
    ]) {
      const storage = createStorage();
      const fresh = await mountProviders({ tag, storage });
      assert.strictEqual(fresh.uiLanguage(), expectedUI, `${tag} fresh`);
      await TestRenderer.act(async () => {
        fresh.latest.selectLearnerCategory(thai);
      });
      await flush();
      assert.strictEqual(fresh.inventory(), 'ภาษาไทย', `${tag} inventory`);
      assert.strictEqual(fresh.uiLanguage(), expectedUI, `${tag} after choice`);
      fresh.unmount();

      // Restart with the persisted choice.
      const restarted = await mountProviders({ tag, storage });
      assert.strictEqual(restarted.latest.learnerLanguageStatus, 'resolved', tag);
      assert.strictEqual(restarted.inventory(), 'ภาษาไทย', `${tag} inventory after restart`);
      assert.strictEqual(restarted.uiLanguage(), expectedUI, `${tag} after restart`);
      restarted.unmount();
    }
  });

  await runTest('a persisted native language keeps the device UI language', async () => {
    const storage = createStorage({ '@userLanguage': '한국어' });
    const view = await mountProviders({ tag: 'es-MX', storage });
    assert.strictEqual(view.inventory(), '한국어');
    assert.strictEqual(view.uiLanguage(), 'Español');
    view.unmount();
  });

  await runTest('on an English phone the switch turns off to the native-language interface and persists', async () => {
    const storage = createStorage({ '@userLanguage': 'ภาษาไทย' });
    const view = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(view.uiLanguage(), 'English');
    assert.strictEqual(view.latest.useEnglishUI, true);

    // The reported defect: turning the switch off must actually take effect.
    await TestRenderer.act(async () => {
      view.latest.setUseEnglishUI(!view.latest.useEnglishUI);
    });
    assert.strictEqual(view.uiLanguage(), 'ภาษาไทย');
    assert.strictEqual(view.latest.useEnglishUI, false);
    view.unmount();

    const restarted = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(restarted.uiLanguage(), 'ภาษาไทย');
    await TestRenderer.act(async () => {
      restarted.latest.setUseEnglishUI(!restarted.latest.useEnglishUI);
    });
    assert.strictEqual(restarted.uiLanguage(), 'English');
    restarted.unmount();
  });

  await runTest('on a non-English phone the switch chooses English or the native language', async () => {
    const storage = createStorage({ '@userLanguage': 'ภาษาไทย' });
    const view = await mountProviders({ tag: 'ja-JP', storage });
    // Until the switch is used, the interface follows the phone.
    assert.strictEqual(view.uiLanguage(), '日本語');
    assert.strictEqual(view.latest.useEnglishUI, false);

    await TestRenderer.act(async () => {
      view.latest.setUseEnglishUI(true);
    });
    assert.strictEqual(view.uiLanguage(), 'English');
    await TestRenderer.act(async () => {
      view.latest.setUseEnglishUI(false);
    });
    assert.strictEqual(view.uiLanguage(), 'ภาษาไทย');
    view.unmount();

    const restarted = await mountProviders({ tag: 'ja-JP', storage });
    assert.strictEqual(restarted.uiLanguage(), 'ภาษาไทย');
    assert.strictEqual(restarted.inventory(), 'ภาษาไทย');
    restarted.unmount();
  });

  await runTest('with a native-language interface, choosing another native language updates it', async () => {
    const storage = createStorage({
      '@userLanguage': 'ภาษาไทย',
      '@useEnglishUI': 'false',
      '@manualEnglishUIToggle': 'true',
    });
    const view = await mountProviders({ tag: 'en-US', storage });
    assert.strictEqual(view.uiLanguage(), 'ภาษาไทย');
    const korean = minimalPairs.findIndex((candidate) => candidate.category === '한국어');
    await TestRenderer.act(async () => {
      view.latest.selectLearnerCategory(korean);
    });
    await flush();
    assert.strictEqual(view.uiLanguage(), '한국어');
    view.unmount();
  });

  await runTest('switching English off before choosing a native language keeps the phone interface', async () => {
    const storage = createStorage();
    const view = await mountProviders({ tag: 'en-US', storage });
    await TestRenderer.act(async () => {
      view.latest.setUseEnglishUI(false);
    });
    assert.strictEqual(view.latest.learnerLanguageStatus, 'unresolved');
    assert.strictEqual(view.uiLanguage(), 'English');
    view.unmount();
  });

  await runTest('an automatic English flag saved by older builds does not override the device', async () => {
    const storage = createStorage({
      '@userLanguage': 'ภาษาไทย',
      '@useEnglishUI': 'true',
    });
    const view = await mountProviders({ tag: 'th-TH', storage });
    assert.strictEqual(view.uiLanguage(), 'ภาษาไทย');
    view.unmount();
  });

  await runTest('entry-state initialization reads nothing until a category is resolved', async () => {
    const storage = createStorage({ '@placementDone': '1' });
    const { usePracticeEntryState } = loadTsModule(
      path.join(ROOT, 'src', 'hooks', 'usePracticeEntryState.ts'),
      new Map(),
      { '@react-native-async-storage/async-storage': storage }
    );
    const view = { latest: null };
    let categoryKey = null;
    function Probe() {
      view.latest = usePracticeEntryState(categoryKey);
      return null;
    }
    let root;
    await TestRenderer.act(async () => {
      root = TestRenderer.create(React.createElement(Probe));
    });
    await flush();
    assert.strictEqual(view.latest.isLoading, true);
    assert.strictEqual(view.latest.isPracticeReady, false);
    assert.deepStrictEqual(storage.reads, []);
    assert.deepStrictEqual(storage.writes, []);

    categoryKey = 'Español';
    await TestRenderer.act(async () => {
      root.update(React.createElement(Probe));
    });
    await flush();
    assert.strictEqual(view.latest.isLoading, false);
    // Legacy placement seeds only the explicitly chosen inventory.
    assert.strictEqual(storage.values.get('@placementDone_Español'), '1');
    assert.strictEqual(storage.values.has('@placementDone_日本語'), false);
    TestRenderer.act(() => root.unmount());
  });

  await runTest('Practice shows the L1 picker and starts nothing category-dependent while unresolved', async () => {
    const entryKeys = [];
    const selections = [];
    let language = { learnerLanguageStatus: 'unresolved' };
    let category = { categoryIndex: 0, isCategoryResolved: false };
    const hostComponent = (name) => ({ __esModule: true, default: name });
    const { default: HomeScreen } = loadTsModule(
      path.join(ROOT, 'app', '(tabs)', 'index.tsx'),
      new Map(),
      {
        'react-native': {
          View: 'View',
          Text: 'Text',
          ScrollView: 'ScrollView',
          TouchableOpacity: 'TouchableOpacity',
        },
        'expo-router': { useNavigation: () => ({ addListener: () => () => {} }) },
        '@/src/context/LanguageContext': {
          useLanguage: () => ({ translate: (key) => key, ...language }),
        },
        '@/src/context/CategoryContext': {
          useCategory: () => ({
            ...category,
            selectLearnerCategory: (index) => selections.push(index),
          }),
        },
        '@/src/hooks/usePracticeEntryState': {
          usePracticeEntryState: (key) => {
            entryKeys.push(key);
            return {
              showOnboarding: false,
              showPlacement: true,
              completeOnboarding: async () => {},
              completePlacement: async () => {},
              skipPlacement: async () => {},
              refreshEntryState: () => {},
              isLoading: key === null,
              isPracticeReady: false,
            };
          },
        },
        '@/src/hooks/usePracticeSession': {
          usePracticeSession: () => ({
            mastery: {},
            stableVisible: [],
            timerRef: { current: null },
            setPlacementLevels: () => {},
            handlePairChange: () => {},
          }),
        },
        '@/src/hooks/useNextContrastSuggestion': { useNextContrastSuggestion: () => null },
        '@/src/components/LearnerLanguagePicker': hostComponent('LearnerLanguagePicker'),
        '@/src/components/PlacementTest': hostComponent('PlacementTest'),
        '@/src/components/OnboardingScreen': hostComponent('OnboardingScreen'),
        '@/src/components/AnswerButtons': hostComponent('AnswerButtons'),
        '@/src/components/HelpOverlay': hostComponent('HelpOverlay'),
        '@/src/components/LevelIndicator': hostComponent('LevelIndicator'),
        '@/src/components/PlaybackFailureNotice': hostComponent('PlaybackFailureNotice'),
        '@/src/components/practice/ContrastDetailsModal': hostComponent('ContrastDetailsModal'),
        '@/src/components/practice/LevelUpCelebration': hostComponent('LevelUpCelebration'),
        '@/src/components/practice/ListenControls': hostComponent('ListenControls'),
        '@/src/components/practice/NextContrastSuggestion': hostComponent('NextContrastSuggestion'),
        '@/src/components/practice/PracticeHeader': hostComponent('PracticeHeader'),
        '@/src/components/practice/PracticePairSelector': hostComponent('PracticePairSelector'),
        '@/src/hooks/useAppStyles': { useAppStyles: () => new Proxy({}, { get: () => ({}) }) },
        '@/src/constants/styles': {
          __esModule: true,
          default: () => new Proxy({}, { get: () => ({}) }),
        },
        '@/src/context/theme': { useAllThemeColors: () => ({}) },
        '@/src/domain/contrast/contrastRegistry': {
          contrastRegistry: { getById: () => undefined },
        },
        '@/utils/contrastLabel': { buildContrastLabel: () => '' },
      }
    );

    let root;
    const render = () =>
      TestRenderer.act(() => {
        if (root) root.update(React.createElement(HomeScreen));
        else root = TestRenderer.create(React.createElement(HomeScreen));
      });
    const has = (type) => root.root.findAllByType(type).length > 0;

    render();
    assert.ok(has('LearnerLanguagePicker'));
    assert.ok(!has('PlacementTest') && !has('OnboardingScreen'));
    assert.ok(entryKeys.every((key) => key === null));
    root.root.findByType('LearnerLanguagePicker').props.onSelect(3);
    assert.deepStrictEqual(selections, [3]);

    language = { learnerLanguageStatus: 'loading' };
    render();
    assert.ok(!has('LearnerLanguagePicker') && !has('PlacementTest'));
    assert.ok(entryKeys.every((key) => key === null));

    // Resolved language but the category has not caught up: still gated.
    language = { learnerLanguageStatus: 'resolved' };
    render();
    assert.ok(!has('PlacementTest'));
    assert.ok(entryKeys.every((key) => key === null));

    category = { categoryIndex: 3, isCategoryResolved: true };
    render();
    assert.strictEqual(entryKeys.at(-1), minimalPairs[3].category);
    assert.ok(has('PlacementTest'));
    TestRenderer.act(() => root.unmount());
  });
  await runTest('Results shows no inventory until the learner language is resolved', async () => {
    const masteryReads = [];
    let language = { learnerLanguageStatus: 'loading' };
    let category = { categoryIndex: 0, isCategoryResolved: false };
    const thai = minimalPairs.findIndex((candidate) => candidate.category === 'ภาษาไทย');
    const { default: ResultsScreen } = loadTsModule(
      path.join(ROOT, 'app', '(tabs)', 'results.tsx'),
      new Map(),
      {
        'react-native': {
          View: 'View',
          Text: 'Text',
          StyleSheet: { create: (styles) => styles },
          useWindowDimensions: () => ({ width: 390, height: 844 }),
        },
        '@shopify/flash-list': { FlashList: 'FlashList' },
        'expo-router': { useNavigation: () => ({ addListener: () => () => {} }) },
        '@/src/context/PairProgressContext': { usePairProgress: () => ({ progress: {} }) },
        '@/src/context/theme': { useAllThemeColors: () => new Proxy({}, { get: () => '#000000' }) },
        '@/src/hooks/useAppStyles': { useAppStyles: () => new Proxy({}, { get: () => ({}) }) },
        '@/src/constants/styles': {
          __esModule: true,
          default: () => new Proxy({}, { get: () => ({}) }),
          getCardShadowStyles: () => ({}),
        },
        '@/src/context/LanguageContext': {
          useLanguage: () => ({ translate: (key) => key, ...language }),
        },
        '@/src/context/CategoryContext': { useCategory: () => category },
        '@/src/components/PairItem': { __esModule: true, default: 'PairItem' },
        '@/src/components/LevelIndicator': { __esModule: true, default: 'LevelIndicator' },
        '@/src/storage/progressStorage': { estimateActivePracticeTime: () => 0 },
        '@/src/hooks/useContrastPairs': {
          useContrastPairs: (pairs, categoryKey) => {
            masteryReads.push([pairs.length, categoryKey]);
            return { mastery: {}, refresh: () => {} };
          },
        },
      }
    );
    let root;
    const render = () =>
      TestRenderer.act(() => {
        if (root) root.update(React.createElement(ResultsScreen));
        else root = TestRenderer.create(React.createElement(ResultsScreen));
      });
    const texts = () =>
      root.root.findAllByType('Text').map((node) => [node.props.children].flat().join(''));

    render();
    assert.deepStrictEqual(texts(), ['loading']);
    assert.strictEqual(root.root.findAllByType('FlashList').length, 0);

    language = { learnerLanguageStatus: 'unresolved' };
    render();
    assert.deepStrictEqual(texts(), ['chooseLearnerLanguage', 'learnerLanguageHint']);
    assert.strictEqual(root.root.findAllByType('FlashList').length, 0);
    // No inventory — in particular not the placeholder Japanese one — is read.
    assert.ok(masteryReads.every(([count, key]) => count === 0 && key === ''));

    language = { learnerLanguageStatus: 'resolved' };
    category = { categoryIndex: thai, isCategoryResolved: true };
    render();
    assert.strictEqual(root.root.findAllByType('FlashList').length, 1);
    assert.deepStrictEqual(masteryReads.at(-1), [minimalPairs[thai].pairs.length, 'ภาษาไทย']);
    assert.ok(!texts().includes('chooseLearnerLanguage'));
    TestRenderer.act(() => root.unmount());
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
