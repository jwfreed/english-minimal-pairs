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

function runAnalyzerCli(capture) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-validation-log-'));
  const capturePath = path.join(directory, 'capture.log');
  fs.writeFileSync(capturePath, capture);
  try {
    return spawnSync(process.execPath, [
      path.join(__dirname, 'analyze-tts-validation-log.js'),
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
    healthyJsonRequest(),
    lifecycleEvent('requested', 'tts-1001-2'),
    lifecycleEvent('rejected-duplicate', 'tts-1001-2', {
      activePlaybackOwnerRequestId: 'tts-1000-1',
    }),
  ].flatMap((record) => typeof record === 'string' ? [record] : [jsonRecord(record)]).join('\n'));

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
