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
    holdReads: false,
    heldReads: [],
    failReads: 0,
    failRemoves: 0,
    async getItem(key) {
      // A read observes storage as of when it was issued.
      const value = values.has(key) ? values.get(key) : null;
      if (this.holdReads) {
        await new Promise((resolve) => this.heldReads.push(resolve));
      }
      if (this.failReads > 0) {
        this.failReads -= 1;
        throw new Error('read failed');
      }
      return value;
    },
    failWrites: 0,
    writeCount: 0,
    holdWrites: false,
    heldWrites: [],
    async setItem(key, value) {
      if (this.holdWrites) {
        await new Promise((resolve) => this.heldWrites.push(resolve));
      }
      if (this.failWrites > 0) {
        this.failWrites -= 1;
        throw new Error('write failed');
      }
      this.writeCount += 1;
      values.set(key, value);
    },
    async removeItem(key) {
      if (this.failRemoves > 0) {
        this.failRemoves -= 1;
        throw new Error('remove failed');
      }
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

  // ── PR #25 review: persistence safety ────────────────────────────────────

  const ATTEMPT = { isCorrect: true, timestamp: 1, durationMin: 0.01 };

  await runTest('history with an invalid entry keeps valid pairs readable and is never rewritten', async () => {
    for (const stored of [
      { 'rL:rock:lock': { attempts: [ATTEMPT] }, 'bV:ban:van': { attempts: 'x' } },
      { 'rL:rock:lock': { attempts: [ATTEMPT] }, 'bV:ban:van': 5 },
      { 'rL:rock:lock': { attempts: [ATTEMPT] }, 'bV:ban:van': null },
      { 'rL:rock:lock': { attempts: [ATTEMPT] }, 'bV:ban:van': {} },
    ]) {
      const raw = JSON.stringify(stored);
      const storage = createStorage({ '@pairProgress_v2': raw });
      const modules = loadModules(storage);
      const view = await mount(modules);
      assert.strictEqual(view.latest.persistence, 'blocked', raw);
      assert.strictEqual(view.latest.saveNeedsAttention, true);
      assert.deepStrictEqual(plain(view.latest.progress['rL:rock:lock'].attempts), [ATTEMPT]);

      await record(view, 'rL:rock:lock', 1);
      await record(view, 'bV:ban:van', 1);
      assert.strictEqual(view.latest.progress['rL:rock:lock'].attempts.length, 2);
      assert.strictEqual(storage.values.get('@pairProgress_v2'), raw, 'stored bytes untouched');
      assert.strictEqual(storage.writeCount, 0);
      assert.strictEqual(view.latest.persistence, 'blocked');
      view.unmount();
    }
  });

  await runTest('saving preserves stored data it does not interpret', async () => {
    const stored = {
      'rL:rock:lock': { attempts: [ATTEMPT, { isCorrect: 'yes' }, 'junk'], note: 'keep' },
      'bV:ban:van': { attempts: [ATTEMPT] },
    };
    const storage = createStorage({ '@pairProgress_v2': JSON.stringify(stored) });
    const modules = loadModules(storage);
    const view = await mount(modules);
    assert.strictEqual(view.latest.persistence, 'saved');
    await record(view, 'rL:rock:lock', 1);
    const after = JSON.parse(storage.values.get('@pairProgress_v2'));
    assert.strictEqual(after['rL:rock:lock'].note, 'keep');
    assert.deepStrictEqual(after['rL:rock:lock'].attempts.slice(0, 3), stored['rL:rock:lock'].attempts);
    assert.strictEqual(after['rL:rock:lock'].attempts.length, 4);
    assert.deepStrictEqual(after['bV:ban:van'], stored['bV:ban:van']);
    view.unmount();
  });

  await runTest('history is pending while writes are in flight; an older success does not report saved over a newer attempt', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    assert.strictEqual(view.latest.persistence, 'saved');

    storage.holdWrites = true;
    await record(view, 'rL:rock:lock', 1);
    assert.strictEqual(view.latest.persistence, 'pending');
    assert.strictEqual(view.latest.saveNeedsAttention, false);
    await record(view, 'rL:rock:lock', 1, 1);

    // The first write lands; the second attempt is still unsaved.
    storage.heldWrites.shift()();
    await flush();
    assert.strictEqual(view.latest.persistence, 'pending');

    storage.holdWrites = false;
    storage.heldWrites.splice(0).forEach((release) => release());
    await flush();
    assert.strictEqual(view.latest.persistence, 'saved');
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(plain(persisted), plain(view.latest.progress));
    view.unmount();
  });

  await runTest('a write in flight at reset cannot restore cleared history or swallow attempts recorded after it', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);

    storage.holdWrites = true;
    await record(view, 'rL:rock:lock', 2);
    let reset;
    await TestRenderer.act(async () => {
      reset = view.latest.resetProgress();
    });
    await record(view, 'bV:ban:van', 1);

    storage.holdWrites = false;
    storage.heldWrites.splice(0).forEach((release) => release());
    await TestRenderer.act(async () => {
      await reset;
    });
    await flush();

    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(Object.keys(persisted), ['bV:ban:van'], 'only the post-reset attempt is stored');
    assert.strictEqual(persisted['bV:ban:van'].attempts.length, 1);
    assert.deepStrictEqual(plain(view.latest.progress), plain(persisted));
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();

    const restarted = await mount(loadModules(storage));
    assert.deepStrictEqual(plain(restarted.latest.progress), plain(persisted));
    restarted.unmount();
  });

  await runTest('a failing write retried after a reset writes nothing from before the reset', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    storage.failWrites = Infinity;
    await record(view, 'rL:rock:lock', 2);
    assert.strictEqual(view.latest.persistence, 'pending');
    assert.strictEqual(view.latest.saveNeedsAttention, true);

    await TestRenderer.act(async () => {
      await view.latest.resetProgress();
    });
    storage.failWrites = 0;
    await record(view, 'bV:ban:van', 1);
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(Object.keys(persisted), ['bV:ban:van']);
    assert.strictEqual(view.latest.persistence, 'saved');
    assert.strictEqual(view.latest.saveNeedsAttention, false);
    view.unmount();
  });

  await runTest('a reset storage rejected stays pending and is applied before any later write', async () => {
    const storage = createStorage({
      '@pairProgress_v2': JSON.stringify({ 'rL:rock:lock': { attempts: [ATTEMPT] } }),
    });
    const modules = loadModules(storage);
    const view = await mount(modules);

    storage.failRemoves = 3; // the whole retry budget
    await TestRenderer.act(async () => {
      await view.latest.resetProgress();
    });
    await flush();
    assert.deepStrictEqual(plain(view.latest.progress), {});
    assert.strictEqual(view.latest.persistence, 'pending', 'the reset is not acknowledged');
    assert.strictEqual(view.latest.saveNeedsAttention, true);
    assert.ok(storage.values.has('@pairProgress_v2'));

    // The next write applies the reset first: pre-reset history is not merged back.
    await record(view, 'bV:ban:van', 1);
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(Object.keys(persisted), ['bV:ban:van']);
    assert.deepStrictEqual(plain(view.latest.progress), plain(persisted));
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();
  });

  await runTest('a reset is pending until storage acknowledges the removal', async () => {
    const storage = createStorage({
      '@pairProgress_v2': JSON.stringify({ 'rL:rock:lock': { attempts: [ATTEMPT] } }),
    });
    const modules = loadModules(storage);
    const view = await mount(modules);
    const remove = storage.removeItem.bind(storage);
    let releaseRemove;
    storage.removeItem = (key) =>
      new Promise((resolve) => {
        releaseRemove = () => resolve(remove(key));
      });
    let reset;
    await TestRenderer.act(async () => {
      reset = view.latest.resetProgress();
    });
    await flush();
    assert.strictEqual(view.latest.persistence, 'pending');
    releaseRemove();
    await TestRenderer.act(async () => {
      await reset;
    });
    await flush();
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();
  });

  await runTest('a load issued before a reset cannot bring the cleared history back on screen', async () => {
    const storage = createStorage({
      '@pairProgress_v2': JSON.stringify({ 'rL:rock:lock': { attempts: [ATTEMPT] } }),
    });
    storage.holdReads = true;
    const modules = loadModules(storage);
    const view = await mount(modules);
    assert.strictEqual(storage.heldReads.length, 1, 'the initial load is still reading');

    let reset;
    await TestRenderer.act(async () => {
      reset = view.latest.resetProgress();
    });
    storage.holdReads = false;
    storage.heldReads.splice(0).forEach((release) => release());
    await TestRenderer.act(async () => {
      await reset;
    });
    await flush();
    assert.strictEqual(storage.values.has('@pairProgress_v2'), false);
    assert.deepStrictEqual(plain(view.latest.progress), {});
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();
  });

  await runTest('an older successful read cannot clear a newer failed read', async () => {
    const storage = createStorage();
    // The first read (the initial load) is slow and succeeds; every read
    // issued after it fails.
    let releaseFirstRead;
    let readsIssued = 0;
    storage.getItem = () => {
      readsIssued += 1;
      return readsIssued === 1
        ? new Promise((resolve) => {
            releaseFirstRead = () => resolve(null);
          })
        : Promise.reject(new Error('read failed'));
    };
    const modules = loadModules(storage);
    const view = await mount(modules);
    await TestRenderer.act(async () => {
      view.latest.recordAttempt('rL:rock:lock', true, 0.01);
    });
    releaseFirstRead();
    await flush();
    await flush();
    // The save's reads were issued after the load's and failed: that is the
    // latest knowledge of storage, whatever order the results arrived in.
    assert.strictEqual(view.latest.persistence, 'blocked');
    assert.strictEqual(view.latest.saveNeedsAttention, true);
    assert.strictEqual(storage.writeCount, 0);
    view.unmount();
  });

  await runTest('a write that committed but was reported as failed does not duplicate attempts on retry', async () => {
    const storage = createStorage();
    const modules = loadModules(storage);
    const view = await mount(modules);
    const setItem = storage.setItem.bind(storage);
    let lieOnce = true;
    storage.setItem = async (key, value) => {
      await setItem(key, value);
      if (lieOnce) {
        lieOnce = false;
        throw new Error('acknowledgement lost');
      }
    };
    await record(view, 'rL:rock:lock', 2);
    const persisted = modules.parseStoredProgress(storage.values.get('@pairProgress_v2'));
    assert.strictEqual(persisted['rL:rock:lock'].attempts.length, 2);
    assert.deepStrictEqual(plain(persisted), plain(view.latest.progress));
    assert.strictEqual(view.latest.persistence, 'saved');
    view.unmount();
  });

  await runTest('a stored pair ID that collides with an object built-in is not silently dropped on save', async () => {
    const raw = '{"__proto__":{"attempts":[{"isCorrect":true,"timestamp":1,"durationMin":0.01}],"note":"keep"}}';
    const storage = createStorage({ '@pairProgress_v2': raw });
    const modules = loadModules(storage);
    const view = await mount(modules);
    await record(view, 'rL:rock:lock', 1);
    const stored = storage.values.get('@pairProgress_v2');
    assert.ok(stored.includes('"__proto__"') && stored.includes('"note":"keep"'), stored);
    view.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
