const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const hookPath = path.join(ROOT, 'src', 'hooks', 'useContrastPairs.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    async getItem(key) {
      reads.push(key);
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

function createHookHarness() {
  const states = [];
  const refs = [];
  const effectDependencies = [];
  const effectCleanups = [];
  let stateIndex = 0;
  let refIndex = 0;
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
    useRef(initialValue) {
      const index = refIndex++;
      if (refs.length <= index) refs[index] = { current: initialValue };
      return refs[index];
    },
    useMemo(factory) {
      return factory();
    },
    useCallback(callback) {
      return callback;
    },
    useEffect(effect, dependencies) {
      const index = effectIndex++;
      const previous = effectDependencies[index];
      const changed =
        !previous ||
        dependencies.length !== previous.length ||
        dependencies.some(
          (dependency, dependencyIndex) =>
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
    refIndex = 0;
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

function japanesePairs() {
  return [
    {
      word1: 'right',
      word2: 'light',
      ipa1: '/raɪt/',
      ipa2: '/laɪt/',
      difficulty: 1,
      group: 'rL',
      contrastPhoneme1: 'r',
      contrastPhoneme2: 'l',
    },
  ];
}

function loadHook(storage, harness, rolloutState, compatibilityMock) {
  const featureFlagMock = {
    FEATURE_FLAGS: {
      contrastMasteryRollout: rolloutState,
      contrastMasteryStore: ['internal-test', 'limited', 'enabled'].includes(
        rolloutState
      ),
    },
    isContrastMasteryAuthoritative: (state) =>
      ['internal-test', 'limited', 'enabled'].includes(state),
    isContrastMasteryShadowEnabled: (state) => state === 'shadow',
  };
  return loadTsModule(hookPath, new Map(), {
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
    '@/src/config/featureFlags': featureFlagMock,
    '@/src/storage/masteryCompatibility': compatibilityMock,
  }).useContrastPairs;
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
  await runTest('shadow hook keeps legacy UI and writes while comparing read-only', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
    });
    const calls = { comparisons: 0, reads: 0, writes: 0 };
    const compatibilityMock = {
      async compareMasteryInShadow() {
        calls.comparisons += 1;
        return {
          status: 'stable-missing',
          divergenceCount: 1,
          unexplainedDivergenceCount: 0,
          unresolvedMappingCount: 0,
        };
      },
      async readCompatibleMastery() {
        calls.reads += 1;
        throw new Error('shadow must not use authoritative read');
      },
      async writeCompatibleMastery() {
        calls.writes += 1;
        throw new Error('shadow must not use stable compatibility write');
      },
    };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(
      storage,
      harness,
      'shadow',
      compatibilityMock
    );
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, true);
    await harness.settle();
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), { rL: 3 });
    await harness.settle();
    harness.render(renderHook);

    assert.deepStrictEqual(calls, { comparisons: 1, reads: 0, writes: 0 });
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 3 })],
    ]);
    assert(
      storage.writes.every(
        ([key]) => !key.startsWith('@masteryByContrast')
      )
    );
  });

  await runTest('internal-test hook uses stable reads and dual-write integration', async () => {
    const storage = createStorage();
    const calls = { reads: [], writes: [] };
    const compatibilityMock = {
      async compareMasteryInShadow() {
        throw new Error('authoritative mode must not invoke shadow integration');
      },
      async readCompatibleMastery(...args) {
        calls.reads.push(args);
        return {
          status: 'ready',
          source: 'new',
          mastery: { rL: 4 },
          diagnostics: { malformed: [], unresolved: [] },
        };
      },
      async writeCompatibleMastery(...args) {
        calls.writes.push(args);
        return {
          status: 'complete',
          writeOrder: 'legacy-first',
          legacy: { status: 'written' },
          stable: { status: 'written' },
        };
      },
    };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(
      storage,
      harness,
      'internal-test',
      compatibilityMock
    );
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), { rL: 4 });
    assert.strictEqual(calls.reads.length, 1);
    assert.strictEqual(calls.reads[0][3], 'internal-test');
    assert.strictEqual(calls.writes.length, 0);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 5 });
    assert.strictEqual(calls.writes.length, 1);
    assert.strictEqual(calls.writes[0][4], 'practice');
    assert.strictEqual(calls.writes[0][5], 'internal-test');
    assert.strictEqual(storage.reads.length, 0);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('blocked stable read cannot trigger an empty progress write', async () => {
    const storage = createStorage();
    const calls = { reads: 0, writes: 0 };
    const compatibilityMock = {
      async compareMasteryInShadow() {},
      async readCompatibleMastery() {
        calls.reads += 1;
        return {
          status: 'blocked',
          reason: 'malformed-stable',
          diagnostics: { malformed: [], unresolved: [] },
        };
      },
      async writeCompatibleMastery() {
        calls.writes += 1;
        throw new Error('blocked read must suppress initial persistence');
      },
    };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(
      storage,
      harness,
      'enabled',
      compatibilityMock
    );
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    harness.render(renderHook);
    await harness.settle();
    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);

    assert.strictEqual(result.isLoading, false);
    assert.strictEqual(result.persistenceError.reason, 'malformed-stable');
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.deepStrictEqual(calls, { reads: 1, writes: 0 });
    assert.strictEqual(storage.writes.length, 0);
  });
})();
