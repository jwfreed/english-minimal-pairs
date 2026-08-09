const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.join(__dirname, '..');
const speechModuleSource = fs.readFileSync(
  path.join(repositoryRoot, 'node_modules', 'expo-speech', 'ios', 'SpeechModule.swift'),
  'utf8'
);
const lifecycleSource = fs.readFileSync(
  path.join(
    repositoryRoot,
    'node_modules',
    'expo-speech',
    'ios',
    'SpeechGenerationLifecycle.swift'
  ),
  'utf8'
);
const speechJavaScriptSource = fs.readFileSync(
  path.join(
    repositoryRoot,
    'node_modules',
    'expo-speech',
    'src',
    'Speech',
    'Speech.ts'
  ),
  'utf8'
);
const patchSource = fs.readFileSync(
  path.join(repositoryRoot, 'patches', 'expo-speech+14.0.7.patch'),
  'utf8'
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

function findMatchingBrace(source, openingBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  throw new Error(`unbalanced block starting at offset ${openingBraceIndex}`);
}

function extractBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notStrictEqual(markerIndex, -1, `missing source marker: ${marker}`);
  const openingBraceIndex = source.indexOf('{', markerIndex + marker.length);
  assert.notStrictEqual(openingBraceIndex, -1, `missing block after: ${marker}`);
  const closingBraceIndex = findMatchingBrace(source, openingBraceIndex);

  return {
    body: source.slice(openingBraceIndex + 1, closingBraceIndex),
    full: source.slice(markerIndex, closingBraceIndex + 1),
    after: source.slice(closingBraceIndex + 1),
  };
}

