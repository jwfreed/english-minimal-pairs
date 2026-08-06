const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  compareLifecycleValidation,
  requireComparableReport,
  formatComparisonReport,
  exitCodeForComparison,
  SUPPORTED_SCHEMA_VERSIONS,
} = require('./compare-tts-lifecycle-validation');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function validReport(overrides = {}) {
  return {
    schemaVersion: 1,
    requireNativeLifecycle: true,
    captureStatus: 'VALID',
    validationPassed: true,
    runtimeVerdict: 'PROCEED',
    metrics: {
      attempts: 60,
      completed: 60,
      cancelled: 0,
      failed: 0,
      rejectedDuplicates: 0,
      timeouts: { awaitingStart: 0, awaitingTerminal: 0, total: 0 },
      lateCallbacks: { afterTimeout: 0, unknownRequest: 0, total: 0 },
      requestIds: [],
    },
    latency: {
      attempts: 60,
      n: 60,
      missingStarts: 0,
      minMs: 80,
      medianMs: 120,
      p95Ms: 180,
      maxMs: 220,
    },
    parseSummary: {},
    nativeParseSummary: {},
    ...overrides,
  };
}

function writeReport(directory, name, report) {
  const reportPath = path.join(directory, name);
  fs.writeFileSync(reportPath, JSON.stringify(report));
  return reportPath;
}

runTest('requires a supported schemaVersion on both reports', () => {
  const errors = requireComparableReport(validReport({ schemaVersion: 2 }), 'control');
  assert.ok(errors.some((error) => error.includes('schemaVersion')));
});

runTest('accepts every currently supported schemaVersion', () => {
  for (const version of SUPPORTED_SCHEMA_VERSIONS) {
    const errors = requireComparableReport(validReport({ schemaVersion: version }), 'control');
    assert.deepStrictEqual(
      errors.filter((error) => error.includes('schemaVersion')),
      []
    );
  }
});

runTest('requires captureStatus VALID', () => {
  const errors = requireComparableReport(
    validReport({ captureStatus: 'INVALID_CAPTURE' }),
    'candidate'
  );
  assert.ok(errors.some((error) => error.includes('captureStatus')));
});

runTest('requires the report to have been analyzed with --require-native-lifecycle', () => {
  const errors = requireComparableReport(
    validReport({ requireNativeLifecycle: false }),
    'control'
  );
  assert.ok(errors.some((error) => error.includes('--require-native-lifecycle')));
});

runTest('requires zero missing latency starts', () => {
  const errors = requireComparableReport(
    validReport({ latency: { ...validReport().latency, missingStarts: 3 } }),
    'candidate'
  );
  assert.ok(errors.some((error) => error.includes('missing')));
});

runTest('accepts a fully valid report with no errors', () => {
  const errors = requireComparableReport(validReport(), 'control');
  assert.deepStrictEqual(errors, []);
});

runTest('blocks comparison and reports every violation when either input is uncomparable', () => {
  const result = compareLifecycleValidation(
    validReport({ schemaVersion: 2 }),
    validReport({ captureStatus: 'INVALID_CAPTURE' })
  );
  assert.strictEqual(result.comparison, null);
  assert.ok(result.errors.some((error) => error.includes('control')));
  assert.ok(result.errors.some((error) => error.includes('candidate')));
});

runTest('passes when every threshold is within its limit', () => {
  const control = validReport();
  const candidate = validReport({
    latency: { ...control.latency, medianMs: 130, p95Ms: 200 },
  });
  const result = compareLifecycleValidation(control, candidate);
  assert.strictEqual(result.errors.length, 0);
  assert.strictEqual(result.comparison.passed, true);
});

runTest('fails when candidate median latency exceeds the control by more than 15ms', () => {
  const control = validReport();
  const candidate = validReport({
    latency: { ...control.latency, medianMs: control.latency.medianMs + 16 },
  });
  const result = compareLifecycleValidation(control, candidate);
  assert.strictEqual(result.comparison.passed, false);
  const medianCheck = result.comparison.checks.find((check) => check.name === 'median latency');
  assert.strictEqual(medianCheck.pass, false);
});

runTest('passes at exactly the median latency limit boundary', () => {
  const control = validReport();
  const candidate = validReport({
    latency: { ...control.latency, medianMs: control.latency.medianMs + 15 },
  });
  const result = compareLifecycleValidation(control, candidate);
  const medianCheck = result.comparison.checks.find((check) => check.name === 'median latency');
  assert.strictEqual(medianCheck.pass, true);
});

