const assert = require('assert');
const path = require('path');
const React = require('react');
// Installed through expo-module-scripts (jest-expo / @testing-library/react-native).
const TestRenderer = require('react-test-renderer');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const hookPath = path.join(ROOT, 'src', 'hooks', 'useContrastPairs.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));

// run-tests.js shares one process across suites; these are restored below.
const previousGlobals = {
  IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
  IS_REACT_NATIVE_TEST_ENVIRONMENT: globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT,
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [];
  const writes = [];
  return {
    values,
    reads,
    writes,
    failRead: false,
    async getItem(key) {
      reads.push(key);
      if (this.failRead) throw new Error('legacy read failed');
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

function loadHook(storage) {
  const disabled = async () => {
    throw new Error('disabled rollout invoked compatibility storage');
  };
  return loadTsModule(hookPath, new Map(), {
    '@react-native-async-storage/async-storage': storage,
    '@/src/storage/masteryCompatibility': {
      readCompatibleMastery: disabled,
      writeCompatibleMastery: disabled,
      compareMasteryInShadow: disabled,
    },
  }).useContrastPairs;
}

/** Mounts one hook instance per name inside StrictMode. */
function mountStrict(useContrastPairs, instances) {
  const pairs = japanesePairs();
  const latest = {};
  function Probe({ name, category }) {
    latest[name] = useContrastPairs(pairs, category);
    return null;
  }
  const tree = (categories) =>
    React.createElement(
      React.StrictMode,
      null,
      ...Object.entries(categories).map(([name, category]) =>
        React.createElement(Probe, { key: name, name, category })
      )
    );
  let root;
  return {
    latest,
    async mount() {
      await TestRenderer.act(async () => {
        root = TestRenderer.create(tree(instances));
      });
    },
    async update(categories) {
      await TestRenderer.act(async () => {
        root.update(tree(categories));
      });
    },
    async act(fn) {
      await TestRenderer.act(async () => {
        await fn();
      });
    },
    unmount() {
      TestRenderer.act(() => root.unmount());
    },
  };
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
  await runTest('StrictMode: failed hydration never writes and recovers on the next mutation', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    storage.failRead = true;
    const view = mountStrict(loadHook(storage), { practice: '日本語' });

    await view.mount();
    // StrictMode replays mount effects, so hydration was read twice.
    assert.strictEqual(storage.reads.length, 2);
    assert.strictEqual(view.latest.practice.isLoading, false);
    assert.strictEqual(
      view.latest.practice.persistenceError.message,
      'legacy read failed'
    );

    await view.act(() => view.latest.practice.promote('rL'));
    assert.deepStrictEqual(storage.writes, []);

    storage.failRead = false;
    await view.act(() => view.latest.practice.promote('rL'));
    assert.deepStrictEqual(plain(view.latest.practice.mastery), { rL: 5 });
    assert.deepStrictEqual(storage.writes, []);

    await view.act(() => view.latest.practice.promote('rL'));
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 6 })],
    ]);
    view.unmount();
  });

  await runTest('StrictMode: rebinding and a second instance never cross-write or roll back', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@mastery_한국어': JSON.stringify({ rL: 2 }),
    });
    const view = mountStrict(loadHook(storage), {
      practice: '日本語',
      results: '日本語',
    });

    await view.mount();
    assert.deepStrictEqual(plain(view.latest.results.mastery), { rL: 5 });
    await view.act(() => view.latest.practice.promote('rL'));
    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 6 })],
    ]);

    await view.update({ practice: '한국어', results: '한국어' });
    assert.deepStrictEqual(plain(view.latest.practice.mastery), { rL: 2 });
    assert.deepStrictEqual(plain(view.latest.results.mastery), { rL: 2 });
    await view.act(() => view.latest.practice.promote('rL'));

    assert.deepStrictEqual(storage.writes, [
      ['@mastery_日本語', JSON.stringify({ rL: 6 })],
      ['@mastery_한국어', JSON.stringify({ rL: 3 })],
    ]);
    view.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
