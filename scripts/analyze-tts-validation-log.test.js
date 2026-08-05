// Coverage for the device-validation log analyzer. The analyzer turns a raw
// Metro/Console capture into the Commit 1 validation metrics, so that counting
// timeouts and late callbacks is not a manual eyeball exercise over hundreds of
// lines.
const assert = require('assert');
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

// Metro prints console objects across several lines with unquoted keys, so the
// analyzer scans for phase tokens rather than parsing JSON.
const HEALTHY_UTTERANCE = `
[tts-playback] {
  phase: 'requested',
  requestId: 'tts-1000-1',
  word: 'oath'
}
[tts-playback] { phase: 'accepted', requestId: 'tts-1000-1', word: 'oath' }
[tts-playback] { phase: 'submitted-to-native-speech', requestId: 'tts-1000-1' }
[tts-playback] { phase: 'started', requestId: 'tts-1000-1' }
[tts-playback] { phase: 'completed', requestId: 'tts-1000-1' }
`;

const TIMED_OUT_UTTERANCE = `
[tts-playback] { phase: 'accepted', requestId: 'tts-2000-2', word: 'oaths' }
[tts-playback] { phase: 'submitted-to-native-speech', requestId: 'tts-2000-2' }
[tts-playback] {
  phase: 'ownership-timeout-awaiting-start',
  requestId: 'tts-2000-2',
  timedOutPhase: 'awaiting-start'
}
`;

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

runTest('an empty capture is reported as unusable rather than clean', () => {
  const report = analyzeValidationLog('');

  assert.strictEqual(report.attempts, 0);
  assert.strictEqual(report.clean, false);
  assert.match(report.verdict, /no \[tts-playback\] events/i);
});

runTest('a clean run recommends proceeding to Commit 2', () => {
  const report = analyzeValidationLog(
    Array.from({ length: 30 }, () => HEALTHY_UTTERANCE).join('\n')
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
