// Coverage for the device-validation log analyzer. The analyzer turns a raw
// Metro/Console capture into the Commit 1 validation metrics, so that counting
// timeouts and late callbacks is not a manual eyeball exercise over hundreds of
// lines.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  analyzeValidationLog,
  exitCodeForReport,
  formatValidationReport,
} = require('./analyze-tts-validation-log');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function runAnalyzerCli(capture, flags = []) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-validation-log-'));
  const capturePath = path.join(directory, 'capture.log');
  fs.writeFileSync(capturePath, capture);
  try {
    return spawnSync(process.execPath, [
      path.join(__dirname, 'analyze-tts-validation-log.js'),
      ...flags,
      capturePath,
    ], { encoding: 'utf8' });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

const jsonRecord = (event) =>
  ` LOG  [tts-playback] ${JSON.stringify(event)}`;

const legacyRecord = (fields) => {
  const entries = Object.entries(fields).map(([key, value]) => {
    if (typeof value === 'string') return `  ${key}: '${value}'`;
    return `  ${key}: ${String(value)}`;
  });
  return `[tts-playback] {\n${entries.join(',\n')}\n}`;
};

const lifecycleEvent = (phase, requestId = 'tts-1000-1', overrides = {}) => {
  const terminal = ['completed', 'cancelled', 'failed'].includes(phase);
  const event = {
    phase,
    requestId,
    word: 'oath',
    difficulty: 6,
    requestedAtMs: 1000,
    eventTimestampMs: 1000,
    isSpeaking: !terminal,
    coordinatorObservedActivePlaybackOwnershipCount: terminal ? 0 : 1,
  };
  if (['submitted-to-native-speech', 'started', 'completed', 'cancelled'].includes(phase)) {
    event.speechSubmittedAtMs = 1001;
  }
  if (phase === 'started') event.playbackStartedAtMs = 1002;
  if (phase === 'completed') event.playbackFinishedAtMs = 1003;
  if (phase === 'cancelled') event.cancellationAtMs = 1003;
  if (phase === 'failed') event.failureAtMs = 1003;
  return { ...event, ...overrides };
};

const timeoutEvent = (phase, requestId = 'tts-1000-1', overrides = {}) => ({
  phase,
  requestId,
  word: 'oath',
  difficulty: 6,
  requestedAtMs: 1000,
  timedOutAtMs: 5000,
  timedOutPhase: phase.endsWith('awaiting-start')
    ? 'awaiting-start'
    : 'awaiting-terminal',
  coordinatorObservedActivePlaybackOwnershipCount: 0,
  ...overrides,
});

const lateCallbackEvent = (phase, requestId = 'tts-1000-1', overrides = {}) => ({
  phase,
  requestId,
  nativeCallback: 'onDone',
  eventTimestampMs: 5001,
  coordinatorObservedActivePlaybackOwnershipCount: 0,
  ...overrides,
});

const healthyJsonRequest = (requestId = 'tts-1000-1') => [
  lifecycleEvent('requested', requestId),
  lifecycleEvent('accepted', requestId),
  lifecycleEvent('submitted-to-native-speech', requestId),
  lifecycleEvent('started', requestId),
  lifecycleEvent('completed', requestId),
]
  .map(jsonRecord)
  .join('\n');

const HEALTHY_UTTERANCE = healthyJsonRequest();

const TIMED_OUT_UTTERANCE = [
  lifecycleEvent('requested', 'tts-2000-2', { word: 'oaths' }),
  lifecycleEvent('accepted', 'tts-2000-2', { word: 'oaths' }),
  lifecycleEvent('submitted-to-native-speech', 'tts-2000-2', { word: 'oaths' }),
  timeoutEvent('ownership-timeout-awaiting-start', 'tts-2000-2', {
    word: 'oaths',
  }),
]
  .map(legacyRecord)
  .join('\n');

const NATIVE_CONTRACT = 'SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1';

const nativeRecord = (event) =>
  ` LOG  [tts-synthesizer-lifecycle] ${JSON.stringify(event)}`;

const nativeEvent = (phase, overrides = {}) => ({
  contract: NATIVE_CONTRACT,
  phase,
  generation: 0,
  utteranceId: null,
  terminalKind: null,
  terminalSource: null,
  trackedOutstandingUtterances: 0,
  timestampMs: 1000,
  anomaly: null,
  ...overrides,
});

const nativeSubmission = (utteranceId, generation, overrides = {}) =>
  nativeEvent('submission', { utteranceId, generation, ...overrides });

const nativeTerminal = (utteranceId, generation, terminalKind, terminalSource, overrides = {}) =>
  nativeEvent('terminal', { utteranceId, generation, terminalKind, terminalSource, ...overrides });

const nativeRetirement = (utteranceId, generation, terminalKind, terminalSource, overrides = {}) =>
  nativeEvent('retirement', { utteranceId, generation, terminalKind, terminalSource, ...overrides });

const healthyNativeUtterance = (utteranceId = 'a', generation = 0) =>
  [
    nativeSubmission(utteranceId, generation),
    nativeTerminal(utteranceId, generation, 'done', 'delegateFinish'),
    nativeRetirement(utteranceId, generation, 'done', 'delegateFinish'),
  ]
    .map(nativeRecord)
    .join('\n');

runTest('withholds all metrics and runtime verdicts for invalid captures', () => {
  const report = analyzeValidationLog(
    `${healthyJsonRequest()}\n[tts-playback] {"phase":"completed",}`
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
  assert.strictEqual(report.validationPassed, false);
  assert.strictEqual(exitCodeForReport(report), 1);
});

runTest('does not treat VALID as a passing runtime verdict', () => {
  const report = analyzeValidationLog(healthyJsonRequest());
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.match(report.runtimeVerdict, /INCONCLUSIVE/);
  assert.strictEqual(report.validationPassed, false);
  assert.strictEqual(exitCodeForReport(report), 1);
});

runTest('a valid timeout-free sampled run can proceed', () => {
  const capture = Array.from({ length: 30 }, (_, index) =>
    healthyJsonRequest(`tts-${1000 + index}-${index + 1}`)
  ).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.metrics.attempts, 30);
  assert.strictEqual(report.metrics.completed, 30);
  assert.strictEqual(report.metrics.timeouts.total, 0);
  assert.match(report.runtimeVerdict, /PROCEED/);
  assert.strictEqual(report.validationPassed, true);
  assert.strictEqual(exitCodeForReport(report), 0);
});

runTest('a valid watchdog path is evidence-valid but runtime-blocked', () => {
  const capture = [
    lifecycleEvent('requested'),
    lifecycleEvent('accepted'),
    lifecycleEvent('submitted-to-native-speech'),
    timeoutEvent('ownership-timeout-awaiting-start'),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.metrics.attempts, 1);
  assert.strictEqual(report.metrics.timeouts.awaitingStart, 1);
  assert.match(report.runtimeVerdict, /BLOCKED/);
  assert.strictEqual(exitCodeForReport(report), 1);
});

runTest('a valid unknown late callback receives runtime review', () => {
  const capture = `${healthyJsonRequest()}\n${jsonRecord(
    lateCallbackEvent('late-callback-unknown-request', 'tts-9000-9')
  )}`;
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.metrics.lateCallbacks.unknownRequest, 1);
  assert.match(report.runtimeVerdict, /REVIEW/);
  assert.strictEqual(exitCodeForReport(report), 1);
});

