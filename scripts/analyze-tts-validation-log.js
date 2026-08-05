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
const PHASES = new Set([
  'requested',
  'accepted',
  'rejected-duplicate',
  'submitted-to-native-speech',
  'started',
  'completed',
  'cancelled',
  'failed',
  'ownership-timeout-awaiting-start',
  'ownership-timeout-awaiting-terminal',
  'late-callback-after-timeout',
  'late-callback-unknown-request',
]);
const REQUEST_ID_PATTERN = /^tts-\d+-\d+$/;
const NATIVE_CALLBACKS = new Set(['onDone', 'onStopped', 'onError']);
const TERMINAL_PHASES = new Set([
  'completed',
  'cancelled',
  'failed',
  'ownership-timeout-awaiting-start',
  'ownership-timeout-awaiting-terminal',
]);
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

function requireFiniteTimestamp(event, field) {
  if (!Number.isFinite(event[field]) || event[field] < 0) {
    throw new Error(`${field} must be a finite non-negative number`);
  }
}

function validateEventSchema(event, lineNumber) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('diagnostic payload must be an object');
  }
  if (!PHASES.has(event.phase)) throw new Error(`unknown phase: ${String(event.phase)}`);
  if (typeof event.requestId !== 'string' || !REQUEST_ID_PATTERN.test(event.requestId)) {
    throw new Error('requestId must match tts-<timestamp>-<sequence>');
  }

  const ordinaryLifecycle = !event.phase.startsWith('ownership-timeout-') &&
    !event.phase.startsWith('late-callback-');
  if (ordinaryLifecycle) {
    if (typeof event.word !== 'string' || event.word.length === 0) {
      throw new Error('ordinary lifecycle event must contain a non-empty word');
    }
    if (!Number.isInteger(event.difficulty) || event.difficulty < 1 || event.difficulty > 6) {
      throw new Error('ordinary lifecycle event must contain difficulty 1 through 6');
    }
    requireFiniteTimestamp(event, 'requestedAtMs');
    if (typeof event.isSpeaking !== 'boolean') {
      throw new Error('ordinary lifecycle event must contain boolean isSpeaking');
    }
  }

  if (![0, 1].includes(event.coordinatorObservedActivePlaybackOwnershipCount)) {
    throw new Error('coordinator ownership count must be 0 or 1');
  }

  if (event.phase.startsWith('ownership-timeout-')) {
    if (typeof event.word !== 'string' || event.word.length === 0) {
      throw new Error('timeout diagnostic must contain a non-empty word');
    }
    if (!Number.isInteger(event.difficulty) || event.difficulty < 1 || event.difficulty > 6) {
      throw new Error('timeout diagnostic must contain difficulty 1 through 6');
    }
    requireFiniteTimestamp(event, 'requestedAtMs');
    requireFiniteTimestamp(event, 'timedOutAtMs');
    const expected = event.phase.endsWith('awaiting-start')
      ? 'awaiting-start'
      : 'awaiting-terminal';
    if (event.timedOutPhase !== expected) throw new Error(`timedOutPhase must be ${expected}`);
    if (event.coordinatorObservedActivePlaybackOwnershipCount !== 0) {
      throw new Error('timeout diagnostic must prove coordinator ownership released');
    }
  } else if (event.phase.startsWith('late-callback-')) {
    requireFiniteTimestamp(event, 'eventTimestampMs');
    if (!NATIVE_CALLBACKS.has(event.nativeCallback)) {
      throw new Error('late callback must identify onDone, onStopped, or onError');
    }
  } else {
    requireFiniteTimestamp(event, 'eventTimestampMs');
  }

  if (['submitted-to-native-speech', 'started', 'completed', 'cancelled'].includes(event.phase)) {
    requireFiniteTimestamp(event, 'speechSubmittedAtMs');
  }
  if (event.phase === 'started') requireFiniteTimestamp(event, 'playbackStartedAtMs');
  if (event.phase === 'completed') requireFiniteTimestamp(event, 'playbackFinishedAtMs');
  if (event.phase === 'cancelled') requireFiniteTimestamp(event, 'cancellationAtMs');
  if (event.phase === 'failed') requireFiniteTimestamp(event, 'failureAtMs');

  if (event.phase === 'rejected-duplicate') {
    if (
      typeof event.activePlaybackOwnerRequestId !== 'string' ||
      !REQUEST_ID_PATTERN.test(event.activePlaybackOwnerRequestId) ||
      event.activePlaybackOwnerRequestId === event.requestId
    ) {
      throw new Error('rejected duplicate must identify a different active owner');
    }
  }
}

function initialLifecycleState(lineNumber) {
  return {
    requested: false,
    accepted: false,
    submitted: false,
    started: false,
    rejected: false,
    timedOut: false,
    terminalCount: 0,
    admissionLineNumber: lineNumber,
    terminalPhase: null,
  };
}

