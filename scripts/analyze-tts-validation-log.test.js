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
  lifecycleEvent('accepted', 'tts-2000-2', { word: 'oaths' }),
  lifecycleEvent('submitted-to-native-speech', 'tts-2000-2', { word: 'oaths' }),
  lifecycleEvent('ownership-timeout-awaiting-start', 'tts-2000-2', {
    word: 'oaths',
    timedOutPhase: 'awaiting-start',
  }),
]
  .map(legacyRecord)
  .join('\n');

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

  assert.strictEqual(report.attempts, 1);
  assert.strictEqual(report.completed, 1);
  assert.strictEqual(report.timeouts.total, 0);
  assert.strictEqual(report.lateCallbacks.total, 0);
  assert.strictEqual(report.unexpectedRecoveries, 0);
  assert.strictEqual(report.clean, true);
});

runTest('does not mistake timedOutPhase for the event phase key', () => {
  // A naive /phase:/ regex matches `timedOutPhase:` too, which would
  // double-count every timeout event.
  const report = analyzeValidationLog(TIMED_OUT_UTTERANCE);

  assert.strictEqual(report.timeouts.total, 1);
  assert.strictEqual(report.timeouts.awaitingStart, 1);
  assert.strictEqual(report.timeouts.awaitingTerminal, 0);
});

runTest('separates the two timeout phases', () => {
  const report = analyzeValidationLog(`
    [tts-playback] { phase: 'ownership-timeout-awaiting-start' }
    [tts-playback] { phase: 'ownership-timeout-awaiting-terminal' }
    [tts-playback] { phase: 'ownership-timeout-awaiting-terminal' }
  `);

  assert.strictEqual(report.timeouts.awaitingStart, 1);
  assert.strictEqual(report.timeouts.awaitingTerminal, 2);
  assert.strictEqual(report.timeouts.total, 3);
});

runTest('separates the two late-callback classifications', () => {
  const report = analyzeValidationLog(`
    [tts-playback] { phase: 'late-callback-after-timeout' }
    [tts-playback] { phase: 'late-callback-unknown-request' }
  `);

  assert.strictEqual(report.lateCallbacks.afterTimeout, 1);
  assert.strictEqual(report.lateCallbacks.unknownRequest, 1);
  assert.strictEqual(report.lateCallbacks.total, 2);
});

runTest('counts duplicate rejections without counting them as attempts', () => {
  const report = analyzeValidationLog(`
    ${HEALTHY_UTTERANCE}
    [tts-playback] { phase: 'rejected-duplicate', requestId: 'tts-1000-9' }
  `);

  assert.strictEqual(report.attempts, 1);
  assert.strictEqual(report.rejectedDuplicates, 1);
});

runTest('treats any timeout during a validation run as an unexpected recovery', () => {
  const report = analyzeValidationLog(
    `${HEALTHY_UTTERANCE}\n${TIMED_OUT_UTTERANCE}`
  );

  assert.strictEqual(report.attempts, 2);
  assert.strictEqual(report.unexpectedRecoveries, 1);
  assert.strictEqual(
    report.clean,
    false,
    'a run containing a watchdog recovery does not satisfy the Commit 2 gate'
  );
});

runTest('reports distinct request identities so repeats are visible', () => {
  const report = analyzeValidationLog(
    `${HEALTHY_UTTERANCE}\n${TIMED_OUT_UTTERANCE}`
  );

  assert.deepStrictEqual(report.requestIds, ['tts-1000-1', 'tts-2000-2']);
});

runTest('falls back to accepted events when submissions are absent', () => {
  // A release build emits only recovery diagnostics; the accepted/submitted
  // lifecycle is __DEV__-only. The analyzer must say so rather than report
  // zero attempts as if the session were empty.
  const report = analyzeValidationLog(`
    [tts-playback] { phase: 'ownership-timeout-awaiting-start' }
  `);

  assert.strictEqual(report.attempts, 0);
  assert.strictEqual(report.attemptDenominatorAvailable, false);
});

runTest('a clean run recommends proceeding to Commit 2', () => {
  const report = analyzeValidationLog(
    Array.from(
      { length: 30 },
      (_, index) => healthyJsonRequest(`tts-${1000 + index}-${index + 1}`)
    ).join('\n')
  );

  assert.strictEqual(report.attempts, 30);
  assert.strictEqual(report.clean, true);
  assert.match(report.verdict, /proceed/i);
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
    'Verdict',
  ]) {
    assert.ok(text.includes(required), `report must include "${required}"`);
  }
});