runTest('empty captures expose neither metrics nor a runtime verdict', () => {
  const report = analyzeValidationLog('Metro ready');
  assert.strictEqual(report.captureStatus, 'EMPTY_CAPTURE');
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
  assert.strictEqual(exitCodeForReport(report), 1);
});

runTest('invalidates marked captures without an accepted or submitted denominator', () => {
  const report = analyzeValidationLog(
    jsonRecord(lateCallbackEvent('late-callback-unknown-request', 'tts-9000-9'))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
  assert.strictEqual(report.parseSummary.diagnosticRecordsFound, 1);
  assert.strictEqual(report.parseSummary.parsedRecords, 1);
  assert.strictEqual(report.parseSummary.invalidRecords, 0);
  assert.strictEqual(report.parseSummary.firstInvalidLineNumber, null);
  assert.strictEqual(
    report.parseSummary.diagnosticRecordsFound,
    report.parseSummary.parsedRecords + report.parseSummary.invalidRecords
  );
  assert.match(report.parseSummary.errors[0].message, /attempt denominator/i);
});

runTest('bounds lifecycle diagnostics and declares omitted failures', () => {
  const capture = Array.from({ length: 8 }, () =>
    jsonRecord(lifecycleEvent('requested'))
  ).join('\n');
  const report = analyzeValidationLog(capture);
  const text = formatValidationReport(report);
  const lifecycleDiagnosticCount = text
    .split('\n')
    .filter((line) => line.includes('(lifecycle):')).length;

  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(lifecycleDiagnosticCount, 5);
  assert.match(text, /additional diagnostics not shown/i);
});

runTest('invalidates an unknown lifecycle phase', () => {
  const report = analyzeValidationLog(
    jsonRecord(lifecycleEvent('future-unrecognized-phase'))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /unknown phase/i);
});

runTest('invalidates missing required lifecycle fields', () => {
  const report = analyzeValidationLog(
    jsonRecord({ phase: 'requested', eventTimestampMs: 1000 })
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /requestId/i);
});

runTest('invalidates malformed request identifiers', () => {
  const report = analyzeValidationLog(
    jsonRecord(lifecycleEvent('requested', 'request-one'))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /requestId/i);
});

runTest('invalidates malformed timestamps', () => {
  const report = analyzeValidationLog(
    jsonRecord(lifecycleEvent('requested', 'tts-1000-1', { eventTimestampMs: 'now' }))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /eventTimestampMs/i);
});

runTest('invalidates a rejected duplicate without a different active owner', () => {
  const events = [
    lifecycleEvent('requested'),
    lifecycleEvent('rejected-duplicate'),
  ];
  const report = analyzeValidationLog(events.map(jsonRecord).join('\n'));
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /active owner/i);
});