function validateLifecycle(records) {
  const states = new Map();
  const failures = [];
  const fail = (lineNumber, message) => failures.push({ lineNumber, message });

  for (const { event, lineNumber } of records) {
    const { phase, requestId } = event;
    if (phase === 'late-callback-unknown-request') continue;

    let state = states.get(requestId);
    if (phase === 'requested') {
      if (state) {
        fail(lineNumber, 'requested must be the first ordinary event for a request');
      } else {
        state = initialLifecycleState(lineNumber);
        state.requested = true;
        states.set(requestId, state);
      }
      continue;
    }

    if (!state) {
      fail(lineNumber, `${phase} requires a requested admission`);
      continue;
    }

    if (phase === 'late-callback-after-timeout') {
      if (!state.timedOut) fail(lineNumber, 'late callback requires a prior timeout');
      continue;
    }

    if (TERMINAL_PHASES.has(phase) && state.terminalCount > 0) {
      fail(lineNumber, `duplicate terminal outcome after ${state.terminalPhase}`);
      continue;
    }

    switch (phase) {
      case 'accepted':
        if (state.rejected || state.accepted) {
          fail(lineNumber, 'acceptance requires an unrejected request with no prior acceptance');
        } else {
          state.accepted = true;
        }
        break;
      case 'rejected-duplicate':
        if (state.accepted || state.rejected) {
          fail(lineNumber, 'duplicate rejection requires an unaccepted request');
        } else {
          state.rejected = true;
        }
        break;
      case 'submitted-to-native-speech':
        if (!state.accepted) fail(lineNumber, 'submission requires acceptance');
        else if (state.terminalCount > 0) fail(lineNumber, 'submission cannot follow a terminal outcome');
        else state.submitted = true;
        break;
      case 'started':
        if (!state.submitted) fail(lineNumber, 'start requires submission');
        else if (state.terminalCount > 0) fail(lineNumber, 'start cannot follow a terminal outcome');
        else state.started = true;
        break;
      case 'completed':
      case 'cancelled':
        if (!state.submitted) fail(lineNumber, `${phase} requires submission`);
        else {
          state.terminalCount += 1;
          state.terminalPhase = phase;
        }
        break;
      case 'failed':
        if (!state.accepted) fail(lineNumber, 'failed requires acceptance');
        else {
          state.terminalCount += 1;
          state.terminalPhase = phase;
        }
        break;
      case 'ownership-timeout-awaiting-start':
        if (!state.submitted) fail(lineNumber, 'awaiting-start timeout requires submission');
        else if (state.started) fail(lineNumber, 'awaiting-start timeout cannot follow start');
        else {
          state.timedOut = true;
          state.terminalCount += 1;
          state.terminalPhase = phase;
        }
        break;
      case 'ownership-timeout-awaiting-terminal':
        if (!state.started) fail(lineNumber, 'awaiting-terminal timeout requires start');
        else {
          state.timedOut = true;
          state.terminalCount += 1;
          state.terminalPhase = phase;
        }
        break;
      default:
        fail(lineNumber, `unexpected lifecycle phase: ${phase}`);
    }
  }

  for (const state of states.values()) {
    if (state.accepted && state.terminalCount !== 1) {
      fail(state.admissionLineNumber, 'accepted request requires exactly one terminal outcome');
    }
    if (state.requested && !state.accepted && !state.rejected) {
      fail(state.admissionLineNumber, 'requested request must reach acceptance or rejection');
    }
  }
  return failures;
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
  const invalidLineNumbers = new Set();

  for (const record of records) {
    try {
      const event = parseDiagnosticRecord(record);
      try {
        validateEventSchema(event, record.lineNumber);
      } catch (error) {
        error.category = 'schema';
        throw error;
      }
      events.push({ event, lineNumber: record.lineNumber });
      parseSummary.parsedRecords += 1;
    } catch (error) {
      invalidLineNumbers.add(record.lineNumber);
      if (parseSummary.firstInvalidLineNumber === null) {
        parseSummary.firstInvalidLineNumber = record.lineNumber;
      }
      if (parseSummary.errors.length < MAX_REPRESENTATIVE_ERRORS) {
        parseSummary.errors.push({
          lineNumber: record.lineNumber,
          category: error.category ?? 'parse',
          message: error.message,
        });
      }
    }
  }

  const lifecycleFailures = validateLifecycle(events);
  parseSummary.lifecycleFailures.push(...lifecycleFailures);
  for (const failure of lifecycleFailures) invalidLineNumbers.add(failure.lineNumber);
  parseSummary.invalidRecords = invalidLineNumbers.size;
  parseSummary.parsedRecords -= [...invalidLineNumbers]
    .filter((lineNumber) => events.some((record) => record.lineNumber === lineNumber)).length;
  if (invalidLineNumbers.size > 0) {
    parseSummary.firstInvalidLineNumber = Math.min(...invalidLineNumbers);
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

  const eventValues = events.map(({ event }) => event);
  const phases = countPhases(eventValues);
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
    requestIds: collectRequestIds(eventValues),
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
  for (const failure of parseSummary.lifecycleFailures) {
    lines.push(`Line ${failure.lineNumber} (lifecycle): ${failure.message}`);
  }

  lines.push('='.repeat(60));
  return lines.join('\n');
}

module.exports = {
  analyzeValidationLog,
  formatValidationReport,
  scanDiagnosticRecords,
  parseDiagnosticRecord,
  validateEventSchema,
  validateLifecycle,
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
