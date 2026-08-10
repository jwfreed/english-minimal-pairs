// Integration coverage for the playback ownership recovery floor.
//
// These render the real useAudio hook against the real coordinator and the
// real budget derivation; only the host boundaries (react, react-native,
// expo-speech, expo-audio, the silent-warmup player) are substituted. Fake
// timer globals are injected into the module context so the module-singleton
// coordinator's default scheduler is driven deterministically — there is no
// Jest and therefore no fake-timer support in scripts/run-tests.js.
//
// The failure being guarded: before this floor existed, a lost native terminal
// callback left the coordinator's activeAttempt set forever, so every later
// press was rejected as a duplicate and TTS was dead for the rest of the
// process with no user-visible error.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHookHarness } = require('./helpers/hookHarness');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const useAudioPath = path.join(ROOT, 'src', 'hooks', 'useAudio.ts');
const useAudioSource = fs.readFileSync(useAudioPath, 'utf8');

const tests = [];

function runTest(name, fn) {
  tests.push({ name, fn });
}

async function runAll() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      throw error;
    }
  }
}

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function createControllableTimers(startingNowMs = 1000) {
  let nextTimerId = 1;
  let nowMs = startingNowMs;
  const timers = new Map();

  return {
    globals: {
      setTimeout(callback, delayMs) {
        const timerId = nextTimerId++;
        timers.set(timerId, { callback, delayMs });
        return timerId;
      },
      clearTimeout(timerId) {
        timers.delete(timerId);
      },
      Date: { now: () => nowMs },
    },
    advanceTo(nextNowMs) {
      nowMs = nextNowMs;
    },
    pendingDelays() {
      return [...timers.values()].map((timer) => timer.delayMs);
    },
    expireAll() {
      const pending = [...timers.values()];
      timers.clear();
      for (const timer of pending) timer.callback();
      return pending.length;
    },
  };
}

const PAIR = {
  word1: 'oath',
  word2: 'oaths',
  ipa1: '/oʊθ/',
  ipa2: '/oʊðz/',
  difficulty: 1,
  group: 'thTH',
  position: 'final',
  contrastPhoneme1: 'θ',
  contrastPhoneme2: 'ð',
};

const VOICE = {
  identifier: 'com.apple.eloquence.en-GB.Reed',
  name: 'Reed',
  language: 'en-GB',
  quality: 'Default',
};

/**
 * Renders the real useAudio hook with host boundaries substituted and the
 * coordinator's timers under test control.
 */
function createAudioScenario({ rate = 0.85, pair = PAIR } = {}) {
  const timers = createControllableTimers();
  const harness = createHookHarness();
  const speakCalls = [];
  // Recovery diagnostics deliberately emit outside __DEV__, so capture them
  // rather than letting them pollute the suite output — and assert on them.
  const diagnostics = [];
  const capturingConsole = {
    ...console,
    warn(prefix, event) {
      if (prefix === '[tts-playback]') {
        diagnostics.push(event);
        return;
      }
      console.warn(prefix, event);
    },
  };

  const speechMock = {
    speak(word, options) {
      speakCalls.push({ word, options });
    },
    async getAvailableVoicesAsync() {
      return [VOICE];
    },
  };

  const { useAudio } = loadTsModule(
    useAudioPath,
    new Map(),
    {
      react: harness.react,
      'react-native': { Platform: { OS: 'ios' } },
      'expo-speech': speechMock,
      'expo-audio': { setAudioModeAsync: async () => {} },
      '@/src/hooks/useSilentWarmupPlayer': {
        useSilentWarmupPlayer: () => ({ play() {} }),
      },
      // Metro resolves this asset require; Node cannot.
      '../../assets/audio/silent.mp3': 1,
    },
    { ...timers.globals, console: capturingConsole }
  );

  const render = () =>
    harness.renderUntilStable(() =>
      useAudio(pair, rate, () => VOICE)
    );

  return {
    timers,
    speakCalls,
    diagnostics,
    render,
    unmount: harness.unmount,
    lastOptions: () => speakCalls[speakCalls.length - 1]?.options,
    diagnosticPhases: () => diagnostics.map((event) => event.phase),
  };
}

async function playOnce(scenario, idx = 0) {
  const hook = scenario.render();
  await hook.play(idx);
  await flushPromises();
  return scenario.render();
}

