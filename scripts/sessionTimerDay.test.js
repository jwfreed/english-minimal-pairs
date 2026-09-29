// D5: within one local calendar day the recorded practice time never moves
// backward (inactivity, background/foreground, remount, persistence), and a
// new local day — including crossing midnight while the app stays alive —
// starts its own total. Real React render with a fake clock in a UTC+7 zone.
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
const previousTZ = process.env.TZ;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
// UTC+7 without daylight saving: 00:00–06:59 local is the previous UTC date.
process.env.TZ = 'Asia/Bangkok';

/** Epoch ms for a Bangkok wall-clock time. */
const bangkok = (y, mo, d, h, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 7, mi, s);

function createStorage() {
  const values = new Map();
  const held = [];
  return {
    values,
    holdWrites: false,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      if (this.holdWrites) {
        await new Promise((resolve) => held.push(resolve));
      }
      values.set(key, value);
    },
    releaseWrites() {
      held.splice(0).forEach((resolve) => resolve());
    },
    daily() {
      return JSON.parse(values.get('@sessionTimer') ?? 'null');
    },
    cumulative() {
      return JSON.parse(values.get('@sessionTimerCumulative') ?? '0');
    },
  };
}

function createEnvironment(startMs, storage = createStorage()) {
  const env = { now: startMs, intervals: new Map(), appStateListeners: [], storage };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(env.now);
      else super(...args);
    }
    static now() {
      return env.now;
    }
  }
  let nextId = 1;
  env.load = () =>
    loadTsModule(
      path.join(ROOT, 'src', 'components', 'SessionTimer.tsx'),
      env.cache ?? (env.cache = new Map()),
      {
        'react-native': {
          View: 'View',
          Text: 'Text',
          AppState: {
            addEventListener: (_event, listener) => {
              env.appStateListeners.push(listener);
              return {
                remove: () => {
                  env.appStateListeners = env.appStateListeners.filter((l) => l !== listener);
                },
              };
            },
          },
        },
        'react-native-reanimated': {
          __esModule: true,
          default: { View: 'ReanimatedView' },
          useReducedMotion: () => true,
        },
        '@react-native-async-storage/async-storage': storage,
        '@/src/hooks/useAppStyles': { useAppStyles: () => new Proxy({}, { get: () => ({}) }) },
        '@/src/constants/styles': {
          __esModule: true,
          default: () => new Proxy({}, { get: () => ({}) }),
        },
        '@/src/constants/motion': {},
        '@/src/context/theme': { useAllThemeColors: () => ({}) },
      },
      {
        Date: FakeDate,
        setInterval: (callback) => {
          const id = nextId++;
          env.intervals.set(id, callback);
          return id;
        },
        clearInterval: (id) => env.intervals.delete(id),
      }
    ).default;
  return env;
}

async function flush() {
  await TestRenderer.act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  });
}

