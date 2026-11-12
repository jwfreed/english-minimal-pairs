// D6: playback ownership follows the owning screen's lifecycle. Two real
// useAudio owners (e.g. Placement and Practice) share the real coordinator;
// only host boundaries are substituted. Unmounting an owner mid-playback must
// release its ownership (and watchdog) so a later screen can play at once,
// its late native callbacks must not reach anyone, and it must never release
// a newer owner's playback. P1 gating: only the current stimulus's own
// completion reaches its observer.
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

const PAIR = {
  word1: 'rock',
  word2: 'lock',
  ipa1: '/rɑk/',
  ipa2: '/lɑk/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};
const VOICE = { identifier: 'voice.a', name: 'Ava', language: 'en-US', quality: 'Default' };

function createScenario({
  getAvailableVoicesAsync = async () => [VOICE],
  setAudioModeAsync = async () => {},
} = {}) {
  const speakCalls = [];
  const timers = new Map();
  let nextTimerId = 1;
  const { useAudio } = loadTsModule(
    path.join(ROOT, 'src', 'hooks', 'useAudio.ts'),
    new Map(),
    {
      'react-native': { Platform: { OS: 'ios' } },
      'expo-speech': {
        speak(word, options) {
          speakCalls.push({ word, options });
        },
        getAvailableVoicesAsync,
      },
      'expo-audio': { setAudioModeAsync },
      '@/src/hooks/useSilentWarmupPlayer': { useSilentWarmupPlayer: () => ({ play() {} }) },
      '../../assets/audio/silent.mp3': 1,
    },
    {
      setTimeout: (callback) => {
        const id = nextTimerId++;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      // Stale-callback diagnostics are expected here; keep output clean.
      console: { ...console, warn: () => {} },
    }
  );

  const hooks = {};
  function Owner({ name }) {
    hooks[name] = useAudio(PAIR, 1, () => VOICE);
    return null;
  }
  let root;
  const render = async (names) => {
    await TestRenderer.act(async () => {
      const tree = React.createElement(
        React.Fragment,
        null,
        ...names.map((name) => React.createElement(Owner, { key: name, name }))
      );
      if (root) root.update(tree);
      else root = TestRenderer.create(tree);
    });
    await TestRenderer.act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  };
  const play = async (name) => {
    const outcomes = [];
    await TestRenderer.act(async () => {
      await hooks[name].play(0, (outcome) => outcomes.push(outcome.kind === 'failed' ? outcome.reason : outcome.kind));
    });
    return { outcomes, options: speakCalls.at(-1)?.options };
  };
  const callback = async (fn) => {
    await TestRenderer.act(async () => {
      fn();
    });
  };
  // Starts playback without waiting for it, for requests held in setup.
  const startPlay = async (name) => {
    const outcomes = [];
    let settled;
    await TestRenderer.act(async () => {
      settled = hooks[name]
        .play(0, (outcome) => outcomes.push(outcome.kind === 'failed' ? outcome.reason : outcome.kind))
        .then(() => 'resolved', (error) => error.message);
    });
    return { outcomes, settled };
  };
  const fireTimers = async () => {
    await TestRenderer.act(async () => {
      for (const [id, timer] of [...timers]) {
        timers.delete(id);
        timer();
      }
      await new Promise((resolve) => setImmediate(resolve));
    });
  };
  const flush = () =>
    TestRenderer.act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
  return {
    startPlay,
    fireTimers,
    flush,
    hooks,
    speakCalls,
    timers,
    render,
    play,
    callback,
    unmountAll: () => TestRenderer.act(() => root.unmount()),
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
  await runTest('unmounting mid-playback releases ownership so the next screen plays at once', async () => {
    const scenario = createScenario();
    await scenario.render(['placement', 'practice']);
    const placement = await scenario.play('placement');
    await scenario.callback(() => placement.options.onStart());
    assert.strictEqual(scenario.speakCalls.length, 1);

    await scenario.render(['practice']);
    assert.strictEqual(scenario.timers.size, 0, 'the unmounted owner watchdog is disarmed');

    const practice = await scenario.play('practice');
    assert.strictEqual(scenario.speakCalls.length, 2, 'the next screen reaches native speech');
    assert.deepStrictEqual(practice.outcomes, [], 'not rejected as a duplicate');
    assert.deepStrictEqual(placement.outcomes, ['started'], 'the disposed observer hears nothing more');
    scenario.unmountAll();
  });

  await runTest('late callbacks from a disposed owner cannot reach a later screen', async () => {
    const scenario = createScenario();
    await scenario.render(['placement', 'practice']);
    const placement = await scenario.play('placement');
    await scenario.render(['practice']);
    const practice = await scenario.play('practice');
    await scenario.callback(() => practice.options.onStart());
    assert.strictEqual(scenario.hooks.practice.isSpeaking, true);

    await scenario.callback(() => placement.options.onDone());
    await scenario.callback(() => placement.options.onStopped());
    await scenario.callback(() => placement.options.onError(new Error('late')));
    assert.deepStrictEqual(practice.outcomes, ['started']);
    assert.strictEqual(scenario.hooks.practice.isSpeaking, true, 'the newer playback is untouched');

    // P1: only the current stimulus's own completion unlocks answering.
    await scenario.callback(() => practice.options.onDone());
    assert.deepStrictEqual(practice.outcomes, ['started', 'completed']);
    assert.strictEqual(scenario.hooks.practice.isSpeaking, false);
    assert.deepStrictEqual(placement.outcomes, []);
    scenario.unmountAll();
  });

  await runTest("an older owner unmounting never releases a newer owner's playback", async () => {
    const scenario = createScenario();
    await scenario.render(['placement', 'practice', 'other']);
    const placement = await scenario.play('placement');
    await scenario.callback(() => placement.options.onDone());
    const practice = await scenario.play('practice');

    await scenario.render(['practice', 'other']);
    const other = await scenario.play('other');
    assert.deepStrictEqual(other.outcomes, ['request-rejected'], 'practice still owns playback');
    assert.strictEqual(scenario.speakCalls.length, 2);

    await scenario.callback(() => practice.options.onDone());
    assert.deepStrictEqual(practice.outcomes, ['completed']);
    scenario.unmountAll();
  });

  await runTest('unmounting after playback completed changes nothing', async () => {
    const scenario = createScenario();
    await scenario.render(['placement', 'practice']);
    const placement = await scenario.play('placement');
    await scenario.callback(() => placement.options.onDone());
    await scenario.render(['practice']);
    const practice = await scenario.play('practice');
    assert.deepStrictEqual(practice.outcomes, []);
    assert.strictEqual(scenario.speakCalls.length, 2);
    scenario.unmountAll();
  });

  // A screen whose audio initialization failed has no cached voices, so its
  // first playback awaits voice lookup while already owning playback.
  function setupScenario() {
    const control = { heldVoiceLookups: [], holdVoices: false };
    const scenario = createScenario({
      getAvailableVoicesAsync: () =>
        control.holdVoices
          ? new Promise((resolve) => control.heldVoiceLookups.push(resolve))
          : Promise.resolve([VOICE]),
      setAudioModeAsync: async () => {
        throw new Error('audio session unavailable');
      },
    });
    return { scenario, control };
  }

  await runTest('a request still in setup when its screen unmounts never speaks over the next owner', async () => {
    const { scenario, control } = setupScenario();
    await scenario.render(['placement']);
    await scenario.render(['placement', 'practice']);
    assert.strictEqual(scenario.hooks.placement.audioModeReady, true);

    control.holdVoices = true;
    const placement = await scenario.startPlay('placement');
    control.holdVoices = false;
    assert.strictEqual(scenario.speakCalls.length, 0, 'placement is waiting on voice lookup');

    await scenario.render(['practice']);
    const practice = await scenario.play('practice');
    assert.strictEqual(scenario.speakCalls.length, 1, 'the next screen plays at once');

    // The disposed request's setup now finishes.
    control.heldVoiceLookups.forEach((resolve) => resolve([VOICE]));
    assert.strictEqual(await placement.settled, 'resolved');
    await scenario.flush();
    assert.strictEqual(scenario.speakCalls.length, 1, 'the disposed request submitted nothing');
    assert.deepStrictEqual(placement.outcomes, []);

    await scenario.callback(() => practice.options.onDone());
    assert.deepStrictEqual(practice.outcomes, ['completed'], 'the owner is untouched');
    scenario.unmountAll();
  });

  await runTest('setup that never settles times out, releases ownership, and stays retryable', async () => {
    const { scenario, control } = setupScenario();
    await scenario.render(['practice']);

    control.holdVoices = true;
    const hung = await scenario.startPlay('practice');
    assert.strictEqual(scenario.timers.size, 1, 'setup is bounded by a timer');

    await scenario.fireTimers();
    assert.strictEqual(await hung.settled, 'Audio setup timed out');
    assert.deepStrictEqual(hung.outcomes, ['playback-error']);
    assert.strictEqual(scenario.hooks.practice.isSpeaking, false);
    assert.strictEqual(scenario.speakCalls.length, 0);

    // The late lookup result must not start speech for the abandoned request.
    control.heldVoiceLookups.forEach((resolve) => resolve([VOICE]));
    await scenario.flush();
    assert.strictEqual(scenario.speakCalls.length, 0);

    control.holdVoices = false;
    const retry = await scenario.play('practice');
    assert.strictEqual(scenario.speakCalls.length, 1, 'the retry reaches native speech');
    assert.deepStrictEqual(retry.outcomes, []);
    scenario.unmountAll();
  });

  await runTest('an initially empty voice inventory is asked for again on the next playback', async () => {
    let voices = [];
    const scenario = createScenario({ getAvailableVoicesAsync: async () => voices });
    await scenario.render(['practice']);

    const unavailable = await scenario.startPlay('practice');
    assert.match(await unavailable.settled, /TTS not available/);
    await scenario.flush();

    voices = [VOICE];
    await scenario.play('practice');
    assert.strictEqual(scenario.speakCalls.length, 1);
    scenario.unmountAll();
  });

  await runTest('audio initialization that never settles still becomes ready', async () => {
    const scenario = createScenario({ setAudioModeAsync: () => new Promise(() => {}) });
    await scenario.render(['practice']);
    assert.strictEqual(scenario.hooks.practice.audioModeReady, false);
    await scenario.fireTimers();
    await scenario.render(['practice']);
    assert.strictEqual(scenario.hooks.practice.audioModeReady, true);
    scenario.unmountAll();
  });
})().finally(() => {
  Object.assign(globalThis, previousGlobals);
});
