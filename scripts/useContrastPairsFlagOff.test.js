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
    failRead,
    failWrite: false,
    holdReads: false,
    heldReads: [],
    async getItem(key) {
      reads.push(key);
      // Like AsyncStorage's ordered queue, a read observes storage as of when
      // it was issued, even if its result is delivered later.
      const value = values.has(key) ? values.get(key) : null;
      if (this.holdReads) {
        await new Promise((resolve) => this.heldReads.push(resolve));
      }
      if (this.failRead) throw new Error('legacy read failed');
      return value;
    },
    async setItem(key, value) {
      if (this.failWrite) throw new Error('legacy write failed');
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
  const callbacks = [];
  const effectDependencies = [];
  const effectCleanups = [];
  let stateIndex = 0;
  let refIndex = 0;
  let callbackIndex = 0;
  let effectIndex = 0;
  let pendingEffects = [];

  const sameDependencies = (previous, dependencies) =>
    previous &&
    dependencies.length === previous.length &&
    dependencies.every((dependency, dependencyIndex) =>
      Object.is(dependency, previous[dependencyIndex])
    );

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
    useCallback(callback, dependencies) {
      const index = callbackIndex++;
      if (!sameDependencies(callbacks[index]?.dependencies, dependencies)) {
        callbacks[index] = { callback, dependencies };
      }
      return callbacks[index].callback;
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
    callbackIndex = 0;
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
  await runTest('flag-off hook loads legacy mastery and persists only mutations', async () => {
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
    // Hydration alone is not a mutation and must not rewrite storage.
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 4 });
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 4 })],
    ]);
    assert.deepStrictEqual(calls, { reads: 0, writes: 0, migrations: 0 });
    assert.strictEqual(
      [...storage.reads, ...storage.writes.map(([key]) => key)].filter(
        (key) => key.startsWith('@masteryByContrast')
      ).length,
      0
    );
  });

  await runTest('failed read surfaces an error and never overwrites saved mastery', async () => {
    const storage = createStorage(
      { '@mastery_日本語': JSON.stringify({ rL: 5 }) },
      true
    );
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, true);
    assert.strictEqual(result.persistenceError, null);

    await harness.settle();
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(result.persistenceError.message, 'legacy read failed');
    await harness.settle();

    // In-session progress on top of a failed read must not replace real data.
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    harness.render(renderHook);

    // The mutation retried the read, which failed again.
    assert.strictEqual(storage.reads.length, 2);
    assert.deepStrictEqual(storage.writes, []);
    assert.strictEqual(
      storage.values.get('@mastery_日本語'),
      JSON.stringify({ rL: 5 })
    );
    assert.deepStrictEqual(calls, { reads: 0, writes: 0, migrations: 0 });
  });

  await runTest('a mutation after storage recovers re-hydrates stored mastery before any write', async () => {
    const storage = createStorage(
      { '@mastery_日本語': JSON.stringify({ rL: 5 }) },
      true
    );
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });

    // Storage recovers; the next learner mutation triggers re-hydration, and
    // progress earned against the unread baseline is discarded, not merged.
    storage.failRead = false;
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 5 });
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 6 })],
    ]);
  });

  await runTest('recovering an empty key never adopts progress made while unreadable', async () => {
    const storage = createStorage({}, true);
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);

    storage.failRead = false;
    await result.refresh();
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 2 })],
    ]);
  });

  await runTest('reset removes mastery and later writes start from the reset state', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 4 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();

    await result.resetMastery();
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(storage.values.has('@mastery_日本語'), false);
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 5 })],
    ]);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes.at(-1), [
      '@mastery_日本語',
      JSON.stringify({ rL: 2 }),
    ]);
  });

  await runTest('reads in flight during reset cannot resurrect pre-reset mastery', async () => {
    for (const pendingRead of ['hydration', 'refresh']) {
      const storage = createStorage({
        '@mastery_日本語': JSON.stringify({ rL: 4 }),
      });
      const calls = { reads: 0, writes: 0, migrations: 0 };
      const harness = createHookHarness();
      const useContrastPairs = loadHook(storage, harness, calls);
      const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

      storage.holdReads = pendingRead === 'hydration';
      let result = harness.render(renderHook);
      let staleRefresh = Promise.resolve();
      if (pendingRead === 'refresh') {
        await harness.settle();
        result = harness.render(renderHook);
        storage.holdReads = true;
        staleRefresh = result.refresh();
      }
      storage.holdReads = false;

      await result.resetMastery();
      result = harness.render(renderHook);
      storage.heldReads.forEach((release) => release());
      await staleRefresh;
      await harness.settle();
      result = harness.render(renderHook);
      assert.deepStrictEqual(plain(result.mastery), {}, pendingRead);

      result.promote('rL');
      result = harness.render(renderHook);
      await harness.settle();
      assert.deepStrictEqual(
        storage.writes,
        [['@mastery_日本語', JSON.stringify({ rL: 2 })]],
        pendingRead
      );
    }
  });

  await runTest('a successful refresh after a failed read re-enables persistence', async () => {
    const storage = createStorage(
      { '@mastery_日本語': JSON.stringify({ rL: 5 }) },
      true
    );
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), {});

    storage.failRead = false;
    await result.refresh();
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 5 });
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 6 })],
    ]);
  });

  await runTest('a successful read of absent mastery starts empty and persists mutations', async () => {
    const storage = createStorage();
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(result.persistenceError, null);
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 2 })],
    ]);
  });

  await runTest('category rebinding never writes the previous category under the new key', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@mastery_한국어': JSON.stringify({ rL: 2 }),
      '@mastery_Português': JSON.stringify({ rL: 3 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    let category = '日本語';
    const renderHook = () => useContrastPairs(japanesePairs(), category);

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), { rL: 5 });

    category = '한국어';
    result = harness.render(renderHook);
    assert.strictEqual(result.isLoading, true);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    harness.render(renderHook);
    assert.strictEqual(result.isLoading, false);
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });
    assert.deepStrictEqual(storage.writes, []);

    // A destination whose read fails must not receive the source's state.
    storage.failRead = true;
    category = 'Português';
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    harness.render(renderHook);
    assert.strictEqual(result.persistenceError.message, 'legacy read failed');
    assert.deepStrictEqual(storage.writes, []);
    assert.deepStrictEqual(Object.fromEntries(storage.values), {
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@mastery_한국어': JSON.stringify({ rL: 2 }),
      '@mastery_Português': JSON.stringify({ rL: 3 }),
    });
  });

  await runTest('a read pending for a previous category cannot hydrate the new key', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    let category = '日本語';
    const renderHook = () => useContrastPairs(japanesePairs(), category);

    harness.render(renderHook);
    category = '한국어';
    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_한국어', JSON.stringify({ rL: 2 })],
    ]);
    assert.strictEqual(
      storage.values.get('@mastery_日本語'),
      JSON.stringify({ rL: 5 })
    );
  });

  await runTest('a refresh resolving after rebinding cannot hydrate the new key', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@mastery_한국어': JSON.stringify({ rL: 2 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    let category = '日本語';
    const renderHook = () => useContrastPairs(japanesePairs(), category);

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);

    storage.holdReads = true;
    const staleRefresh = result.refresh();
    storage.holdReads = false;
    category = '한국어';
    harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });

    storage.heldReads.forEach((release) => release());
    await staleRefresh;
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });
    assert.deepStrictEqual(storage.writes, []);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_한국어', JSON.stringify({ rL: 3 })],
    ]);
  });

  await runTest('a read-only second instance cannot erase or roll back saved mastery', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const practiceHarness = createHookHarness();
    const resultsHarness = createHookHarness();
    const usePractice = loadHook(storage, practiceHarness, calls);
    const useResults = loadHook(storage, resultsHarness, calls);
    const renderPractice = () => usePractice(japanesePairs(), '日本語');
    const renderResults = () => useResults(japanesePairs(), '日本語');

    let practice = practiceHarness.render(renderPractice);
    let results = resultsHarness.render(renderResults);
    await practiceHarness.settle();

    // Practice promotes while Results still holds its hydrated { rL: 3 }.
    practice = practiceHarness.render(renderPractice);
    practice.promote('rL');
    practice = practiceHarness.render(renderPractice);
    await practiceHarness.settle();
    results = resultsHarness.render(renderResults);
    await resultsHarness.settle();
    resultsHarness.render(renderResults);
    assert.deepStrictEqual(plain(results.mastery), { rL: 3 });
    assert.strictEqual(
      storage.values.get('@mastery_日本語'),
      JSON.stringify({ rL: 4 })
    );

    await results.refresh();
    results = resultsHarness.render(renderResults);
    await resultsHarness.settle();
    assert.deepStrictEqual(plain(results.mastery), { rL: 4 });

    // A failed refresh keeps in-memory mastery, surfaces the error, and writes nothing.
    storage.failRead = true;
    await results.refresh();
    results = resultsHarness.render(renderResults);
    await resultsHarness.settle();
    assert.deepStrictEqual(plain(results.mastery), { rL: 4 });
    assert.strictEqual(results.persistenceError.message, 'legacy read failed');

    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 4 })],
    ]);
  });

  await runTest('failed mastery writes surface through persistenceError', async () => {
    const storage = createStorage();
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();

    storage.failWrite = true;
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });
    assert.strictEqual(result.persistenceError.message, 'legacy write failed');
    assert.deepStrictEqual(storage.writes, []);
  });

  await runTest('saved final-tier completion (level 7) is read, protected, and never rewritten by reads', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 7 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 7 });
    assert.deepStrictEqual(storage.writes, []);

    const failing = createStorage(
      { '@mastery_日本語': JSON.stringify({ rL: 7 }) },
      true
    );
    const failingHarness = createHookHarness();
    const useFailing = loadHook(failing, failingHarness, calls);
    const renderFailing = () => useFailing(japanesePairs(), '日本語');
    let failed = failingHarness.render(renderFailing);
    await failingHarness.settle();
    failed = failingHarness.render(renderFailing);
    failed.promote('rL');
    failingHarness.render(renderFailing);
    await failingHarness.settle();
    failingHarness.render(renderFailing);
    assert.deepStrictEqual(failing.writes, []);
    assert.strictEqual(
      failing.values.get('@mastery_日本語'),
      JSON.stringify({ rL: 7 })
    );
  });

  await runTest('completing the final tier persists level 7 and advancing stops there', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 6 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    const renderHook = () => useContrastPairs(japanesePairs(), '日本語');

    let result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 7 });
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 7 })],
    ]);

    result.promote('rL');
    result = harness.render(renderHook);
    await harness.settle();
    assert.deepStrictEqual(plain(result.mastery), { rL: 7 });
    assert.ok(storage.writes.every(([, value]) => JSON.parse(value).rL <= 7));

    await result.resetMastery();
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), {});
    assert.strictEqual(storage.values.has('@mastery_日本語'), false);
  });

  await runTest('rebinding never carries level 7 to another category key', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 7 }),
      '@mastery_한국어': JSON.stringify({ rL: 2 }),
    });
    const calls = { reads: 0, writes: 0, migrations: 0 };
    const harness = createHookHarness();
    const useContrastPairs = loadHook(storage, harness, calls);
    let category = '日本語';
    const renderHook = () => useContrastPairs(japanesePairs(), category);

    let result = harness.render(renderHook);
    await harness.settle();
    harness.render(renderHook);
    category = '한국어';
    result = harness.render(renderHook);
    await harness.settle();
    result = harness.render(renderHook);
    await harness.settle();
    harness.render(renderHook);
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });
    assert.deepStrictEqual(storage.writes, []);
  });
})();
