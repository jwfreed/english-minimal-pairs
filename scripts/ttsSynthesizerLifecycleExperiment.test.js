const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const projectRoot = path.join(__dirname, '..');
const expoSpeechRoot = path.join(projectRoot, 'node_modules', 'expo-speech');
const experimentIosRoot = path.join(
  projectRoot,
  'modules',
  'tts-synthesizer-lifecycle-experiment',
  'ios'
);
const lifecycleOwnerPath = path.join(
  experimentIosRoot,
  'SynthesizerLifecycleOwner.swift'
);
const experimentModulePath = path.join(
  experimentIosRoot,
  'TtsSynthesizerLifecycleExperimentModule.swift'
);

const expoSpeechPackage = JSON.parse(
  fs.readFileSync(path.join(expoSpeechRoot, 'package.json'), 'utf8')
);
const expoSpeechModuleSource = fs.readFileSync(
  path.join(expoSpeechRoot, 'ios', 'SpeechModule.swift'),
  'utf8'
);
const expoSpeechDelegateSource = fs.readFileSync(
  path.join(expoSpeechRoot, 'ios', 'SpeechDelegate.swift'),
  'utf8'
);
const experimentModuleSource = fs.readFileSync(experimentModulePath, 'utf8');

runTest('native parity target is Expo Speech 14.0.7 with one retained synthesizer', () => {
  assert.strictEqual(expoSpeechPackage.version, '14.0.7');
  assert.ok(
    expoSpeechModuleSource.includes(
      'private var synthesizer = AVSpeechSynthesizer()'
    )
  );
  assert.strictEqual(
    (expoSpeechModuleSource.match(/synthesizer\.speak\(utterance\)/g) || [])
      .length,
    1
  );
});

runTest('native experiment preserves Expo utterance configuration order and conversions', () => {
  const utterance = experimentModuleSource.search(
    /TtsSynthesizerLifecycleExperimentUtterance\(\s*id: utteranceId,\s*text: text\s*\)/
  );
  const language = experimentModuleSource.indexOf(
    'if let language = options.language'
  );
  const voice = experimentModuleSource.indexOf('if let voice = options.voice');
  const pitch = experimentModuleSource.indexOf(
    'utterance.pitchMultiplier = Float(pitch)'
  );
  const rate = experimentModuleSource.indexOf(
    'utterance.rate = Float(rate) * AVSpeechUtteranceDefaultSpeechRate'
  );
  const session = experimentModuleSource.indexOf(
    'synthesizer.usesApplicationAudioSession = useApplicationAudioSession'
  );

  assert.ok(utterance >= 0);
  assert.ok(utterance < language && language < voice);
  assert.ok(voice < pitch && pitch < rate && rate < session);
  assert.ok(experimentModuleSource.includes('guard utterance.voice != nil else'));
  assert.ok(
    experimentModuleSource.includes(
      'throw TtsSynthesizerLifecycleExperimentInvalidVoiceException(voice)'
    )
  );
});

runTest('native experiment preserves Expo start boundary finish and cancel events', () => {
  for (const callback of [
    'didStart utterance',
    'willSpeakRangeOfSpeechString characterRange',
    'didCancel utterance',
    'didFinish utterance',
  ]) {
    assert.ok(expoSpeechDelegateSource.includes(callback), callback);
    assert.ok(experimentModuleSource.includes(callback), callback);
  }

  for (const payload of [
    '"id": utterance.id',
    '"charIndex": characterRange.location',
    '"charLength": characterRange.length',
    '"synthesizerInstanceIdentifier": utterance.synthesizerInstanceIdentifier',
    '"synthesizerCreationCount": utterance.synthesizerCreationCount',
  ]) {
    assert.ok(experimentModuleSource.includes(payload), payload);
  }
});

runTest('native experiment keeps stop immediate and does not add an error event', () => {
  assert.strictEqual(
    (experimentModuleSource.match(/stopSpeaking\(at: \.immediate\)/g) || [])
      .length,
    1
  );
  assert.ok(!experimentModuleSource.includes('speakingError'));
  assert.ok(!experimentModuleSource.includes('asyncAfter'));
  assert.ok(!experimentModuleSource.includes('Thread.sleep'));
});

