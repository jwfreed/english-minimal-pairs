const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  createSpeechPlaybackDiagnostics,
} = loadTsModule(
  path.join(
    __dirname,
    '..',
    'src',
    'diagnostics',
    'speechPlaybackDiagnostics.ts'
  ),
  new Map(),
  {
    'react-native': {
      AppState: {
        currentState: 'active',
        addEventListener() {
          return { remove() {} };
        },
      },
    },
  }
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function makeTime(monotonicTimestampMs) {
  return {
    monotonicTimestampMs,
    epochTimestampMs: 1_000_000 + monotonicTimestampMs,
    monotonicClockSource: 'performance.now',
  };
}

function makeAudioSession() {
  return {
    configuredIntent: {
      category: 'playback',
      mode: 'default',
      options: ['duckOthers'],
    },
    audioModeConfigured: true,
    experimentVariant: 'A-silent-warmup',
    silentWarmupEnabled: true,
  };
}

function makeAttemptInput(requestId, voiceIdentifier, acquiredAtMs) {
  return {
    requestId,
    voiceIdentifier,
    coordinatorAcquiredAt: makeTime(acquiredAtMs),
    audioSession: makeAudioSession(),
  };
}

const REQUIRED_EVENT_FIELDS = [
  'phase',
  'diagnosticSessionId',
  'requestId',
  'utteranceSequenceNumber',
  'isFirstPlaybackSinceLaunch',
  'voiceIdentifier',
  'isFirstPlaybackForVoice',
  'playbackCountForVoice',
  'monotonicTimestampMs',
  'epochTimestampMs',
  'monotonicClockSource',
  'coordinatorAcquiredAtMonotonicMs',
  'speechOptionsCreatedAtMonotonicMs',
  'speechSpeakInvokedAtMonotonicMs',
  'speechSpeakReturnedAtMonotonicMs',
  'nativeStartCallbackAtMonotonicMs',
  'nativeTerminalCallbackAtMonotonicMs',
  'coordinatorReleasedAtMonotonicMs',
  'audioSession',
];

const useAudioSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'useAudio.ts'),
  'utf8'
);
const diagnosticsSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'diagnostics',
    'speechPlaybackDiagnostics.ts'
  ),
  'utf8'
);

runTest('accepted attempts number playback and per-voice use since process launch', () => {
  const diagnostics = createSpeechPlaybackDiagnostics({
    enabled: true,
    diagnosticSessionId: 'session-a',
    sink() {},
  });

  const first = diagnostics.createAttempt(
    makeAttemptInput('request-1', 'voice-a', 10)
  );
  const second = diagnostics.createAttempt(
    makeAttemptInput('request-2', 'voice-a', 20)
  );
  const third = diagnostics.createAttempt(
    makeAttemptInput('request-3', 'voice-b', 30)
  );

  assert.strictEqual(first.utteranceSequenceNumber, 1);
  assert.strictEqual(first.isFirstPlaybackSinceLaunch, true);
  assert.strictEqual(first.isFirstPlaybackForVoice, true);
  assert.strictEqual(first.playbackCountForVoice, 1);
  assert.strictEqual(second.utteranceSequenceNumber, 2);
  assert.strictEqual(second.isFirstPlaybackSinceLaunch, false);
  assert.strictEqual(second.isFirstPlaybackForVoice, false);
  assert.strictEqual(second.playbackCountForVoice, 2);
  assert.strictEqual(third.utteranceSequenceNumber, 3);
  assert.strictEqual(third.isFirstPlaybackForVoice, true);
  assert.strictEqual(third.playbackCountForVoice, 1);
});