runTest(
  'a lost start callback releases ownership so the next press still speaks',
  async () => {
    const scenario = createAudioScenario();
    let hook = await playOnce(scenario);

    assert.strictEqual(scenario.speakCalls.length, 1);
    assert.strictEqual(hook.isSpeaking, true);

    // Native never calls onStart or any terminal callback.
    scenario.timers.advanceTo(9000);
    scenario.timers.expireAll();
    hook = scenario.render();

    assert.strictEqual(
      hook.isSpeaking,
      false,
      'the watchdog must clear the speaking state the UI renders from'
    );

    await hook.play(0);
    await flushPromises();
    assert.strictEqual(
      scenario.speakCalls.length,
      2,
      'the press after a timeout must reach native speech, not be rejected as a duplicate'
    );
    assert.deepStrictEqual(scenario.diagnosticPhases(), [
      'ownership-timeout-awaiting-start',
    ]);
    assert.strictEqual(scenario.diagnostics[0].playbackStartedAtMs, null);
  }
);

runTest(
  'a lost terminal callback after a real start releases ownership',
  async () => {
    const scenario = createAudioScenario();
    let hook = await playOnce(scenario);

    scenario.lastOptions().onStart();
    hook = scenario.render();
    assert.strictEqual(hook.isSpeaking, true);

    scenario.timers.expireAll();
    hook = scenario.render();

    assert.strictEqual(hook.isSpeaking, false);
    await hook.play(1);
    await flushPromises();
    assert.strictEqual(scenario.speakCalls.length, 2);
    assert.deepStrictEqual(scenario.diagnosticPhases(), [
      'ownership-timeout-awaiting-terminal',
    ]);
  }
);

runTest(
  'a terminal callback arriving after a timeout does not disturb the next playback',
  async () => {
    const scenario = createAudioScenario();
    let hook = await playOnce(scenario);
    const abandonedOptions = scenario.lastOptions();

    abandonedOptions.onStart();
    scenario.timers.expireAll();
    hook = scenario.render();

    await hook.play(0);
    await flushPromises();
    hook = scenario.render();
    assert.strictEqual(scenario.speakCalls.length, 2);
    assert.strictEqual(hook.isSpeaking, true);

    // The abandoned utterance finally reports in, after a newer request owns
    // playback. It must not clear the newer request's speaking state.
    abandonedOptions.onDone();
    hook = scenario.render();

    assert.strictEqual(
      hook.isSpeaking,
      true,
      'a late callback from a timed-out request must not release the newer playback'
    );

    assert.deepStrictEqual(scenario.diagnosticPhases(), [
      'ownership-timeout-awaiting-terminal',
      'late-callback-after-timeout',
    ]);

    scenario.lastOptions().onDone();
    hook = scenario.render();
    assert.strictEqual(hook.isSpeaking, false);
  }
);

runTest('the hook arms the derived budgets rather than an ad-hoc constant', async () => {
  const { deriveSpeechTimeoutBudgets } = loadTsModule(
    path.join(ROOT, 'src', 'domain', 'audioPlayback.ts')
  );
  const expected = deriveSpeechTimeoutBudgets({ word: 'oath', rate: 0.85 });
  const scenario = createAudioScenario({ rate: 0.85 });

  await playOnce(scenario);
  assert.deepStrictEqual(scenario.timers.pendingDelays(), [
    expected.startBudgetMs,
  ]);

  scenario.lastOptions().onStart();
  assert.deepStrictEqual(scenario.timers.pendingDelays(), [
    expected.completionBudgetMs,
  ]);
});

runTest('a normal completion leaves no timer armed', async () => {
  const scenario = createAudioScenario();
  await playOnce(scenario);

  scenario.lastOptions().onStart();
  scenario.lastOptions().onDone();

  assert.deepStrictEqual(scenario.timers.pendingDelays(), []);
});

runTest('one play observer receives only its request-scoped start and completion', async () => {
  const scenario = createAudioScenario();
  const outcomes = [];
  const hook = scenario.render();

  await hook.play(0, (outcome) => outcomes.push(outcome));
  await flushPromises();
  scenario.lastOptions().onStart();
  scenario.lastOptions().onDone();

  assert.deepStrictEqual(
    outcomes.map(({ kind, requestId }) => ({ kind, requestId })),
    [
      { kind: 'started', requestId: outcomes[0]?.requestId },
      { kind: 'completed', requestId: outcomes[0]?.requestId },
    ]
  );
  assert.match(outcomes[0].requestId, /^tts-/);
});