runTest('invalidates timeout payloads that do not prove ownership release', () => {
  const report = analyzeValidationLog(
    jsonRecord(timeoutEvent('ownership-timeout-awaiting-start', 'tts-1000-1', {
      coordinatorObservedActivePlaybackOwnershipCount: 1,
    }))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /ownership released/i);
});

runTest('invalidates timeout payloads with the wrong timeout phase', () => {
  const report = analyzeValidationLog(
    jsonRecord(timeoutEvent('ownership-timeout-awaiting-start', 'tts-1000-1', {
      timedOutPhase: 'awaiting-terminal',
    }))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /timedOutPhase/i);
});

runTest('invalidates timeout payloads with malformed timeout timestamps', () => {
  const report = analyzeValidationLog(
    jsonRecord(timeoutEvent('ownership-timeout-awaiting-start', 'tts-1000-1', {
      timedOutAtMs: Number.NaN,
    }))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /timedOutAtMs/i);
});

runTest('invalidates late callbacks without a native callback name', () => {
  const report = analyzeValidationLog(
    jsonRecord(lateCallbackEvent('late-callback-unknown-request', 'tts-9000-9', {
      nativeCallback: 'onMystery',
    }))
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /onDone.*onStopped.*onError/i);
});

runTest('invalidates an accepted request with no terminal outcome', () => {
  const capture = ['requested', 'accepted', 'submitted-to-native-speech']
    .map((phase) => jsonRecord(lifecycleEvent(phase)))
    .join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.lifecycleFailures[0].message, /exactly one terminal/i);
  assert.strictEqual(report.parseSummary.invalidRecords, 1);
  assert.strictEqual(report.parseSummary.parsedRecords, 2);
  assert.strictEqual(report.parseSummary.firstInvalidLineNumber, 1);
});

runTest('invalidates duplicate terminal outcomes', () => {
  const capture = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'completed',
    'cancelled',
  ].map((phase) => jsonRecord(lifecycleEvent(phase))).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.lifecycleFailures[0].message, /duplicate terminal/i);
});

runTest('invalidates a duplicate native speech submission', () => {
  const capture = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'submitted-to-native-speech',
    'completed',
  ].map((phase) => jsonRecord(lifecycleEvent(phase))).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.lifecycleFailures[0].message, /duplicate submission/i);
});

runTest('invalidates a duplicate playback start', () => {
  const capture = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'started',
    'started',
    'completed',
  ].map((phase) => jsonRecord(lifecycleEvent(phase))).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.lifecycleFailures[0].message, /duplicate start/i);
});

runTest('invalidates submission after playback start', () => {
  const capture = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'started',
    'submitted-to-native-speech',
    'completed',
  ].map((phase) => jsonRecord(lifecycleEvent(phase))).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.lifecycleFailures[0].message, /submission cannot follow start/i);
});

runTest('invalidates a second accepted request while the first owner is active', () => {
  const ownerId = 'tts-1000-1';
  const secondId = 'tts-2000-2';
  const capture = [
    lifecycleEvent('requested', ownerId),
    lifecycleEvent('accepted', ownerId),
    lifecycleEvent('submitted-to-native-speech', ownerId),
    lifecycleEvent('started', ownerId),
    lifecycleEvent('requested', secondId),
    lifecycleEvent('accepted', secondId),
    lifecycleEvent('completed', ownerId),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /active owner/i.test(message))
  );
});

runTest('invalidates a rejected duplicate that names a nonexistent owner', () => {
  const duplicateId = 'tts-2000-2';
  const capture = [
    lifecycleEvent('requested', duplicateId),
    lifecycleEvent('rejected-duplicate', duplicateId, {
      activePlaybackOwnerRequestId: 'tts-9000-9',
    }),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /current active owner/i.test(message))
  );
});

runTest('invalidates a rejected duplicate that names an inactive owner', () => {
  const oldOwnerId = 'tts-1000-1';
  const duplicateId = 'tts-2000-2';
  const capture = [
    lifecycleEvent('requested', oldOwnerId),
    lifecycleEvent('accepted', oldOwnerId),
    lifecycleEvent('submitted-to-native-speech', oldOwnerId),
    lifecycleEvent('completed', oldOwnerId),
    lifecycleEvent('requested', duplicateId),
    lifecycleEvent('rejected-duplicate', duplicateId, {
      activePlaybackOwnerRequestId: oldOwnerId,
    }),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /current active owner/i.test(message))
  );
});

