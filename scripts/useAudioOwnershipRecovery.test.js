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
const coordinatorSource = fs.readFileSync(
  path.join(ROOT, 'src', 'domain', 'speechPlaybackCoordinator.ts'),
  'utf8'
);

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
function createAudioScenario({
  rate = 0.85,
  useDevelopmentExperiment = false,
  experimentMode = 'retained',
} = {}) {
  const timers = createControllableTimers();
  const harness = createHookHarness();
  const speakCalls = [];
  const experimentSpeakCalls = [];
  // Recovery diagnostics deliberately emit outside __DEV__, so capture them
  // rather than letting them pollute the suite output — and assert on them.
  const diagnostics = [];
  const capturingConsole = {
    ...console,
    log(prefix, event) {
      if (prefix === '[tts-playback]') {
        diagnostics.push(event);
        return;
      }
      console.log(prefix, event);
    },
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
      '@/src/experiments/ttsSynthesizerLifecycleExperiment': {
        resolveSpeechSynthesizerLifecycleMode({
          isDevelopment,
          platform,
          experimentMode: selectedMode,
        }) {
          if (!isDevelopment || platform !== 'ios') {
            return 'expo-retained-production-path';
          }
          return selectedMode === 'retained'
            ? 'experimental-retained'
            : 'experimental-reset-per-utterance';
        },
        speakWithSynthesizerLifecycleExperiment(
          word,
          options,
          selectedMode,
          onLifecycleMetadata
        ) {
          experimentSpeakCalls.push({
            word,
            options,
            selectedMode,
            onLifecycleMetadata,
          });
        },
      },
      // Metro resolves this asset require; Node cannot.
      '../../assets/audio/silent.mp3': 1,
    },
    {
      ...timers.globals,
      console: capturingConsole,
      __DEV__: useDevelopmentExperiment,
    }
  );

  const render = () =>
    harness.renderUntilStable(() =>
      useAudio(PAIR, rate, () => VOICE)
    );

  return {
    timers,
    speakCalls,
    experimentSpeakCalls,
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

runTest(
  'the retained development arm preserves callbacks and exposes native lifecycle evidence',
  async () => {
    const scenario = createAudioScenario({ useDevelopmentExperiment: true });
    let hook = await playOnce(scenario);

    assert.strictEqual(scenario.speakCalls.length, 0);
    assert.strictEqual(scenario.experimentSpeakCalls.length, 1);
    const submission = scenario.experimentSpeakCalls[0];
    assert.strictEqual(submission.word, 'oath');
    assert.strictEqual(submission.selectedMode, 'retained');

    const metadata = {
      synthesizerInstanceIdentifier: 'experimental-synthesizer-1',
      synthesizerCreationCount: 1,
    };
    submission.onLifecycleMetadata(metadata);
    submission.options.onStart();
    submission.onLifecycleMetadata(metadata);
    submission.options.onDone();
    hook = scenario.render();

    assert.strictEqual(hook.isSpeaking, false);
    const started = scenario.diagnostics.find(
      (event) => event.phase === 'started'
    );
    const completed = scenario.diagnostics.find(
      (event) => event.phase === 'completed'
    );
    assert.deepStrictEqual(
      {
        mode: started.synthesizerLifecycleMode,
        identifier: started.synthesizerInstanceIdentifier,
        creationCount: started.synthesizerCreationCount,
      },
      {
        mode: 'experimental-retained',
        identifier: 'experimental-synthesizer-1',
        creationCount: 1,
      }
    );
    assert.strictEqual(
      completed.synthesizerInstanceIdentifier,
      'experimental-synthesizer-1'
    );
  }
);

runTest(
  'the experiment arm leaves the Commit 1 watchdog recovery path intact',
  async () => {
    const scenario = createAudioScenario({
      useDevelopmentExperiment: true,
      experimentMode: 'reset-per-utterance',
    });
    let hook = await playOnce(scenario);

    assert.strictEqual(scenario.experimentSpeakCalls.length, 1);
    assert.strictEqual(hook.isSpeaking, true);

    scenario.timers.advanceTo(9000);
    scenario.timers.expireAll();
    hook = scenario.render();
    assert.strictEqual(hook.isSpeaking, false);

    await hook.play(0);
    await flushPromises();
    assert.strictEqual(scenario.experimentSpeakCalls.length, 2);
  }
);

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

runTest('the Commit 2 experiment leaves coordinator ownership lifecycle-agnostic', () => {
  for (const forbidden of ['recycle', 'recreateSynthesizer', 'ttsRecycle']) {
    assert.ok(
      !new RegExp(forbidden, 'i').test(coordinatorSource),
      `the validated coordinator must not reference ${forbidden}`
    );
  }
});

module.exports = runAll();
