const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const hookPath = path.join(ROOT, 'src', 'hooks', 'useContrastPairs.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}, failRead = false) {
  const values = new Map(Object.entries(initial));
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    async getItem(key) {
      reads.push(key);
      if (failRead) throw new Error('legacy read failed');
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

function loadHook(storage, harness, compatibilityCalls) {
  const compatibilityMock = {
    async readCompatibleMastery() {
      compatibilityCalls.reads += 1;
      compatibilityCalls.migrations += 1;
      throw new Error('disabled hook invoked compatibility read');
    },
    async writeCompatibleMastery() {
      compatibilityCalls.writes += 1;
      throw new Error('disabled hook invoked compatibility write');
    },
  };
  return loadTsModule(hookPath, new Map(), {
    react: harness.react,
    '@react-native-async-storage/async-storage': storage,
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
  await runTest('flag-off hook preserves the legacy load and persist cycle exactly', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, true);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(result.persistenceError, null);
    assert.strictEqual(storage.reads.length, 1);
    assert.strictEqual(storage.writes.length, 0);

    await harness.settle();
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), { rL: 3 });
    assert.strictEqual(result.persistenceError, null);
    await harness.settle();

    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), { rL: 3 });
    assert.strictEqual(storage.reads.length, 1);
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 3 })],
    ]);
    assert.deepStrictEqual(calls, { reads: 0, writes: 0, migrations: 0 });
    assert.strictEqual(
      [...storage.reads, ...storage.writes.map(([key]) => key)].filter(
        (key) => key.startsWith('@masteryByContrast')
      ).length,
      0
    );
  });

  await runTest('flag-off hook retains legacy read-error timing and empty fallback', async () => {
    const storage = createStorage({}, true);
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, true);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(result.persistenceError, null);

    await harness.settle();
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(result.persistenceError, null);
    await harness.settle();

    assert.strictEqual(storage.reads.length, 1);
    assert.deepStrictEqual(storage.writes, [['@mastery_日本語', '{}']]);
    assert.deepStrictEqual(calls, { reads: 0, writes: 0, migrations: 0 });
  });
})();
