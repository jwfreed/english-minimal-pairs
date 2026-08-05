#!/usr/bin/env node
// Turns a raw device-validation capture into the Commit 1 validation metrics.
//
// Usage:
//   npm run analyze:tts-log -- <captured-log-file>
//   npx expo start 2>&1 | tee /tmp/tts-validation.log   (capture first)
//
const fs = require('fs');

const MARKER = '[tts-playback]';
const MAX_REPRESENTATIVE_ERRORS = 5;
const JSON_OBJECT_PATTERN = /^\{\s*"/;
const LEGACY_FIELD_PATTERN =
  /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?)|(true|false|null))$/;

function scanDiagnosticRecords(logText) {
  const lines = logText.length === 0 ? [] : logText.split(/\r?\n/);
  const records = [];

  for (let index = 0; index < lines.length; index += 1) {
    const markerIndex = lines[index].indexOf(MARKER);
    if (markerIndex === -1) continue;

    const lineNumber = index + 1;
    const firstPayload = lines[index].slice(markerIndex + MARKER.length).trim();
    const payloadLines = [firstPayload];
    let incomplete = !firstPayload.endsWith('}');

    while (incomplete && index + 1 < lines.length) {
      if (lines[index + 1].includes(MARKER)) break;
      index += 1;
      payloadLines.push(lines[index]);
      incomplete = !lines[index].trimEnd().endsWith('}');
    }

    records.push({
      lineNumber,
      payload: payloadLines.join('\n').trim(),
      incomplete,
    });
  }

  return { linesInspected: lines.length, records };
}

function parseLegacyObject(payload) {
  if (!payload.startsWith('{') || !payload.endsWith('}')) {
    throw new Error('legacy diagnostic payload must be a complete object');
  }
  const body = payload.slice(1, -1).trim();
  if (!body) return {};

  const event = {};
  for (const rawField of body.split(',')) {
    const match = rawField.trim().match(LEGACY_FIELD_PATTERN);
    if (!match) throw new Error(`invalid legacy field: ${rawField.trim()}`);
    const [, key, stringValue, numberValue, literalValue] = match;
    if (Object.hasOwn(event, key)) throw new Error(`duplicate legacy field: ${key}`);
    if (stringValue !== undefined) event[key] = stringValue;
    else if (numberValue !== undefined) event[key] = Number(numberValue);
    else if (literalValue === 'true') event[key] = true;
    else if (literalValue === 'false') event[key] = false;
    else event[key] = null;
  }
  return event;
}

function parseDiagnosticRecord(record) {
  if (record.incomplete) throw new Error('incomplete diagnostic record');
  if (!record.payload.startsWith('{')) {
    throw new Error('diagnostic payload must be an object');
  }
  if (JSON_OBJECT_PATTERN.test(record.payload)) return JSON.parse(record.payload);
  return parseLegacyObject(record.payload);
}