runTest('invalidates an active ordinary phase that reports zero owners', () => {
  const capture = [
    lifecycleEvent('requested', 'tts-1000-1', {
      coordinatorObservedActivePlaybackOwnershipCount: 0,
    }),
    lifecycleEvent('accepted'),
    lifecycleEvent('failed'),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /ownership count.*1/i.test(message))
  );
});

runTest('invalidates an ordinary terminal phase that reports an active owner', () => {
  const capture = [
    lifecycleEvent('requested'),
    lifecycleEvent('accepted'),
    lifecycleEvent('failed', 'tts-1000-1', {
      coordinatorObservedActivePlaybackOwnershipCount: 1,
    }),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /ownership count.*0/i.test(message))
  );
});

runTest('invalidates a late callback that names its own request as the active owner', () => {
  const requestId = 'tts-1000-1';
  const capture = [
    lifecycleEvent('requested', requestId),
    lifecycleEvent('accepted', requestId),
    lifecycleEvent('submitted-to-native-speech', requestId),
    lifecycleEvent('started', requestId),
    lateCallbackEvent('late-callback-unknown-request', requestId, {
      coordinatorObservedActivePlaybackOwnershipCount: 1,
      activePlaybackOwnerRequestId: requestId,
    }),
    lifecycleEvent('completed', requestId),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.lifecycleFailures.some(({ message }) => /newer active owner/i.test(message))
  );
});

runTest('allows a terminal callback when the started callback is missing', () => {
  const capture = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'completed',
  ].map((phase) => jsonRecord(lifecycleEvent(phase))).join('\n');
  assert.strictEqual(analyzeValidationLog(capture).captureStatus, 'VALID');
});

runTest('invalidates submission before acceptance and start before submission', () => {
  const submittedTooSoon = ['requested', 'submitted-to-native-speech']
    .map((phase) => jsonRecord(lifecycleEvent(phase)))
    .join('\n');
  const startedTooSoon = ['requested', 'accepted', 'started', 'completed']
    .map((phase) => jsonRecord(lifecycleEvent(phase)))
    .join('\n');
  assert.match(
    analyzeValidationLog(submittedTooSoon).parseSummary.lifecycleFailures[0].message,
    /submission requires acceptance/i
  );
  assert.match(
    analyzeValidationLog(startedTooSoon).parseSummary.lifecycleFailures[0].message,
    /start requires submission/i
  );
});

runTest('accepts both intended timeout terminal paths', () => {
  const awaitingStart = [
    lifecycleEvent('requested'),
    lifecycleEvent('accepted'),
    lifecycleEvent('submitted-to-native-speech'),
    timeoutEvent('ownership-timeout-awaiting-start'),
  ].map(jsonRecord).join('\n');
  const awaitingTerminal = [
    lifecycleEvent('requested', 'tts-2000-2'),
    lifecycleEvent('accepted', 'tts-2000-2'),
    lifecycleEvent('submitted-to-native-speech', 'tts-2000-2'),
    lifecycleEvent('started', 'tts-2000-2'),
    timeoutEvent('ownership-timeout-awaiting-terminal', 'tts-2000-2'),
  ].map(jsonRecord).join('\n');
  assert.strictEqual(analyzeValidationLog(awaitingStart).captureStatus, 'VALID');
  assert.strictEqual(analyzeValidationLog(awaitingTerminal).captureStatus, 'VALID');
});

runTest('accepts rejected duplicate admission while the original owner continues', () => {
  const ownerId = 'tts-1000-1';
  const duplicateId = 'tts-1001-2';
  const capture = [
    lifecycleEvent('requested', ownerId),
    lifecycleEvent('accepted', ownerId),
    lifecycleEvent('submitted-to-native-speech', ownerId),
    lifecycleEvent('started', ownerId),
    lifecycleEvent('requested', duplicateId),
    lifecycleEvent('rejected-duplicate', duplicateId, {
      activePlaybackOwnerRequestId: ownerId,
    }),
    lifecycleEvent('completed', ownerId),
  ].map(jsonRecord).join('\n');
  assert.strictEqual(analyzeValidationLog(capture).captureStatus, 'VALID');
});

runTest('accepts both late-callback classifications and newer ownership', () => {
  const oldId = 'tts-1000-1';
  const newId = 'tts-2000-2';
  const capture = [
    lifecycleEvent('requested', oldId),
    lifecycleEvent('accepted', oldId),
    lifecycleEvent('submitted-to-native-speech', oldId),
    timeoutEvent('ownership-timeout-awaiting-start', oldId),
    lifecycleEvent('requested', newId),
    lifecycleEvent('accepted', newId),
    lifecycleEvent('submitted-to-native-speech', newId),
    lifecycleEvent('started', newId),
    lateCallbackEvent('late-callback-after-timeout', oldId, {
      coordinatorObservedActivePlaybackOwnershipCount: 1,
      activePlaybackOwnerRequestId: newId,
    }),
    lifecycleEvent('completed', newId),
    lateCallbackEvent('late-callback-unknown-request', 'tts-9000-9'),
  ].map(jsonRecord).join('\n');
  assert.strictEqual(analyzeValidationLog(capture).captureStatus, 'VALID');
});