runTest('lifecycle snapshots contain required fields in boundary order', () => {
  const events = [];
  const diagnostics = createSpeechPlaybackDiagnostics({
    enabled: true,
    diagnosticSessionId: 'session-a',
    sink(_prefix, event) {
      events.push(event);
    },
  });
  diagnostics.recordSilentWarmupPlayInvoked();
  const attempt = diagnostics.createAttempt(
    makeAttemptInput('request-1', 'voice-a', 10)
  );

  diagnostics.recordPhase(attempt, 'coordinator-acquired', makeTime(10));
  diagnostics.recordPhase(attempt, 'speech-options-created', makeTime(20));
  diagnostics.recordPhase(attempt, 'speech-speak-invoked', makeTime(30));
  diagnostics.recordPhase(attempt, 'speech-speak-returned', makeTime(31));
  diagnostics.recordPhase(attempt, 'native-started', makeTime(40));
  diagnostics.recordPhase(
    attempt,
    'native-finished-coordinator-released',
    makeTime(70),
    {
      coordinatorReleasedAtMonotonicMs: 71,
    }
  );

  assert.deepStrictEqual(
    events.map((event) => event.phase),
    [
      'coordinator-acquired',
      'speech-options-created',
      'speech-speak-invoked',
      'speech-speak-returned',
      'native-started',
      'native-finished-coordinator-released',
    ]
  );
  assert.deepStrictEqual(
    events.map((event) => event.monotonicTimestampMs),
    [10, 20, 30, 31, 40, 70]
  );

  for (const event of events) {
    for (const field of REQUIRED_EVENT_FIELDS) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(event, field),
        `${event.phase} missing ${field}`
      );
    }
    assert.strictEqual(event.audioSession.configuredIntent.category, 'playback');
    assert.strictEqual(event.audioSession.configuredIntent.mode, 'default');
    assert.deepStrictEqual(
      Array.from(event.audioSession.configuredIntent.options),
      ['duckOthers']
    );
    assert.strictEqual(event.audioSession.silentWarmupPlayInvoked, true);
    assert.strictEqual(event.audioSession.nativeState.active, 'unavailable');
    assert.strictEqual(event.audioSession.nativeState.route, 'unavailable');
    assert.strictEqual(
      event.audioSession.nativeState.reason,
      'not-exposed-by-current-js-api'
    );
  }

  const terminal = events.at(-1);
  assert.strictEqual(terminal.speechOptionsCreatedAtMonotonicMs, 20);
  assert.strictEqual(terminal.speechSpeakInvokedAtMonotonicMs, 30);
  assert.strictEqual(terminal.speechSpeakReturnedAtMonotonicMs, 31);
  assert.strictEqual(terminal.nativeStartCallbackAtMonotonicMs, 40);
  assert.strictEqual(terminal.nativeTerminalCallbackAtMonotonicMs, 70);
  assert.strictEqual(terminal.coordinatorReleasedAtMonotonicMs, 71);
});

runTest('runtime session continues through background and resume transitions', () => {
  const events = [];
  let appStateListener;
  const diagnostics = createSpeechPlaybackDiagnostics({
    enabled: true,
    diagnosticSessionId: 'session-a',
    sink(_prefix, event) {
      events.push(event);
    },
    captureTime: (() => {
      let now = 100;
      return () => makeTime(now++);
    })(),
  });

  diagnostics.observeAppState({
    currentState: 'active',
    addEventListener(_eventName, listener) {
      appStateListener = listener;
      return { remove() {} };
    },
  });
  diagnostics.createAttempt(makeAttemptInput('request-1', 'voice-a', 10));
  appStateListener('background');
  appStateListener('active');
  const resumedAttempt = diagnostics.createAttempt(
    makeAttemptInput('request-2', 'voice-a', 20)
  );

  const transitions = events.filter(
    (event) => event.phase === 'app-state-changed'
  );
  assert.deepStrictEqual(
    transitions.map((event) => [event.previousAppState, event.nextAppState]),
    [
      ['active', 'background'],
      ['background', 'active'],
    ]
  );
  assert.ok(
    transitions.every((event) => event.diagnosticSessionId === 'session-a')
  );
  assert.strictEqual(transitions[0].utteranceSequenceNumberAtTransition, 1);
  assert.strictEqual(resumedAttempt.utteranceSequenceNumber, 2);
});

runTest('disabled diagnostics do not invoke the sink or allocate attempts', () => {
  let sinkCalls = 0;
  const diagnostics = createSpeechPlaybackDiagnostics({
    enabled: false,
    diagnosticSessionId: 'disabled-session',
    sink() {
      sinkCalls += 1;
    },
  });

  assert.doesNotThrow(() => diagnostics.recordSilentWarmupPlayInvoked());
  const attempt = diagnostics.createAttempt(
    makeAttemptInput('request-1', 'voice-a', 10)
  );
  assert.strictEqual(attempt, null);
  assert.doesNotThrow(() =>
    diagnostics.recordPhase(null, 'coordinator-acquired', makeTime(10))
  );
  assert.strictEqual(sinkCalls, 0);
});

