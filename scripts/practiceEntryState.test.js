const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const hookPath = path.join(
  __dirname,
  '..',
  'src',
  'hooks',
  'usePracticeEntryState.ts'
);
const practiceScreenSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'),
  'utf8'
);
const entryHookSource = fs.readFileSync(hookPath, 'utf8');

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const writes = [];

  return {
    values,
    writes,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      values.set(key, value);
    },
  };
}

function createHookHarness() {
  const states = [];
  const effectDependencies = [];
  const effectCleanups = [];
  let stateIndex = 0;
  let effectIndex = 0;
  let pendingEffects = [];

  const react = {
    useState(initialValue) {
      const index = stateIndex++;
      if (states.length <= index) states[index] = initialValue;
      return [
        states[index],
        (nextValue) => {
          states[index] =
            typeof nextValue === 'function'
              ? nextValue(states[index])
              : nextValue;
        },
      ];
    },
    useCallback(callback) {
      return callback;
    },
    useEffect(effect, dependencies) {
      const index = effectIndex++;
      const previous = effectDependencies[index];
      const changed =
        !previous ||
        dependencies.some((dependency, dependencyIndex) =>
          !Object.is(dependency, previous[dependencyIndex])
        );
      if (changed) {
        pendingEffects.push({ effect, index });
        effectDependencies[index] = dependencies;
      }
    },
  };

  function render(renderHook) {
    stateIndex = 0;
    effectIndex = 0;
    pendingEffects = [];
    const result = renderHook();
    for (const { effect, index } of pendingEffects) {
      effectCleanups[index]?.();
      effectCleanups[index] = effect();
    }
    return result;
  }

  async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  return { react, render, settle };
}

function loadHook(storage, harness) {
  return loadTsModule(hookPath, new Map(), {
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
  }).usePracticeEntryState;
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
  await runTest('fresh entry shows onboarding and placement after initialization', async () => {
    const storage = createStorage();
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    let entry = harness.render(renderHook);
    assert.strictEqual(entry.isLoading, true);

    await harness.settle();
    entry = harness.render(renderHook);
    assert.strictEqual(entry.showOnboarding, true);
    assert.strictEqual(entry.showPlacement, true);
    assert.strictEqual(entry.isPracticeReady, false);
  });

  await runTest('stored onboarding and category placement are respected', async () => {
    const storage = createStorage({
      '@hasSeenOnboarding': 'true',
      '@placementDone_Thai': '1',
    });
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    const entry = harness.render(renderHook);

    assert.strictEqual(entry.showOnboarding, false);
    assert.strictEqual(entry.showPlacement, false);
    assert.strictEqual(entry.isPracticeReady, true);
  });

  await runTest('legacy placement migration seeds only the current category', async () => {
    const storage = createStorage({
      '@hasSeenOnboarding': 'true',
      '@placementDone': '1',
    });
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    const entry = harness.render(renderHook);

    assert.strictEqual(entry.showPlacement, false);
    assert.deepStrictEqual(storage.writes, [
      ['@placementDone_Thai', '1'],
      ['@placementDoneLegacyMigrated', '1'],
    ]);
  });

  await runTest('completing onboarding hides it and preserves the placement gate', async () => {
    const storage = createStorage();
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    let entry = harness.render(renderHook);
    await entry.completeOnboarding();
    entry = harness.render(renderHook);

    assert.strictEqual(storage.values.get('@hasSeenOnboarding'), 'true');
    assert.strictEqual(entry.showOnboarding, false);
    assert.strictEqual(entry.showPlacement, true);
    assert.strictEqual(entry.isPracticeReady, false);
  });

  await runTest('completing placement persists it and opens practice', async () => {
    const storage = createStorage({ '@hasSeenOnboarding': 'true' });
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    let entry = harness.render(renderHook);
    await entry.completePlacement();
    entry = harness.render(renderHook);

    assert.strictEqual(storage.values.get('@placementDone_Thai'), '1');
    assert.strictEqual(entry.showPlacement, false);
    assert.strictEqual(entry.isPracticeReady, true);
  });

  await runTest('skipping placement persists the same gate state and opens practice', async () => {
    const storage = createStorage({ '@hasSeenOnboarding': 'true' });
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    let entry = harness.render(renderHook);
    await entry.skipPlacement();
    entry = harness.render(renderHook);

    assert.strictEqual(storage.values.get('@placementDone_Thai'), '1');
    assert.strictEqual(entry.showPlacement, false);
    assert.strictEqual(entry.isPracticeReady, true);
  });

  await runTest('focus refresh observes a placement reset while the practice tab stays mounted', async () => {
    const storage = createStorage({
      '@hasSeenOnboarding': 'true',
      '@placementDone_Thai': '1',
      '@placementDoneLegacyMigrated': '1',
    });
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    let entry = harness.render(renderHook);
    assert.strictEqual(entry.showPlacement, false);

    // Settings resets the current category while this hook remains mounted.
    storage.values.delete('@placementDone_Thai');
    entry.refreshEntryState();
    entry = harness.render(renderHook);
    assert.strictEqual(entry.isLoading, true);

    await harness.settle();
    entry = harness.render(renderHook);
    assert.strictEqual(entry.showPlacement, true);
    assert.strictEqual(entry.isPracticeReady, false);
  });

  await runTest('entry write failures do not block completion in the current session', async () => {
    const storage = createStorage({ '@hasSeenOnboarding': 'true' });
    storage.setItem = async () => {
      throw new Error('storage unavailable');
    };
    const harness = createHookHarness();
    const usePracticeEntryState = loadHook(storage, harness);
    const renderHook = () => usePracticeEntryState('Thai');

    harness.render(renderHook);
    await harness.settle();
    let entry = harness.render(renderHook);
    await entry.completePlacement();
    entry = harness.render(renderHook);

    assert.strictEqual(entry.showPlacement, false);
    assert.strictEqual(entry.isPracticeReady, true);
  });

  await runTest('the screen composes entry flow without owning its persistence', () => {
    assert.ok(
      practiceScreenSource.includes('usePracticeEntryState(catKey)'),
      'practice screen must compose the entry-state hook'
    );
    for (const dependency of [
      'AsyncStorage',
      'ONBOARDING_SEEN_KEY',
      'PLACEMENT_DONE_KEY',
      'resolvePlacementStateForCategory',
    ]) {
      assert.ok(
        entryHookSource.includes(dependency),
        `entry hook must own persistence dependency: ${dependency}`
      );
      assert.ok(
        !practiceScreenSource.includes(dependency),
        `practice screen must not retain persistence dependency: ${dependency}`
      );
    }
    assert.ok(
      practiceScreenSource.indexOf('setAllGroupsToTier(startTier)') <
        practiceScreenSource.indexOf('await completePlacement()'),
      'placement completion must apply the recommended tier before opening practice'
    );
    assert.ok(
      practiceScreenSource.includes("navigation.addListener('focus', refreshEntryState)"),
      'practice tab focus must refresh persisted entry state'
    );
  });
})();