runTest('parses the real one-line iPhone JSON diagnostic format', () => {
  const report = analyzeValidationLog(healthyJsonRequest());
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.parseSummary.diagnosticRecordsFound, 5);
  assert.strictEqual(report.parseSummary.parsedRecords, 5);
  assert.strictEqual(report.parseSummary.invalidRecords, 0);
});

runTest('preserves the supported multiline legacy Metro format', () => {
  const phases = [
    'requested',
    'accepted',
    'submitted-to-native-speech',
    'completed',
  ];
  const capture = phases
    .map((phase) => legacyRecord(lifecycleEvent(phase)))
    .join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.parseSummary.parsedRecords, phases.length);
});

runTest('ignores unrelated console noise outside marked records', () => {
  const report = analyzeValidationLog(
    `Metro ready\nrandom { phase: 'failed' }\n${healthyJsonRequest()}\nwarning`
  );
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.parseSummary.diagnosticRecordsFound, 5);
});

runTest('invalidates malformed JSON instead of falling back to token parsing', () => {
  const capture = `${healthyJsonRequest()}\n LOG [tts-playback] {"phase":"completed",}`;
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(report.parseSummary.invalidRecords, 1);
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
});

runTest('invalidates malformed legacy diagnostic records', () => {
  const report = analyzeValidationLog(
    `${healthyJsonRequest()}\n[tts-playback] { phase: 'completed', requestId }`
  );
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /legacy/i);
});

runTest('invalidates an incomplete multiline diagnostic record', () => {
  const capture = `${healthyJsonRequest()}\n[tts-playback] {\n  phase: 'requested',`;
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.match(report.parseSummary.errors[0].message, /incomplete/i);
});

runTest('distinguishes an empty capture from parser failure', () => {
  const empty = analyzeValidationLog('Metro ready\nno diagnostic records');
  const broken = analyzeValidationLog('[tts-playback] {"phase":');
  assert.strictEqual(empty.captureStatus, 'EMPTY_CAPTURE');
  assert.strictEqual(empty.parseSummary.diagnosticRecordsFound, 0);
  assert.strictEqual(broken.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(broken.parseSummary.diagnosticRecordsFound, 1);
});

runTest('keeps empty captures as evidence-only reports', () => {
  const report = analyzeValidationLog('Metro ready\nno diagnostic records');
  const text = formatValidationReport(report);

  assert.strictEqual(report.captureStatus, 'EMPTY_CAPTURE');
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
  assert.strictEqual(Object.hasOwn(report, 'attempts'), false);
  assert.strictEqual(Object.hasOwn(report, 'clean'), false);
  assert.strictEqual(Object.hasOwn(report, 'verdict'), false);
  assert.match(text, /EMPTY_CAPTURE/);
  assert.doesNotMatch(text, /Total playback attempts|Verdict:/);
});

runTest('formats invalid captures as evidence and exits nonzero without throwing', () => {
  const capture = '[tts-playback] {"phase":"completed",}';
  const report = analyzeValidationLog(capture);
  const text = formatValidationReport(report);
  const cli = runAnalyzerCli(capture);

  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.strictEqual(report.metrics, null);
  assert.strictEqual(report.runtimeVerdict, null);
  assert.match(text, /INVALID_CAPTURE/);
  assert.match(text, /records found\s+1/i);
  assert.match(text, /line 1 \(parse\):/i);
  assert.strictEqual(cli.status, 1);
  assert.match(cli.stdout, /INVALID_CAPTURE/);
  assert.match(cli.stdout, /line 1 \(parse\):/i);
  assert.strictEqual(cli.stderr, '');
});

runTest('counts a healthy utterance as one attempt with no recoveries', () => {
  const report = analyzeValidationLog(HEALTHY_UTTERANCE);

  assert.strictEqual(report.metrics.attempts, 1);
  assert.strictEqual(report.metrics.completed, 1);
  assert.strictEqual(report.metrics.timeouts.total, 0);
  assert.strictEqual(report.metrics.lateCallbacks.total, 0);
  assert.match(report.runtimeVerdict, /INCONCLUSIVE/);
});

runTest('counts every accepted admission when one request fails before submission', () => {
  const completedRequestId = 'tts-3000-3';
  const failedRequestId = 'tts-4000-4';
  const capture = [
    lifecycleEvent('requested', completedRequestId),
    lifecycleEvent('accepted', completedRequestId),
    lifecycleEvent('submitted-to-native-speech', completedRequestId),
    lifecycleEvent('started', completedRequestId),
    lifecycleEvent('completed', completedRequestId),
    lifecycleEvent('requested', failedRequestId),
    lifecycleEvent('accepted', failedRequestId),
    lifecycleEvent('failed', failedRequestId),
  ].map(jsonRecord).join('\n');
  const report = analyzeValidationLog(capture);

  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.metrics.attempts, 2);
  assert.strictEqual(report.metrics.completed, 1);
  assert.strictEqual(report.metrics.failed, 1);
  assert.match(report.runtimeVerdict, /REVIEW/);
});