runTest('throwing clocks, sinks, and app-state sources never escape diagnostics', () => {
  const diagnostics = createSpeechPlaybackDiagnostics({
    enabled: true,
    diagnosticSessionId: 'session-a',
    sink() {
      throw new Error('sink failed');
    },
    captureTime() {
      throw new Error('clock failed');
    },
  });

  assert.doesNotThrow(() => diagnostics.captureTime());
  const attempt = diagnostics.createAttempt(
    makeAttemptInput('request-1', 'voice-a', 10)
  );
  assert.ok(attempt);
  assert.doesNotThrow(() =>
    diagnostics.recordPhase(
      attempt,
      'coordinator-acquired',
      makeTime(10),
      { coordinatorObservedOwnershipCount: 1 }
    )
  );
  assert.doesNotThrow(() =>
    diagnostics.observeAppState({
      get currentState() {
        throw new Error('app state failed');
      },
      addEventListener() {
        throw new Error('listener failed');
      },
    })
  );
});

runTest('useAudio instruments every approved JS and native callback boundary', () => {
  const phases = [
    'coordinator-acquired',
    'speech-options-created',
    'speech-speak-invoked',
    'speech-speak-returned',
    'native-started',
    'native-finished-coordinator-released',
    'native-stopped-coordinator-released',
    'native-error-coordinator-released',
    'submission-failed-coordinator-released',
  ];

  for (const phase of phases) {
    assert.ok(useAudioSource.includes(`'${phase}'`), `missing ${phase}`);
  }
  const invokedCaptureIndex = useAudioSource.indexOf(
    'speechSpeakInvokedDiagnosticTime = captureSpeechDiagnosticTime()'
  );
  const speakIndex = useAudioSource.indexOf(
    'Speech.speak(word, speechOptions);'
  );
  const returnedCaptureIndex = useAudioSource.indexOf(
    'const speechSpeakReturnedDiagnosticTime = captureSpeechDiagnosticTime()'
  );
  const submitSpeechIndex = useAudioSource.indexOf(
    'speechPlaybackCoordinator.submitSpeech('
  );
  const invokedEventIndex = useAudioSource.indexOf("'speech-speak-invoked'");
  const returnedEventIndex = useAudioSource.indexOf("'speech-speak-returned'");
  assert.ok(
    invokedCaptureIndex < speakIndex &&
      speakIndex < returnedCaptureIndex &&
      returnedCaptureIndex < submitSpeechIndex &&
      submitSpeechIndex < invokedEventIndex &&
      returnedCaptureIndex < invokedEventIndex &&
      invokedEventIndex < returnedEventIndex,
    'timestamps must bracket Speech.speak without delaying coordinator submission'
  );
});

runTest('diagnostic integration preserves useAudio hook and speech option shape', () => {
  assert.strictEqual(
    (useAudioSource.match(/useState\(/g) || []).length,
    2,
    'diagnostics must not add React state'
  );
  assert.strictEqual(
    (useAudioSource.match(/useRef(?:<[^>]+>)?\(/g) || []).length,
    3,
    'diagnostics must not add React refs'
  );
  assert.strictEqual(
    (useAudioSource.match(/Speech\.speak\(/g) || []).length,
    1,
    'the production hook must retain one Speech.speak call site'
  );
  assert.ok(
    useAudioSource.includes('...buildSpeechOptions({'),
    'the existing speech option builder remains authoritative'
  );
  assert.ok(
    useAudioSource.includes(
      '}, [debugError, debugLog, debugWarn, silentWarmupPlayer]);'
    ),
    'audio initialization dependencies must remain unchanged'
  );
  assert.ok(
    /\[\s*debugError,\s*debugLog,\s*debugWarn,\s*rate,\s*selectedPair,\s*getNextVoice,\s*updateIsSpeaking,\s*\]/.test(
      useAudioSource
    ),
    'play callback dependencies must remain unchanged'
  );
});

runTest('production diagnostic singleton remains development-only', () => {
  assert.ok(
    diagnosticsSource.includes('enabled: __DEV__'),
    'the production singleton must be disabled outside development builds'
  );
  assert.ok(
    diagnosticsSource.includes('if (__DEV__) {'),
    'AppState observation must be installed only in development builds'
  );
});