runTest('retained reuses one instance while reset creates one per utterance', () => {
  if (process.platform !== 'darwin') {
    console.log('skip - Swift allocation policy harness requires macOS');
    return;
  }

  const binaryPath = path.join(
    os.tmpdir(),
    `tts-synthesizer-lifecycle-owner-${process.pid}`
  );
  const compile = spawnSync(
    'xcrun',
    [
      'swiftc',
      lifecycleOwnerPath,
      path.join(__dirname, 'ttsSynthesizerLifecycleOwnerTests.swift'),
      '-o',
      binaryPath,
    ],
    { encoding: 'utf8' }
  );

  try {
    assert.strictEqual(
      compile.status,
      0,
      `Swift allocation policy compile failed:\n${compile.stdout}\n${compile.stderr}`
    );
    const run = spawnSync(binaryPath, [], { encoding: 'utf8' });
    assert.strictEqual(
      run.status,
      0,
      `Swift allocation policy test failed:\n${run.stdout}\n${run.stderr}`
    );
    assert.match(run.stdout, /ok - retained instance 1,1,1; reset instances 1,2,3/);
  } finally {
    fs.rmSync(binaryPath, { force: true });
  }
});

const adapterPath = path.join(
  projectRoot,
  'src',
  'experiments',
  'ttsSynthesizerLifecycleExperiment.ts'
);
const { loadTsModule } = require('./load-ts-module');
const {
  createTtsSynthesizerLifecycleExperimentAdapter: createAdapter,
  resolveSpeechSynthesizerLifecycleMode: resolveMode,
} = loadTsModule(adapterPath, new Map(), {
  'expo-modules-core': {
    requireOptionalNativeModule() {
      return null;
    },
  },
});

function makeNativeModule() {
  const listeners = new Map();
  const speakCalls = [];
  let stopCalls = 0;
  return {
    listeners,
    speakCalls,
    get stopCalls() {
      return stopCalls;
    },
    addListener(name, listener) {
      listeners.set(name, listener);
      return { remove() {} };
    },
    speak(...args) {
      speakCalls.push(args);
    },
    stop() {
      stopCalls += 1;
    },
  };
}

