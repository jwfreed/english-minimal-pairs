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