runTest('does not mistake timedOutPhase for the event phase key', () => {
  // A naive /phase:/ regex matches `timedOutPhase:` too, which would
  // double-count every timeout event.
  const report = analyzeValidationLog(TIMED_OUT_UTTERANCE);

  assert.strictEqual(report.metrics.timeouts.total, 1);
  assert.strictEqual(report.metrics.timeouts.awaitingStart, 1);
  assert.strictEqual(report.metrics.timeouts.awaitingTerminal, 0);
});

runTest('separates the two timeout phases', () => {
  const awaitingStart = ['requested', 'accepted', 'submitted-to-native-speech']
    .map((phase) => jsonRecord(lifecycleEvent(phase, 'tts-3000-3')))
    .concat(jsonRecord(timeoutEvent('ownership-timeout-awaiting-start', 'tts-3000-3')));
  const awaitingTerminal = ['requested', 'accepted', 'submitted-to-native-speech', 'started']
    .map((phase) => jsonRecord(lifecycleEvent(phase, 'tts-4000-4')))
    .concat(jsonRecord(timeoutEvent('ownership-timeout-awaiting-terminal', 'tts-4000-4')));
  const report = analyzeValidationLog(awaitingStart.concat(awaitingTerminal).join('\n'));

  assert.strictEqual(report.metrics.timeouts.awaitingStart, 1);
  assert.strictEqual(report.metrics.timeouts.awaitingTerminal, 1);
  assert.strictEqual(report.metrics.timeouts.total, 2);
});

runTest('separates the two late-callback classifications', () => {
  const report = analyzeValidationLog([
    lifecycleEvent('requested', 'tts-3000-3'),
    lifecycleEvent('accepted', 'tts-3000-3'),
    lifecycleEvent('submitted-to-native-speech', 'tts-3000-3'),
    timeoutEvent('ownership-timeout-awaiting-start', 'tts-3000-3'),
    lateCallbackEvent('late-callback-after-timeout', 'tts-3000-3'),
    lateCallbackEvent('late-callback-unknown-request', 'tts-4000-4'),
  ].map(jsonRecord).join('\n'));

  assert.strictEqual(report.metrics.lateCallbacks.afterTimeout, 1);
  assert.strictEqual(report.metrics.lateCallbacks.unknownRequest, 1);
  assert.strictEqual(report.metrics.lateCallbacks.total, 2);
});

runTest('counts duplicate rejections without counting them as attempts', () => {
  const report = analyzeValidationLog([
    lifecycleEvent('requested', 'tts-1000-1'),
    lifecycleEvent('accepted', 'tts-1000-1'),
    lifecycleEvent('submitted-to-native-speech', 'tts-1000-1'),
    lifecycleEvent('started', 'tts-1000-1'),
    lifecycleEvent('requested', 'tts-1001-2'),
    lifecycleEvent('rejected-duplicate', 'tts-1001-2', {
      activePlaybackOwnerRequestId: 'tts-1000-1',
    }),
    lifecycleEvent('completed', 'tts-1000-1'),
  ].map(jsonRecord).join('\n'));

  assert.strictEqual(report.metrics.attempts, 1);
  assert.strictEqual(report.metrics.rejectedDuplicates, 1);
});

runTest('treats any timeout during a validation run as an unexpected recovery', () => {
  const report = analyzeValidationLog(
    `${HEALTHY_UTTERANCE}\n${TIMED_OUT_UTTERANCE}`
  );

  assert.strictEqual(report.metrics.attempts, 2);
  assert.strictEqual(report.metrics.timeouts.total, 1);
  assert.match(report.runtimeVerdict, /BLOCKED/);
  assert.strictEqual(report.validationPassed, false);
});

runTest('reports distinct request identities so repeats are visible', () => {
  const report = analyzeValidationLog(
    `${HEALTHY_UTTERANCE}\n${TIMED_OUT_UTTERANCE}`
  );

  assert.deepStrictEqual(report.metrics.requestIds, ['tts-1000-1', 'tts-2000-2']);
});

runTest('falls back to accepted events when submissions are absent', () => {
  // A release build emits only recovery diagnostics; the accepted/submitted
  // lifecycle is __DEV__-only. The analyzer must say so rather than report
  // zero attempts as if the session were empty.
  const report = analyzeValidationLog([
    lifecycleEvent('requested', 'tts-3000-3'),
    lifecycleEvent('accepted', 'tts-3000-3'),
    lifecycleEvent('failed', 'tts-3000-3'),
  ].map(jsonRecord).join('\n'));

  assert.strictEqual(report.metrics.attempts, 1);
});

