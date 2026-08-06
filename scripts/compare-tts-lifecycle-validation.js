#!/usr/bin/env node
// Compares two schemaVersion-1 --json reports from
// scripts/analyze-tts-validation-log.js (see that file's header for the full
// contract) — a retained-control arm and a rotation-candidate arm — against
// the Task 7 Phase 1 acceptance thresholds. Both inputs must already carry
// validated native lifecycle evidence; this tool does not re-derive capture
// validity, it trusts the analyzer's prior verdict.
//
// Usage:
//   node scripts/compare-tts-lifecycle-validation.js <control.json> <candidate.json>
const fs = require('fs');

const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);

const THRESHOLDS = {
  medianMs: 15,
  p95Ms: 30,
};

// The current [tts-playback] JS event schema does not distinguish a
// deliberate stop-initiated cancellation (e.g. Task 7's explicit-stop device
// case) from an unexpected one, and this tool must not add that distinction
// by touching production coordinator files. "unexpected cancellations" is
// therefore approximated as the total cancelled count; a device matrix that
// includes deliberate stop scenarios should account for that when reading
// this check.
function loadReport(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function requireComparableReport(report, label) {
  const errors = [];

  if (!SUPPORTED_SCHEMA_VERSIONS.has(report.schemaVersion)) {
    errors.push(
      `${label} report schemaVersion ${report.schemaVersion} is not supported (expected one of ${[
        ...SUPPORTED_SCHEMA_VERSIONS,
      ].join(', ')})`
    );
  }
  if (report.captureStatus !== 'VALID') {
    errors.push(`${label} report captureStatus is ${report.captureStatus}, expected VALID`);
  }
  if (report.requireNativeLifecycle !== true) {
    errors.push(
      `${label} report was not analyzed with --require-native-lifecycle; comparison requires validated native lifecycle evidence`
    );
  }
  if (report.latency && report.latency.missingStarts > 0) {
    errors.push(
      `${label} report has ${report.latency.missingStarts} attempt(s) with a missing latency start; comparison requires every accepted attempt to report a sample`
    );
  }

  return errors;
}

function compareLifecycleValidation(controlReport, candidateReport) {
  const errors = [
    ...requireComparableReport(controlReport, 'control'),
    ...requireComparableReport(candidateReport, 'candidate'),
  ];
  if (errors.length > 0) {
    return { errors, comparison: null };
  }

  const control = controlReport;
  const candidate = candidateReport;

  const medianDeltaMs = candidate.latency.medianMs - control.latency.medianMs;
  const p95DeltaMs = candidate.latency.p95Ms - control.latency.p95Ms;
  const watchdogDelta = candidate.metrics.timeouts.total - control.metrics.timeouts.total;
  const cancellationDelta = candidate.metrics.cancelled - control.metrics.cancelled;
  const callbackFailureDelta = candidate.metrics.failed - control.metrics.failed;

  const checks = [
    {
      name: 'median latency',
      deltaMs: medianDeltaMs,
      limitMs: THRESHOLDS.medianMs,
      pass: medianDeltaMs <= THRESHOLDS.medianMs,
    },
    {
      name: 'p95 latency',
      deltaMs: p95DeltaMs,
      limitMs: THRESHOLDS.p95Ms,
      pass: p95DeltaMs <= THRESHOLDS.p95Ms,
    },
    { name: 'watchdog recoveries', delta: watchdogDelta, pass: watchdogDelta <= 0 },
    {
      name: 'unexpected cancellations',
      delta: cancellationDelta,
      pass: cancellationDelta <= 0,
    },
    {
      name: 'callback failures',
      delta: callbackFailureDelta,
      pass: callbackFailureDelta <= 0,
    },
  ];

  return {
    errors: [],
    comparison: {
      control: {
        n: control.latency.n,
        medianMs: control.latency.medianMs,
        p95Ms: control.latency.p95Ms,
      },
      candidate: {
        n: candidate.latency.n,
        medianMs: candidate.latency.medianMs,
        p95Ms: candidate.latency.p95Ms,
      },
      checks,
      passed: checks.every((check) => check.pass),
    },
  };
}

function formatComparisonReport({ errors, comparison }) {
  if (errors.length > 0) {
    return ['TTS lifecycle comparison blocked:', ...errors.map((error) => `  - ${error}`)].join(
      '\n'
    );
  }

  const lines = [
    'TTS lifecycle comparison',
    '='.repeat(60),
    `Control:   n=${comparison.control.n}  median=${comparison.control.medianMs}ms  p95=${comparison.control.p95Ms}ms`,
    `Candidate: n=${comparison.candidate.n}  median=${comparison.candidate.medianMs}ms  p95=${comparison.candidate.p95Ms}ms`,
    '',
  ];
  for (const check of comparison.checks) {
    const deltaLabel =
      'deltaMs' in check ? `${check.deltaMs}ms (limit ${check.limitMs}ms)` : `${check.delta}`;
    lines.push(`${check.pass ? 'PASS' : 'FAIL'} - ${check.name}: ${deltaLabel}`);
  }
  lines.push('='.repeat(60));
  lines.push(comparison.passed ? 'Result: PASS' : 'Result: FAIL');
  return lines.join('\n');
}

function exitCodeForComparison({ errors, comparison }) {
  if (errors.length > 0) return 1;
  return comparison.passed ? 0 : 1;
}

module.exports = {
  compareLifecycleValidation,
  requireComparableReport,
  formatComparisonReport,
  exitCodeForComparison,
  SUPPORTED_SCHEMA_VERSIONS,
};

if (require.main === module) {
  const [controlPath, candidatePath] = process.argv.slice(2);
  if (!controlPath || !candidatePath) {
    console.error(
      'Usage: node scripts/compare-tts-lifecycle-validation.js <control.json> <candidate.json>'
    );
    process.exit(2);
  }
  const result = compareLifecycleValidation(loadReport(controlPath), loadReport(candidatePath));
  console.log(formatComparisonReport(result));
  process.exit(exitCodeForComparison(result));
}