async function mountTimer(env) {
  const SessionTimer = env.load();
  const timerRef = { current: null };
  let root;
  await TestRenderer.act(async () => {
    root = TestRenderer.create(React.createElement(SessionTimer, { timerRef }));
  });
  await flush();
  const view = {
    displayedSeconds() {
      const text = root.root
        .findAllByType('Text')
        .map((node) => node.props.children)
        .find((children) => typeof children === 'string' && /^\d+:\d\d$/.test(children));
      const [m, s] = text.split(':').map(Number);
      return m * 60 + s;
    },
    poke: () => TestRenderer.act(() => timerRef.current.poke()),
    async tick(seconds, onTick) {
      for (let i = 0; i < seconds; i++) {
        env.now += 1000;
        await TestRenderer.act(async () => {
          for (const callback of [...env.intervals.values()]) callback();
        });
        onTick?.(view.displayedSeconds());
      }
    },
    async appState(state) {
      await TestRenderer.act(async () => {
        for (const listener of [...env.appStateListeners]) listener(state);
      });
    },
    async unmount() {
      await TestRenderer.act(async () => root.unmount());
    },
  };
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
  await runTest('the test zone really is UTC+7', () => {
    const at = new Date(bangkok(2026, 9, 30, 6));
    assert.strictEqual(at.getDate(), 30);
    assert.strictEqual(at.getUTCDate(), 29);
  });

  await runTest('normal accumulation is recorded under the local day', async () => {
    const env = createEnvironment(bangkok(2026, 9, 29, 10));
    const timer = await mountTimer(env);
    timer.poke();
    await timer.tick(30);
    assert.strictEqual(timer.displayedSeconds(), 30);
    await timer.unmount();
    await flush();
    assert.deepStrictEqual(env.storage.daily(), { date: '2026-09-29', seconds: 30 });
    assert.strictEqual(env.storage.cumulative(), 30);
  });

  await runTest('inactivity beyond the idle timeout never moves the timer backward', async () => {
    const env = createEnvironment(bangkok(2026, 9, 29, 10));
    const timer = await mountTimer(env);
    timer.poke();
    const seen = [];
    await timer.tick(200, (seconds) => seen.push(seconds));
    assert.ok(seen.every((seconds, i) => i === 0 || seconds >= seen[i - 1]), 'monotonic');
    // Active time runs until the idle timeout, then freezes.
    assert.strictEqual(timer.displayedSeconds(), 120);
    timer.poke();
    await timer.tick(10);
    assert.strictEqual(timer.displayedSeconds(), 130);
    await timer.unmount();
    await flush();
    assert.strictEqual(env.storage.daily().seconds, 130);
  });

  await runTest('background and foreground with a slow write keep the running total', async () => {
    const env = createEnvironment(bangkok(2026, 9, 29, 10));
    const timer = await mountTimer(env);
    timer.poke();
    await timer.tick(30);
    env.storage.holdWrites = true;
    await timer.appState('background');
    env.now += 60_000; // time in the background is not practice
    await timer.appState('active');
    await timer.tick(5);
    assert.strictEqual(timer.displayedSeconds(), 35);
    env.storage.holdWrites = false;
    env.storage.releaseWrites();
    await timer.unmount();
    await flush();
    assert.strictEqual(env.storage.daily().seconds, 35);
  });

  await runTest('a remount before the last write lands does not lose time', async () => {
    const env = createEnvironment(bangkok(2026, 9, 29, 10));
    const first = await mountTimer(env);
    first.poke();
    await first.tick(40);
    env.storage.holdWrites = true;
    await first.unmount();
    const second = await mountTimer(env);
    assert.strictEqual(second.displayedSeconds(), 40);
    env.storage.holdWrites = false;
    env.storage.releaseWrites();
    second.poke();
    await second.tick(5);
    assert.strictEqual(second.displayedSeconds(), 45);
    await second.unmount();
    await flush();
    assert.deepStrictEqual(env.storage.daily(), { date: '2026-09-29', seconds: 45 });
  });

  await runTest('crossing local midnight while running starts the new day at zero', async () => {
    const env = createEnvironment(bangkok(2026, 9, 29, 23, 59, 50));
    const timer = await mountTimer(env);
    timer.poke();
    await timer.tick(20); // 10 s before midnight, 10 s after
    assert.ok(timer.displayedSeconds() <= 10, `new day shows ${timer.displayedSeconds()}`);
    await timer.unmount();
    await flush();
    const daily = env.storage.daily();
    assert.strictEqual(daily.date, '2026-09-30');
    assert.ok(daily.seconds <= 10);
    // Both days' practice reaches the all-time total.
    assert.ok(env.storage.cumulative() >= 19 && env.storage.cumulative() <= 20);
  });

  await runTest('the day key is the local date even when the UTC date differs', async () => {
    // 06:00 on Sept 30 in Bangkok is still Sept 29 in UTC.
    const env = createEnvironment(bangkok(2026, 9, 30, 6));
    env.storage.values.set('@sessionTimer', JSON.stringify({ date: '2026-09-29', seconds: 500 }));
    const timer = await mountTimer(env);
    assert.strictEqual(timer.displayedSeconds(), 0, "yesterday's local total is not today's");
    timer.poke();
    await timer.tick(10);
    await timer.unmount();
    await flush();
    assert.deepStrictEqual(env.storage.daily(), { date: '2026-09-30', seconds: 10 });
  });

  await runTest('a stored total for today is continued, not reset, after restart', async () => {
    const env = createEnvironment(bangkok(2026, 9, 30, 9));
    env.storage.values.set('@sessionTimer', JSON.stringify({ date: '2026-09-30', seconds: 300 }));
    const timer = await mountTimer(env);
    assert.strictEqual(timer.displayedSeconds(), 300);
    timer.poke();
    await timer.tick(15);
    assert.strictEqual(timer.displayedSeconds(), 315);
    await timer.unmount();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
  if (previousTZ === undefined) delete process.env.TZ;
  else process.env.TZ = previousTZ;
});