runTest('a clean run recommends proceeding to Commit 2', () => {
  const report = analyzeValidationLog(
    Array.from(
      { length: 30 },
      (_, index) => healthyJsonRequest(`tts-${1000 + index}-${index + 1}`)
    ).join('\n')
  );

  assert.strictEqual(report.metrics.attempts, 30);
  assert.strictEqual(report.validationPassed, true);
  assert.match(report.runtimeVerdict, /proceed/i);
});

runTest('the formatted report includes every required validation metric', () => {
  const text = formatValidationReport(
    analyzeValidationLog(`${HEALTHY_UTTERANCE}\n${TIMED_OUT_UTTERANCE}`)
  );

  for (const required of [
    'Total playback attempts',
    'Watchdog timeouts',
    'awaiting-start',
    'awaiting-terminal',
    'Late callbacks',
    'Runtime verdict',
  ]) {
    assert.ok(text.includes(required), `report must include "${required}"`);
  }
});

// --- Task 4: strict native evidence and latency comparison -----------------

runTest('the JSON report contract carries a schemaVersion the comparator can pin to', () => {
  const report = analyzeValidationLog(healthyJsonRequest());
  assert.strictEqual(report.schemaVersion, 1);
  assert.strictEqual(report.requireNativeLifecycle, false);
});

runTest('the default mode remains fully backward-compatible with no flag', () => {
  const capture = Array.from({ length: 30 }, (_, index) =>
    healthyJsonRequest(`tts-${1000 + index}-${index + 1}`)
  ).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.metrics.attempts, 30);
  assert.strictEqual(report.nativeParseSummary, null);
});

runTest('strict mode requires a native lifecycle stream to be present at all', () => {
  const report = analyzeValidationLog(healthyJsonRequest(), {
    requireNativeLifecycle: true,
  });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.parseSummary.errors.concat(report.nativeParseSummary?.errors ?? []).length >= 0
  );
});

runTest('strict mode accepts a healthy single-utterance native stream', () => {
  const capture = `${healthyJsonRequest()}\n${healthyNativeUtterance('a', 0)}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.nativeParseSummary.invalidRecords, 0);
});

runTest('a malformed native record invalidates strict native evidence', () => {
  const capture = `${healthyJsonRequest()}\n LOG [tts-synthesizer-lifecycle] {"phase":"submission",}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
});

runTest(
  'a mixed-stream corruption invalidates the whole capture under strict mode even though the JS stream alone is healthy',
  () => {
    const capture = `${healthyJsonRequest()}\n LOG [tts-synthesizer-lifecycle] {"phase":"submission",}`;
    const strict = analyzeValidationLog(capture, { requireNativeLifecycle: true });
    assert.strictEqual(strict.captureStatus, 'INVALID_CAPTURE');

    const lenient = analyzeValidationLog(capture);
    assert.strictEqual(
      lenient.captureStatus,
      'VALID',
      'default mode must ignore the native stream entirely, corrupt or not'
    );
  }
);

runTest('a native submission without a matching retirement invalidates strict evidence', () => {
  const capture = `${healthyJsonRequest()}\n${nativeRecord(nativeSubmission('a', 0))}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.nativeParseSummary.lifecycleFailures.some((failure) =>
      failure.message.includes('never retired')
    )
  );
});

runTest('a duplicate native retirement for the same utterance invalidates strict evidence', () => {
  const capture = `${healthyJsonRequest()}\n${healthyNativeUtterance('a', 0)}\n${nativeRecord(
    nativeRetirement('a', 0, 'done', 'delegateFinish')
  )}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.nativeParseSummary.lifecycleFailures.some((failure) =>
      failure.message.includes('duplicate retirement')
    )
  );
});

runTest('sequential submissions may rotate generation once the prior utterance retired', () => {
  const capture = `${healthyJsonRequest()}\n${healthyNativeUtterance('a', 0)}\n${healthyNativeUtterance(
    'b',
    1
  )}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'VALID');
});

runTest('a submission that rotates generation while an utterance is still outstanding invalidates strict evidence', () => {
  const capture = `${healthyJsonRequest()}\n${[
    nativeSubmission('a', 0),
    nativeSubmission('b', 1),
    nativeTerminal('a', 0, 'done', 'delegateFinish'),
    nativeRetirement('a', 0, 'done', 'delegateFinish'),
    nativeTerminal('b', 1, 'done', 'delegateFinish'),
    nativeRetirement('b', 1, 'done', 'delegateFinish'),
  ]
    .map(nativeRecord)
    .join('\n')}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
  assert.ok(
    report.nativeParseSummary.lifecycleFailures.some((failure) =>
      failure.message.includes('remained outstanding')
    )
  );
});

