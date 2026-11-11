// D3: live and persisted attempt history obey one retention contract (the most
// recent MAX_ATTEMPTS_PER_PAIR per pair, identical attempt records), so a
// restart alone cannot change anything Results derives from attempts.
// Real React render of the real PairProgressProvider and storage module.
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

const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    failWrites: 0,
    writeCount: 0,
    async setItem(key, value) {
      if (this.failWrites > 0) {
        this.failWrites -= 1;
        throw new Error('write failed');
      }
      this.writeCount += 1;
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

async function flush() {
  await TestRenderer.act(async () => {
    for (let i = 0; i < 12; i++) await new Promise((resolve) => setImmediate(resolve));
  });
}

function loadModules(storage) {
  let clock = 1_700_000_000_000;
  // Every Date.now() call advances, so separately computed timestamps differ.
  const FakeDate = { now: () => (clock += 7) };
  const cache = new Map();
  const mocks = { '@react-native-async-storage/async-storage': storage };
  const globals = {
    Date: FakeDate,
    console: { ...console, error: () => {} },
    // Retry backoff elapses immediately.
    setTimeout: (callback) => setImmediate(callback),
  };
  const context = loadTsModule(
    path.join(ROOT, 'src', 'context', 'PairProgressContext.tsx'),
    cache,
    mocks,
    globals
  );
  const storageModule = loadTsModule(
    path.join(ROOT, 'src', 'storage', 'progressStorage.ts'),
    cache,
    mocks,
    globals
  );
  return { ...context, ...storageModule };
}

async function mount(modules) {
  const view = { latest: null };
  function Probe() {
    view.latest = modules.usePairProgress();
    return null;
  }
  let root;
  await TestRenderer.act(async () => {
    root = TestRenderer.create(
      React.createElement(modules.PairProgressProvider, null, React.createElement(Probe))
    );
  });
  await flush();
  view.unmount = () => TestRenderer.act(() => root.unmount());
  return view;
}

/** Everything Results derives from a pair's attempts. */
function resultsView(modules, progress) {
  return Object.fromEntries(
    Object.entries(progress).map(([pairId, stats]) => [
      pairId,
      {
        attemptCount: stats.attempts.length,
        activeMs: modules.estimateActivePracticeTime(stats.attempts),
        weightedAccuracy: modules.getWeightedAccuracy(stats.attempts),
        overTime: modules.getAccuracyAndTimeOverTime(stats.attempts),
      },
    ])
  );
}

async function record(view, pairId, count, offset = 0) {
  for (let i = 0; i < count; i++) {
    await TestRenderer.act(async () => {
      view.latest.recordAttempt(pairId, (i + offset) % 3 !== 0, (i + offset + 1) / 100);
    });
  }
  await flush();
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
  await runTest('live history enforces the cap at the boundary exactly like storage', async () => {
    for (const count of [99, 100, 101]) {
      const storage = createStorage();
      const modules = loadModules(storage);
      const view = await mount(modules);
      await record(view, 'rL:rock:lock', count);
      const live = view.latest.progress['rL:rock:lock'].attempts;
      const persisted = modules.parseStoredProgress(
        storage.values.get(modules.PAIR_PROGRESS_STORAGE_KEY)
      )['rL:rock:lock'].attempts;
      assert.strictEqual(live.length, Math.min(count, modules.MAX_ATTEMPTS_PER_PAIR), `${count}`);
      assert.deepStrictEqual(plain(live), plain(persisted), `${count}: live vs persisted`);
      // The oldest attempts are the ones dropped, and order is chronological.
      assert.strictEqual(live.at(-1).durationMin, count / 100);
      assert.ok(live.every((attempt, i) => i === 0 || attempt.timestamp > live[i - 1].timestamp));
      view.unmount();
    }
  });

  await runTest('a restart alone cannot change Results derived from attempts', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    await record(view, 'rL:rock:lock', 105);
    await record(view, 'bV:ban:van', 12, 5);
    const beforeRestart = resultsView(modules, view.latest.progress);
    view.unmount();

    const restarted = await mount(modules);
    assert.deepStrictEqual(resultsView(modules, restarted.latest.progress), beforeRestart);
    assert.deepStrictEqual(plain(restarted.latest.progress), plain(view.latest.progress));

    // Mutation after hydration keeps the same contract.
    await record(restarted, 'rL:rock:lock', 1);
    const live = restarted.latest.progress['rL:rock:lock'].attempts;
    const persisted = modules.parseStoredProgress(
      storage.values.get(modules.PAIR_PROGRESS_STORAGE_KEY)
    )['rL:rock:lock'].attempts;
    assert.strictEqual(live.length, modules.MAX_ATTEMPTS_PER_PAIR);
    assert.deepStrictEqual(plain(live), plain(persisted));
    restarted.unmount();
  });

  await runTest('a malformed attempt container hydrates safely and keeps recording', async () => {
    const storage = createStorage({
      '@pairProgress_v2': JSON.stringify({ 'rL:rock:lock': { attempts: 'x' } }),
    });
    const modules = loadModules(storage);
    const view = await mount(modules);
    assert.strictEqual(view.latest.isLoading, false);
    await record(view, 'rL:rock:lock', 2);
    const persisted = modules.parseStoredProgress(
      storage.values.get(modules.PAIR_PROGRESS_STORAGE_KEY)
    )['rL:rock:lock'].attempts;
    assert.deepStrictEqual(plain(view.latest.progress['rL:rock:lock'].attempts), plain(persisted));
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();
  });

  await runTest('malformed stored history is never overwritten and reports blocked', async () => {
    for (const raw of ['{not json', '[1,2]', 'null', '"text"']) {
      const storage = createStorage({ '@pairProgress_v2': raw });
      const modules = loadModules(storage);
      const view = await mount(modules);
      assert.strictEqual(view.latest.isLoading, false);
      assert.strictEqual(view.latest.persistence, 'blocked');
      await record(view, 'rL:rock:lock', 2);
      // The session keeps working in memory; the stored bytes are untouched.
      assert.strictEqual(view.latest.progress['rL:rock:lock'].attempts.length, 2);
      assert.strictEqual(view.latest.persistence, 'blocked');
      assert.strictEqual(storage.values.get('@pairProgress_v2'), raw);
      assert.strictEqual(storage.writeCount, 0);
      view.unmount();
    }
  });

  await runTest('a transient write failure is retried and the attempt is saved', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    storage.failWrites = 2; // within the retry budget
    await record(view, 'rL:rock:lock', 1);
    assert.strictEqual(view.latest.persistence, 'saved');
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(plain(persisted), plain(view.latest.progress));
    view.unmount();
  });

  await runTest('attempts that outlast the retries stay pending and are saved by the next write; a restart loses nothing', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    await record(view, 'rL:rock:lock', 1);

    storage.failWrites = Infinity;
    await record(view, 'rL:rock:lock', 2, 1);
    await record(view, 'bV:ban:van', 1);
    assert.strictEqual(view.latest.persistence, 'pending');
    assert.strictEqual(
      modules.parseStoredProgress(storage.values.get('@pairProgress_v2'))['rL:rock:lock'].attempts.length,
      1
    );

    // Storage recovers: one more answer carries every unsaved attempt, in order, once.
    storage.failWrites = 0;
    await record(view, 'rL:rock:lock', 1, 3);
    assert.strictEqual(view.latest.persistence, 'saved');
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(plain(persisted), plain(view.latest.progress));
    assert.strictEqual(persisted['rL:rock:lock'].attempts.length, 4);
    view.unmount();

    const restarted = await mount(loadModules(storage));
    assert.deepStrictEqual(plain(restarted.latest.progress), plain(persisted));
    restarted.unmount();
  });

  await runTest('overlapping saves each land exactly once, in order', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    storage.failWrites = 1;
    await TestRenderer.act(async () => {
      for (let i = 0; i < 5; i++) view.latest.recordAttempt('rL:rock:lock', i % 2 === 0, 0.01);
    });
    await flush();
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.strictEqual(persisted['rL:rock:lock'].attempts.length, 5);
    assert.deepStrictEqual(plain(persisted), plain(view.latest.progress));
    view.unmount();
  });

  await runTest('a failed load reports blocked and is re-read once storage works again', async () => {
    const stored = { 'rL:rock:lock': { attempts: [{ isCorrect: true, timestamp: 1, durationMin: 0.01 }] } };
    const storage = createStorage({ '@pairProgress_v2': JSON.stringify(stored) });
    const read = storage.getItem.bind(storage);
    let failReads = true;
    storage.getItem = async (key) => {
      if (failReads) throw new Error('read failed');
      return read(key);
    };
    const modules = loadModules(storage);
    const view = await mount(modules);
    assert.strictEqual(view.latest.persistence, 'blocked');
    assert.deepStrictEqual(plain(view.latest.progress), {});

    failReads = false;
    await record(view, 'rL:rock:lock', 1);
    assert.strictEqual(view.latest.persistence, 'saved');
    // The stored attempt was preserved and is now shown with the new one.
    assert.strictEqual(view.latest.progress['rL:rock:lock'].attempts.length, 2);
    assert.strictEqual(
      modules.parseStoredProgress(storage.values.get('@pairProgress_v2'))['rL:rock:lock'].attempts.length,
      2
    );
    view.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