function completeSpeechOptions(overrides = {}) {
  return {
    language: 'en-US',
    voice: 'voice-a',
    pitch: 1,
    rate: 0.8,
    volume: 1,
    useApplicationAudioSession: false,
    onStart() {},
    onBoundary() {},
    onDone() {},
    onStopped() {},
    onError() {},
    ...overrides,
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

runTest('adapter passes identical text and native options in both lifecycle modes', () => {
  const retainedNative = makeNativeModule();
  const resetNative = makeNativeModule();
  const retained = createAdapter({ nativeModule: retainedNative });
  const reset = createAdapter({ nativeModule: resetNative });

  retained.speak('right', completeSpeechOptions(), 'retained');
  reset.speak('right', completeSpeechOptions(), 'reset-per-utterance');

  const retainedCall = retainedNative.speakCalls[0];
  const resetCall = resetNative.speakCalls[0];
  assert.strictEqual(retainedCall[1], 'right');
  assert.strictEqual(resetCall[1], 'right');
  assert.deepStrictEqual(plain(retainedCall[2]), {
    language: 'en-US',
    pitch: 1,
    rate: 0.8,
    voice: 'voice-a',
    useApplicationAudioSession: false,
  });
  assert.deepStrictEqual(plain(resetCall[2]), plain(retainedCall[2]));
  assert.strictEqual(retainedCall[3], 'retained');
  assert.strictEqual(resetCall[3], 'reset-per-utterance');
});

runTest('adapter forwards lifecycle metadata before start and terminal callbacks', () => {
  const nativeModule = makeNativeModule();
  const adapter = createAdapter({ nativeModule });
  const observed = [];
  adapter.speak(
    'right',
    completeSpeechOptions({
      onStart() {
        observed.push('start');
      },
      onDone() {
        observed.push('done');
      },
    }),
    'retained',
    (metadata) => observed.push(metadata)
  );

  const [utteranceId] = nativeModule.speakCalls[0];
  const payload = {
    id: utteranceId,
    synthesizerInstanceIdentifier: 'experimental-synthesizer-1',
    synthesizerCreationCount: 1,
  };
  nativeModule.listeners.get('TtsLifecycleExperiment.speakingStarted')(payload);
  nativeModule.listeners.get('TtsLifecycleExperiment.speakingDone')(payload);
  nativeModule.listeners.get('TtsLifecycleExperiment.speakingDone')(payload);

  assert.deepStrictEqual(plain(observed), [
    {
      synthesizerInstanceIdentifier: 'experimental-synthesizer-1',
      synthesizerCreationCount: 1,
    },
    'start',
    {
      synthesizerInstanceIdentifier: 'experimental-synthesizer-1',
      synthesizerCreationCount: 1,
    },
    'done',
  ]);
});

runTest('adapter forwards boundary and stopped callbacks to the matching utterance', () => {
  const nativeModule = makeNativeModule();
  const adapter = createAdapter({ nativeModule });
  const boundaries = [];
  let stopped = 0;
  adapter.speak(
    'light',
    completeSpeechOptions({
      onBoundary(event) {
        boundaries.push(event);
      },
      onStopped() {
        stopped += 1;
      },
    }),
    'reset-per-utterance'
  );

  const [utteranceId] = nativeModule.speakCalls[0];
  const metadata = {
    id: utteranceId,
    synthesizerInstanceIdentifier: 'experimental-synthesizer-2',
    synthesizerCreationCount: 2,
  };
  nativeModule.listeners.get(
    'TtsLifecycleExperiment.speakingWillSayNextString'
  )({ ...metadata, charIndex: 2, charLength: 3 });
  nativeModule.listeners.get('TtsLifecycleExperiment.speakingStopped')(metadata);
  nativeModule.listeners.get('TtsLifecycleExperiment.speakingStopped')(metadata);

  assert.deepStrictEqual(plain(boundaries), [{ charIndex: 2, charLength: 3 }]);
  assert.strictEqual(stopped, 1);
});

runTest('adapter delegates stop without changing lifecycle ownership', () => {
  const nativeModule = makeNativeModule();
  const adapter = createAdapter({ nativeModule });
  adapter.stop();
  assert.strictEqual(nativeModule.stopCalls, 1);
});

runTest('adapter fails explicitly when the development native module is unavailable', () => {
  const adapter = createAdapter({ nativeModule: null });
  assert.throws(
    () => adapter.speak('right', completeSpeechOptions(), 'retained'),
    /native module is unavailable/
  );
});

runTest('resolver leaves release and non-iOS speech on Expo Speech', () => {
  assert.strictEqual(
    resolveMode({
      isDevelopment: false,
      platform: 'ios',
      experimentMode: 'retained',
    }),
    'expo-retained-production-path'
  );
  assert.strictEqual(
    resolveMode({
      isDevelopment: true,
      platform: 'android',
      experimentMode: 'reset-per-utterance',
    }),
    'expo-retained-production-path'
  );
  assert.strictEqual(
    resolveMode({
      isDevelopment: true,
      platform: 'ios',
      experimentMode: 'retained',
    }),
    'experimental-retained'
  );
  assert.strictEqual(
    resolveMode({
      isDevelopment: true,
      platform: 'ios',
      experimentMode: 'reset-per-utterance',
    }),
    'experimental-reset-per-utterance'
  );
});

const useAudioSource = fs.readFileSync(
  path.join(projectRoot, 'src', 'hooks', 'useAudio.ts'),
  'utf8'
);

runTest('useAudio keeps Expo Speech fallback and selects the experiment only at submission', () => {
  assert.strictEqual(
    (useAudioSource.match(/Speech\.speak\(word, speechOptions\)/g) || []).length,
    1
  );
  assert.strictEqual(
    (useAudioSource.match(/speakWithSynthesizerLifecycleExperiment\(/g) || [])
      .length,
    1
  );
  assert.ok(
    useAudioSource.includes(
      "'retained' as IosSynthesizerLifecycleExperimentMode"
    )
  );
  assert.ok(useAudioSource.includes('isDevelopment: __DEV__'));
  assert.ok(useAudioSource.includes('platform: Platform.OS'));
  assert.ok(
    useAudioSource.includes(
      'synthesizerLifecycleMode: SPEECH_SYNTHESIZER_LIFECYCLE_MODE'
    )
  );
});

runTest('useAudio preserves timing boundaries around either speech submission path', () => {
  const invoked = useAudioSource.indexOf(
    'speechSpeakInvokedDiagnosticTime = captureSpeechDiagnosticTime()'
  );
  const experimental = useAudioSource.indexOf(
    'speakWithSynthesizerLifecycleExperiment('
  );
  const expo = useAudioSource.indexOf('Speech.speak(word, speechOptions);');
  const returned = useAudioSource.indexOf(
    'const speechSpeakReturnedDiagnosticTime = captureSpeechDiagnosticTime()'
  );
  assert.ok(invoked < experimental && experimental < returned);
  assert.ok(invoked < expo && expo < returned);
  assert.match(
    useAudioSource,
    /recordSpeechDiagnosticSynthesizerMetadata\(\s*diagnosticAttempt,\s*metadata\s*\)/
  );
});