function countPhases(events) {
  const counts = new Map();
  for (const event of events) {
    const phase = event.phase;
    counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  return counts;
}

function collectRequestIds(events) {
  const seen = new Set();
  for (const event of events) {
    if (typeof event.requestId === 'string') seen.add(event.requestId);
  }
  return [...seen];
}

function analyzeValidationLog(logText) {
  const { linesInspected, records } = scanDiagnosticRecords(logText);
  const parseSummary = {
    linesInspected,
    diagnosticRecordsFound: records.length,
    parsedRecords: 0,
    invalidRecords: 0,
    firstInvalidLineNumber: null,
    errors: [],
    lifecycleFailures: [],
  };
  const events = [];

  for (const record of records) {
    try {
      events.push(parseDiagnosticRecord(record));
      parseSummary.parsedRecords += 1;
    } catch (error) {
      parseSummary.invalidRecords += 1;
      if (parseSummary.firstInvalidLineNumber === null) {
        parseSummary.firstInvalidLineNumber = record.lineNumber;
      }
      if (parseSummary.errors.length < MAX_REPRESENTATIVE_ERRORS) {
        parseSummary.errors.push({
          lineNumber: record.lineNumber,
          category: 'parse',
          message: error.message,
        });
      }
    }
  }

  if (records.length === 0) {
    return {
      captureStatus: 'EMPTY_CAPTURE',
      parseSummary,
      metrics: null,
      runtimeVerdict: null,
    };
  }

  if (parseSummary.invalidRecords > 0) {
    return {
      captureStatus: 'INVALID_CAPTURE',
      parseSummary,
      metrics: null,
      runtimeVerdict: null,
    };
  }

  const phases = countPhases(events);
  const count = (phase) => phases.get(phase) ?? 0;

  const submitted = count('submitted-to-native-speech');
  const accepted = count('accepted');
  // The lifecycle events are __DEV__-only. A release capture has recovery
  // diagnostics but no denominator, which must be reported rather than
  // silently presented as an empty session.
  const attemptDenominatorAvailable = submitted > 0 || accepted > 0;
  const attempts = submitted || accepted;

  const timeouts = {
    awaitingStart: count('ownership-timeout-awaiting-start'),
    awaitingTerminal: count('ownership-timeout-awaiting-terminal'),
    get total() {
      return this.awaitingStart + this.awaitingTerminal;
    },
  };

  const lateCallbacks = {
    afterTimeout: count('late-callback-after-timeout'),
    unknownRequest: count('late-callback-unknown-request'),
    get total() {
      return this.afterTimeout + this.unknownRequest;
    },
  };

  const hasAnyEvent = phases.size > 0;
  const unexpectedRecoveries = timeouts.total;
  const clean = hasAnyEvent && unexpectedRecoveries === 0;

  return {
    attempts,
    attemptDenominatorAvailable,
    completed: count('completed'),
    cancelled: count('cancelled'),
    failed: count('failed'),
    rejectedDuplicates: count('rejected-duplicate'),
    timeouts: {
      awaitingStart: timeouts.awaitingStart,
      awaitingTerminal: timeouts.awaitingTerminal,
      total: timeouts.total,
    },
    lateCallbacks: {
      afterTimeout: lateCallbacks.afterTimeout,
      unknownRequest: lateCallbacks.unknownRequest,
      total: lateCallbacks.total,
    },
    unexpectedRecoveries,
    requestIds: collectRequestIds(events),
    clean,
    captureStatus: 'VALID',
    parseSummary,
    metrics: null,
    runtimeVerdict: null,
    verdict: buildVerdict({
      hasAnyEvent,
      attemptDenominatorAvailable,
      attempts,
      unexpectedRecoveries,
      lateCallbacks: lateCallbacks.total,
      failed: count('failed'),
    }),
  };
}

function buildVerdict({
  hasAnyEvent,
  attemptDenominatorAvailable,
  attempts,
  unexpectedRecoveries,
  lateCallbacks,
  failed,
}) {
  if (!hasAnyEvent) {
    return 'UNUSABLE — no [tts-playback] events found. Confirm the capture came from a development build with Metro attached.';
  }
  if (!attemptDenominatorAvailable) {
    return 'UNUSABLE — recovery diagnostics present but no attempt denominator. The lifecycle events are __DEV__-only; re-capture from a development build.';
  }
  if (unexpectedRecoveries > 0) {
    return `BLOCKED — ${unexpectedRecoveries} watchdog recovery/recoveries during normal use. Commit 2 is gated on zero. Investigate whether these are false positives (audio sounded fine) before adjusting timeout constants.`;
  }
  if (failed > 0) {
    return `REVIEW — no watchdog recoveries, but ${failed} native error callback(s). Explain these before proceeding.`;
  }
  if (lateCallbacks > 0) {
    return `REVIEW — no watchdog recoveries, but ${lateCallbacks} late callback(s) with no preceding timeout. Unexpected; explain before proceeding.`;
  }
  if (attempts < 30) {
    return `INCONCLUSIVE — only ${attempts} attempt(s) captured. Collect at least 30 across cold launch, post-resume, rapid replay, and normal intervals.`;
  }
  return `PROCEED — ${attempts} attempts, zero watchdog recoveries, zero late callbacks. Commit 1 shows no regression; Commit 2 may begin.`;
}

function formatValidationReport(report) {
  if (report.captureStatus !== 'VALID') {
    return formatEvidenceReport(report);
  }

  const lines = [
    'TTS Commit 1 device validation',
    '='.repeat(60),
    `Total playback attempts        ${report.attempts}${report.attemptDenominatorAvailable ? '' : '  (denominator unavailable)'}`,
    `  completed                    ${report.completed}`,
    `  cancelled                    ${report.cancelled}`,
    `  failed (native error)        ${report.failed}`,
    `  rejected as duplicate        ${report.rejectedDuplicates}`,
    `Distinct requests seen         ${report.requestIds.length}`,
    '',
    `Watchdog timeouts              ${report.timeouts.total}`,
    `  awaiting-start               ${report.timeouts.awaitingStart}`,
    `  awaiting-terminal            ${report.timeouts.awaitingTerminal}`,
    '',
    `Late callbacks                 ${report.lateCallbacks.total}`,
    `  after-timeout                ${report.lateCallbacks.afterTimeout}`,
    `  unknown-request              ${report.lateCallbacks.unknownRequest}`,
    '',
    `Unexpected recoveries          ${report.unexpectedRecoveries}`,
    '='.repeat(60),
    `Verdict: ${report.verdict}`,
  ];
  return lines.join('\n');
}

function formatEvidenceReport({ captureStatus, parseSummary }) {
  const lines = [
    'TTS Commit 1 device validation',
    '='.repeat(60),
    `Capture status                 ${captureStatus}`,
    `Diagnostic records found       ${parseSummary.diagnosticRecordsFound}`,
    `Parsed records                 ${parseSummary.parsedRecords}`,
    `Invalid records                ${parseSummary.invalidRecords}`,
  ];

  if (parseSummary.firstInvalidLineNumber !== null) {
    lines.push(`First invalid line             ${parseSummary.firstInvalidLineNumber}`);
  }
  for (const error of parseSummary.errors) {
    lines.push(`Line ${error.lineNumber} (${error.category}): ${error.message}`);
  }

  lines.push('='.repeat(60));
  return lines.join('\n');
}

module.exports = {
  analyzeValidationLog,
  formatValidationReport,
  scanDiagnosticRecords,
  parseDiagnosticRecord,
};

if (require.main === module) {
  const logPath = process.argv[2];
  if (!logPath) {
    console.error('Usage: node scripts/analyze-tts-validation-log.js <log-file>');
    process.exit(2);
  }
  const report = analyzeValidationLog(fs.readFileSync(logPath, 'utf8'));
  console.log(formatValidationReport(report));
  process.exit(report.clean ? 0 : 1);
}