runTest('all five synthesizer APIs execute on one private serial lifecycle queue', () => {
  assert.match(speechModuleSource, /^import Dispatch$/m);
  assert.match(
    speechModuleSource,
    /private let lifecycleQueue = DispatchQueue\(\s*label: "expo\.modules\.speech\.soundwiseLifecycle",\s*qos: \.userInitiated\s*\)/
  );
  assert.strictEqual(
    (speechModuleSource.match(/DispatchQueue\(/g) || []).length,
    1,
    'SpeechModule must declare exactly one queue'
  );

  for (const functionName of ['speak', 'stop', 'pause', 'resume', 'isSpeaking']) {
    const definition = extractBlock(speechModuleSource, `AsyncFunction("${functionName}")`);
    assert.match(
      definition.after,
      /^\s*\.runOnQueue\(lifecycleQueue\)/,
      `${functionName} must run on lifecycleQueue`
    );
  }

  const getVoicesDefinition = extractBlock(speechModuleSource, 'AsyncFunction("getVoices")');
  assert.doesNotMatch(
    getVoicesDefinition.after,
    /^\s*\.runOnQueue\(lifecycleQueue\)/,
    'getVoices must retain Expo Modules Core default execution'
  );
});

runTest('initial creation and delegate binding synchronously enter the lifecycle queue', () => {
  assert.ok(
    !/private var synthesizer\s*=\s*AVSpeechSynthesizer\(\)/.test(speechModuleSource),
    'the synthesizer must not be constructed during property initialization'
  );
  assert.strictEqual(
    (speechModuleSource.match(/AVSpeechSynthesizer\(\)/g) || []).length,
    1,
    'all initial and replacement creation must share the queue-owned factory'
  );

  const onCreate = extractBlock(speechModuleSource, 'OnCreate').body;
  assert.match(onCreate, /lifecycleQueue\.sync\s*\{/);
  assert.match(onCreate, /createSynthesizer\(\)/);

  const factory = extractBlock(
    speechModuleSource,
    'private func createSynthesizer'
  ).body;
  assert.strictEqual((factory.match(/AVSpeechSynthesizer\(\)/g) || []).length, 1);
  assert.match(factory, /synthesizer\.delegate = delegate/);
  assert.match(factory, /self\.synthesizer = synthesizer/);
});

runTest('every delegate entrypoint only asynchronously enqueues a module handler', () => {
  for (const methodName of ['didStart', 'willSpeak', 'didCancel', 'didFinish']) {
    const body = extractBlock(speechModuleSource, `func ${methodName}`).body;
    assert.match(
      body,
      /^\s*lifecycleQueue\.async\s*\{/,
      `${methodName} must enter lifecycleQueue asynchronously`
    );
    assert.ok(
      !body.includes('lifecycleQueue.sync'),
      `${methodName} must never synchronously re-enter lifecycleQueue`
    );
    assert.ok(
      !/^\s*sendEvent\(/m.test(body),
      `${methodName} must delegate public delivery to its queued handler`
    );
  }
});

runTest('speak registers one submission and calls the native synthesizer exactly once', () => {
  const speakDefinition = extractBlock(speechModuleSource, 'AsyncFunction("speak")').full;

  assert.strictEqual(
    (speechModuleSource.match(/synthesizer\.speak\(utterance\)/g) || []).length,
    1,
    'SpeechModule must contain exactly one native utterance submission'
  );
  assert.match(speakDefinition, /lifecycle\.registerSubmission\(id: utteranceId\)/);
  assert.match(speakDefinition, /soundwiseGenerationRotationEnabled/);
  assert.match(speakDefinition, /submission\.shouldRotateSynthesizer/);

  const validationIndex = speakDefinition.indexOf('throw InvalidVoiceException(voice)');
  const registrationIndex = speakDefinition.indexOf(
    'lifecycle.registerSubmission(id: utteranceId)'
  );
  const replacementIndex = speakDefinition.indexOf('synthesizer = createSynthesizer()');
  const audioSessionIndex = speakDefinition.indexOf(
    'synthesizer.usesApplicationAudioSession = useApplicationAudioSession'
  );
  const nativeSpeakIndex = speakDefinition.indexOf('synthesizer.speak(utterance)');

  assert.ok(validationIndex >= 0, 'voice validation guard must remain present');
  assert.ok(replacementIndex >= 0, 'idle-to-active replacement must remain present');
  assert.ok(audioSessionIndex >= 0, 'audio-session mutation must remain present');
  assert.ok(
    validationIndex < registrationIndex &&
      registrationIndex < replacementIndex &&
      replacementIndex < audioSessionIndex &&
      audioSessionIndex < nativeSpeakIndex,
    'required order is voice validation, accounting, replacement, audio session, native speak'
  );
});

runTest('native stop pause resume and isSpeaking retain their return shapes', () => {
  const stop = extractBlock(speechModuleSource, 'AsyncFunction("stop")').body;
  assert.ok(!/\breturn\b/.test(stop), 'native stop must remain Void-shaped');

  const pause = extractBlock(speechModuleSource, 'AsyncFunction("pause")').body;
  assert.match(pause, /_ = synthesizer\.pauseSpeaking\(at: \.immediate\)/);
  assert.ok(!/\breturn\b/.test(pause), 'native pause must remain Void-shaped');

  const resume = extractBlock(speechModuleSource, 'AsyncFunction("resume")').body;
  assert.match(resume, /_ = synthesizer\.continueSpeaking\(\)/);
  assert.ok(!/\breturn\b/.test(resume), 'native resume must remain Void-shaped');

  const isSpeaking = extractBlock(speechModuleSource, 'AsyncFunction("isSpeaking")').body;
  const snapshotIndex = isSpeaking.indexOf('let isSpeaking = synthesizer.isSpeaking');
  const idleCheckIndex = isSpeaking.indexOf('if !isSpeaking');
  const returnIndex = isSpeaking.indexOf('return isSpeaking');
  assert.ok(
    snapshotIndex >= 0 && snapshotIndex < idleCheckIndex && idleCheckIndex < returnIndex,
    'isSpeaking must diagnose only a false snapshot and return that same Boolean snapshot'
  );
});

runTest('successful stop delivers then retires each ID synchronously in the stop loop', () => {
  const stopDefinition = extractBlock(speechModuleSource, 'AsyncFunction("stop")').body;
  assert.match(stopDefinition, /let didStop = synthesizer\.stopSpeaking\(at: \.immediate\)/);

  const loop = extractBlock(
    stopDefinition,
    'for resolution in lifecycle.resolveSuccessfulStop()'
  ).body;
  const deliveryIndex = loop.indexOf('sendStoppedEvent(id: resolution.id)');
  const completionIndex = loop.indexOf(
    'lifecycle.completeSuccessfulStopDelivery(id: resolution.id)'
  );

  assert.ok(deliveryIndex >= 0, 'stop loop must hand the stopped event to the bridge');
  assert.ok(completionIndex >= 0, 'stop loop must complete lifecycle ownership');
  assert.ok(
    deliveryIndex < completionIndex,
    'bridge delivery must happen before lifecycle retirement'
  );
  assert.ok(!loop.includes('.async'), 'the successful-stop loop must not enqueue a hop');
  assert.ok(!loop.includes('Promise'), 'the successful-stop loop must not await Promise work');
  assert.ok(!loop.includes('yield'), 'the successful-stop loop must not yield');

  const stoppedDelivery = extractBlock(
    speechModuleSource,
    'private func sendStoppedEvent'
  ).body;
  assert.ok(!stoppedDelivery.includes('.async'), 'stopped bridge delivery must stay synchronous');
  assert.match(stoppedDelivery, /sendEvent\(SPEAKING_STOPPED/);
});

runTest('two-phase lifecycle API remains the sole successful-stop accounting owner', () => {
  assert.match(
    lifecycleSource,
    /var pendingExplicitCancellationResolutions: Int\s*\{/
  );
  assert.match(
    lifecycleSource,
    /func completeSuccessfulStopDelivery\(id: String\) -> SpeechLifecycleAnomaly\?/
  );
  assert.match(
    lifecycleSource,
    /pendingExplicitCancellationIds\.isEmpty\s*&&\s*hasUsedGeneration/
  );

  const delegateResolution = extractBlock(
    lifecycleSource,
    'func resolveDelegateTerminal'
  ).body;
  assert.match(
    delegateResolution,
    /guard let outstandingIndex, isInOutstandingSet else \{\s*return \(\s*\.suppressDuplicate,\s*\.invariantMismatch\s*\)/,
    'inconsistent ordered/set membership must fail closed without public delivery'
  );
});

runTest('native diagnostics carry the sentinel, required fields, and release-safe bound', () => {
  assert.ok(
    speechModuleSource.includes('SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1')
  );
  assert.match(
    speechModuleSource,
    /private let soundwiseGenerationRotationEnabled = true/
  );
  assert.ok(speechModuleSource.includes('[tts-synthesizer-lifecycle]'));
  assert.match(speechModuleSource, /maxInvariantFailureDiagnostics = 20/);
  assert.ok(!/queue\s*depth/i.test(speechModuleSource));

  for (const phase of ['creation', 'submission', 'terminal', 'retirement']) {
    assert.ok(
      speechModuleSource.includes(`phase: "${phase}"`),
      `missing Debug lifecycle phase: ${phase}`
    );
  }
  for (const field of [
    'generation',
    'utteranceId',
    'terminalKind',
    'terminalSource',
    'trackedOutstandingUtterances',
    'timestampMs',
  ]) {
    assert.ok(speechModuleSource.includes(`"${field}"`), `missing diagnostic field: ${field}`);
  }

  const lifecycleLogFunction = extractBlock(
    speechModuleSource,
    'private func emitLifecycleEvent'
  ).body;
  assert.match(lifecycleLogFunction, /#if DEBUG \|\| EXPO_CONFIGURATION_DEBUG/);
  assert.match(lifecycleLogFunction, /log\.debug\(/);

  const invariantLogger = extractBlock(
    speechModuleSource,
    'private func emitInvariantFailure'
  ).body;
  assert.match(invariantLogger, /invariantFailureDiagnosticsEmitted/);
  assert.match(invariantLogger, /log\.error\(/);

  const serializer = extractBlock(
    speechModuleSource,
    'private func serializeDiagnostic'
  ).body;
  assert.ok(serializer.includes('try? JSONSerialization.data'));
  assert.ok(!/\btry\s+(?!\?)/.test(serializer), 'diagnostic serialization must not throw');
});

runTest('JavaScript wrappers retain the pinned return shapes', () => {
  const speakMarker = 'export function speak(text: string, options: SpeechOptions = {})';
  const speak = extractBlock(speechJavaScriptSource, speakMarker).full;
  assert.ok(!speak.startsWith('export async function'));
  assert.match(speak, /ExponentSpeech\.speak\(String\(id\), text, options\);/);
  assert.ok(!/\breturn\b/.test(extractBlock(speechJavaScriptSource, speakMarker).body));

  const isSpeaking = extractBlock(
    speechJavaScriptSource,
    'export async function isSpeakingAsync'
  ).full;
  assert.match(isSpeaking, /Promise<boolean>/);
  assert.match(isSpeaking, /return ExponentSpeech\.isSpeaking\(\);/);

  for (const functionName of ['stop', 'pause', 'resume']) {
    const definition = extractBlock(
      speechJavaScriptSource,
      `export async function ${functionName}`
    ).full;
    assert.match(definition, /Promise<void>/);
    assert.match(definition, new RegExp(`return ExponentSpeech\\.${functionName}\\(\\);`));
  }
});

runTest('versioned patch contains only the two approved iOS Swift sources', () => {
  const patchPaths = [...patchSource.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map(
    (match) => {
      assert.strictEqual(match[1], match[2], 'patch headers must address the same path');
      return match[1];
    }
  );
  const expectedPaths = [
    'node_modules/expo-speech/ios/SpeechGenerationLifecycle.swift',
    'node_modules/expo-speech/ios/SpeechModule.swift',
  ];

  assert.deepStrictEqual([...patchPaths].sort(), expectedPaths.sort());
  assert.ok(
    patchPaths.every(
      (patchedPath) =>
        !patchedPath.startsWith('node_modules/expo-speech/src/') &&
        !patchedPath.startsWith('node_modules/expo-speech/build/')
    ),
    'patch must not alter expo-speech JavaScript source or build output'
  );
});

runTest('versioned patch reverse-applies to the installed Expo Speech authoring inputs', () => {
  const reverseCheck = spawnSync(
    'git',
    ['apply', '--reverse', '--check', 'patches/expo-speech+14.0.7.patch'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  );

  assert.strictEqual(
    reverseCheck.status,
    0,
    `patch does not reverse-apply to installed source:\n${reverseCheck.stderr || reverseCheck.stdout}`
  );
});