runTest('fails when candidate p95 latency exceeds the control by more than 30ms', () => {
  const control = validReport();
  const candidate = validReport({
    latency: { ...control.latency, p95Ms: control.latency.p95Ms + 31 },
  });
  const result = compareLifecycleValidation(control, candidate);
  const p95Check = result.comparison.checks.find((check) => check.name === 'p95 latency');
  assert.strictEqual(p95Check.pass, false);
});

runTest('fails when the candidate introduces any new watchdog recovery', () => {
  const control = validReport();
  const candidate = validReport({
    metrics: {
      ...control.metrics,
      timeouts: { awaitingStart: 1, awaitingTerminal: 0, total: 1 },
    },
  });
  const result = compareLifecycleValidation(control, candidate);
  const watchdogCheck = result.comparison.checks.find(
    (check) => check.name === 'watchdog recoveries'
  );
  assert.strictEqual(watchdogCheck.pass, false);
  assert.strictEqual(result.comparison.passed, false);
});

runTest('fails when the candidate introduces more cancellations than the control', () => {
  const control = validReport();
  const candidate = validReport({
    metrics: { ...control.metrics, cancelled: control.metrics.cancelled + 1 },
  });
  const result = compareLifecycleValidation(control, candidate);
  const cancellationCheck = result.comparison.checks.find(
    (check) => check.name === 'unexpected cancellations'
  );
  assert.strictEqual(cancellationCheck.pass, false);
});

runTest('fails when the candidate introduces more callback failures than the control', () => {
  const control = validReport();
  const candidate = validReport({
    metrics: { ...control.metrics, failed: control.metrics.failed + 1 },
  });
  const result = compareLifecycleValidation(control, candidate);
  const failureCheck = result.comparison.checks.find(
    (check) => check.name === 'callback failures'
  );
  assert.strictEqual(failureCheck.pass, false);
});

runTest('the human-readable report names every check and the final verdict', () => {
  const control = validReport();
  const candidate = validReport();
  const result = compareLifecycleValidation(control, candidate);
  const text = formatComparisonReport(result);
  for (const required of [
    'median latency',
    'p95 latency',
    'watchdog recoveries',
    'unexpected cancellations',
    'callback failures',
    'Result: PASS',
  ]) {
    assert.ok(text.includes(required), `report must include "${required}"`);
  }
});

runTest('the human-readable report lists blocking errors instead of a verdict when uncomparable', () => {
  const result = compareLifecycleValidation(
    validReport({ captureStatus: 'INVALID_CAPTURE' }),
    validReport()
  );
  const text = formatComparisonReport(result);
  assert.match(text, /blocked/i);
  assert.doesNotMatch(text, /Result: PASS|Result: FAIL/);
});

runTest('exit code is nonzero when comparison is blocked', () => {
  const result = compareLifecycleValidation(
    validReport({ captureStatus: 'INVALID_CAPTURE' }),
    validReport()
  );
  assert.strictEqual(exitCodeForComparison(result), 1);
});

runTest('exit code is zero only when the comparison passes', () => {
  const passing = compareLifecycleValidation(validReport(), validReport());
  assert.strictEqual(exitCodeForComparison(passing), 0);

  const failing = compareLifecycleValidation(
    validReport(),
    validReport({
      metrics: { ...validReport().metrics, failed: 1 },
    })
  );
  assert.strictEqual(exitCodeForComparison(failing), 1);
});

runTest('the CLI reads two report files and prints a pass verdict', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-lifecycle-compare-'));
  try {
    const controlPath = writeReport(directory, 'control.json', validReport());
    const candidatePath = writeReport(directory, 'candidate.json', validReport());
    const cli = spawnSync(process.execPath, [
      path.join(__dirname, 'compare-tts-lifecycle-validation.js'),
      controlPath,
      candidatePath,
    ], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 0);
    assert.match(cli.stdout, /Result: PASS/);
    assert.strictEqual(cli.stderr, '');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

runTest('the CLI exits nonzero and explains itself when a report file is uncomparable', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-lifecycle-compare-'));
  try {
    const controlPath = writeReport(directory, 'control.json', validReport({ schemaVersion: 2 }));
    const candidatePath = writeReport(directory, 'candidate.json', validReport());
    const cli = spawnSync(process.execPath, [
      path.join(__dirname, 'compare-tts-lifecycle-validation.js'),
      controlPath,
      candidatePath,
    ], { encoding: 'utf8' });
    assert.strictEqual(cli.status, 1);
    assert.match(cli.stdout, /schemaVersion/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