runTest('queued submissions must share one generation while an earlier utterance is outstanding', () => {
  const capture = `${healthyJsonRequest()}\n${[
    nativeSubmission('a', 0),
    nativeSubmission('b', 0),
    nativeTerminal('a', 0, 'done', 'delegateFinish'),
    nativeRetirement('a', 0, 'done', 'delegateFinish'),
    nativeTerminal('b', 0, 'done', 'delegateFinish'),
    nativeRetirement('b', 0, 'done', 'delegateFinish'),
  ]
    .map(nativeRecord)
    .join('\n')}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'VALID');
});

runTest('a successful explicit stop resolving one active and two queued utterances validates once each', () => {
  const capture = `${healthyJsonRequest()}\n${[
    nativeSubmission('a', 0),
    nativeSubmission('b', 0),
    nativeSubmission('c', 0),
    nativeTerminal('a', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeRetirement('a', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeTerminal('b', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeRetirement('b', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeTerminal('c', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeRetirement('c', 0, 'stopped', 'explicitSuccessfulStop'),
  ]
    .map(nativeRecord)
    .join('\n')}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'VALID');
});

runTest('a stop loop that leaves one queued utterance unretired invalidates strict evidence', () => {
  const capture = `${healthyJsonRequest()}\n${[
    nativeSubmission('a', 0),
    nativeSubmission('b', 0),
    nativeSubmission('c', 0),
    nativeTerminal('a', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeRetirement('a', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeTerminal('b', 0, 'stopped', 'explicitSuccessfulStop'),
    nativeRetirement('b', 0, 'stopped', 'explicitSuccessfulStop'),
  ]
    .map(nativeRecord)
    .join('\n')}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
});

runTest('a native invariant-failure diagnostic blocks proceed even with otherwise clean accounting', () => {
  const capture = `${healthyJsonRequest()}\n${healthyNativeUtterance('a', 0)}\n${nativeRecord(
    nativeEvent('invariantFailure', { anomaly: 'duplicateTerminal(id: "a")' })
  )}`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
});

runTest('unrelated console noise around native records remains ignored', () => {
  const capture = `Metro ready\n${healthyJsonRequest()}\n${healthyNativeUtterance(
    'a',
    0
  )}\nwarning: something unrelated`;
  const report = analyzeValidationLog(capture, { requireNativeLifecycle: true });
  assert.strictEqual(report.captureStatus, 'VALID');
});

runTest('latency is computed from existing JS timestamps and reported per attempt', () => {
  const capture = Array.from({ length: 5 }, (_, index) =>
    healthyJsonRequest(`tts-${1000 + index}-${index + 1}`)
  ).join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.latency.attempts, 5);
  assert.strictEqual(report.latency.n, 5);
  assert.strictEqual(report.latency.missingStarts, 0);
  assert.strictEqual(report.latency.minMs, 1);
  assert.strictEqual(report.latency.medianMs, 1);
  assert.strictEqual(report.latency.maxMs, 1);
});

runTest('a request that never starts is reported as a missing latency sample, not silently excluded', () => {
  const cancelledBeforeStart = [
    lifecycleEvent('requested', 'tts-3000-1'),
    lifecycleEvent('accepted', 'tts-3000-1'),
    lifecycleEvent('submitted-to-native-speech', 'tts-3000-1'),
    lifecycleEvent('cancelled', 'tts-3000-1'),
  ]
    .map(jsonRecord)
    .join('\n');
  const report = analyzeValidationLog(`${healthyJsonRequest()}\n${cancelledBeforeStart}`);
  assert.strictEqual(report.captureStatus, 'VALID');
  assert.strictEqual(report.latency.attempts, 2);
  assert.strictEqual(report.latency.n, 1);
  assert.strictEqual(report.latency.missingStarts, 1);
});

runTest('a started event whose playback timestamp precedes submission invalidates the capture', () => {
  const capture = [
    lifecycleEvent('requested', 'tts-4000-1'),
    lifecycleEvent('accepted', 'tts-4000-1'),
    lifecycleEvent('submitted-to-native-speech', 'tts-4000-1'),
    lifecycleEvent('started', 'tts-4000-1', { playbackStartedAtMs: 500 }),
  ]
    .map(jsonRecord)
    .join('\n');
  const report = analyzeValidationLog(capture);
  assert.strictEqual(report.captureStatus, 'INVALID_CAPTURE');
});

runTest('--json emits a machine-readable report including schemaVersion', () => {
  const cli = runAnalyzerCli(healthyJsonRequest(), ['--json']);
  assert.strictEqual(cli.status, 1); // INCONCLUSIVE verdict with a single attempt
  const parsed = JSON.parse(cli.stdout);
  assert.strictEqual(parsed.schemaVersion, 1);
  assert.strictEqual(parsed.captureStatus, 'VALID');
});

runTest('--require-native-lifecycle through the CLI enforces strict evidence end to end', () => {
  const cli = runAnalyzerCli(healthyJsonRequest(), ['--require-native-lifecycle']);
  assert.strictEqual(cli.status, 1);
  assert.match(cli.stdout, /INVALID_CAPTURE/);
});