runTest('a rejected duplicate reports its allocated request id only to that invocation', async () => {
  const scenario = createAudioScenario();
  const firstOutcomes = [];
  const rejectedOutcomes = [];
  const hook = scenario.render();

  await hook.play(0, (outcome) => firstOutcomes.push(outcome));
  await hook.play(1, (outcome) => rejectedOutcomes.push(outcome));

  assert.deepStrictEqual(firstOutcomes, []);
  assert.strictEqual(rejectedOutcomes.length, 1);
  assert.strictEqual(rejectedOutcomes[0].kind, 'failed');
  assert.strictEqual(rejectedOutcomes[0].reason, 'request-rejected');
  assert.match(rejectedOutcomes[0].requestId, /^tts-/);
});

runTest('a late callback from an older request cannot reach a newer observer', async () => {
  const scenario = createAudioScenario();
  const firstOutcomes = [];
  const secondOutcomes = [];
  let hook = scenario.render();

  await hook.play(0, (outcome) => firstOutcomes.push(outcome));
  await flushPromises();
  const oldOptions = scenario.lastOptions();
  oldOptions.onStart();
  scenario.timers.expireAll();

  hook = scenario.render();
  await hook.play(1, (outcome) => secondOutcomes.push(outcome));
  await flushPromises();
  const newOptions = scenario.lastOptions();
  oldOptions.onDone();
  newOptions.onStart();
  newOptions.onDone();

  assert.deepStrictEqual(
    firstOutcomes.map(({ kind, reason }) => ({ kind, reason })),
    [
      { kind: 'started', reason: undefined },
      { kind: 'failed', reason: 'completion-timeout' },
    ]
  );
  assert.deepStrictEqual(
    secondOutcomes.map(({ kind }) => kind),
    ['started', 'completed']
  );
  assert.notStrictEqual(
    firstOutcomes[0].requestId,
    secondOutcomes[0].requestId
  );
});

runTest('failure before coordinator admission does not fabricate a request id', async () => {
  const scenario = createAudioScenario({ pair: null });
  const outcomes = [];
  const hook = scenario.render();

  await assert.rejects(
    hook.play(0, (outcome) => outcomes.push(outcome)),
    /No pair selected/
  );
  assert.deepStrictEqual(outcomes, []);
});

runTest('unmounting stops timeout notifications without locking ownership', async () => {
  const scenario = createAudioScenario();
  await playOnce(scenario);

  scenario.unmount();
  assert.doesNotThrow(() => scenario.timers.expireAll());

  // A fresh mount must find the coordinator free rather than permanently owned
  // by the request the unmounted tree abandoned.
  const remounted = scenario.render();
  await remounted.play(0);
  await flushPromises();
  assert.strictEqual(scenario.speakCalls.length, 2);
});

// ---------------------------------------------------------------------------
// Commit boundary guards. Commit 1 is the reliability floor only; synthesizer
// lifecycle work belongs to Commit 2 behind its own experiment flag.
// ---------------------------------------------------------------------------

runTest('the reliability floor introduces no Speech.stop() call', () => {
  assert.ok(
    !/Speech\.stop\(/.test(useAudioSource),
    'Speech.stop() is a native behavior this app has never used; it requires its own device validation and is out of scope for Commit 1'
  );
});

runTest('the reliability floor introduces no synthesizer lifecycle concepts', () => {
  // Deliberately narrow. useAudio already carries an explanatory comment about
  // AVSpeechSynthesizer audio-session latching and the pre-existing silent-warmup
  // experiment selector; neither is Commit 2 work. What must not appear is the
  // recycling policy itself.
  for (const forbidden of ['recycle', 'recreateSynthesizer', 'ttsRecycle']) {
    assert.ok(
      !new RegExp(forbidden, 'i').test(useAudioSource),
      `Commit 1 must not reference ${forbidden}; that is Commit 2's boundary`
    );
  }
});

module.exports = runAll();
