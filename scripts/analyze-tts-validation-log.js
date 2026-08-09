#!/usr/bin/env node
// Turns a raw device-validation capture into the Commit 1 validation metrics,
// and optionally into strict Task 4 native-lifecycle evidence and per-attempt
// latency once expo-speech generation rotation is a candidate for comparison.
//
// Usage:
//   npm run analyze:tts-log -- [--require-native-lifecycle] [--json] <captured-log-file>
//   npx expo start 2>&1 | tee /tmp/tts-validation.log   (capture first)
//
// --json report contract (schemaVersion 1), the stable shape consumed by
// scripts/compare-tts-lifecycle-validation.js:
//   {
//     schemaVersion: 1,
//     requireNativeLifecycle: boolean,        // whether --require-native-lifecycle was passed
//     captureStatus: 'EMPTY_CAPTURE' | 'INVALID_CAPTURE' | 'VALID',
//     validationPassed: boolean,
//     runtimeVerdict: string | null,
//     metrics: {                               // null unless captureStatus === 'VALID'
//       attempts, completed, cancelled, failed, rejectedDuplicates,
//       timeouts: { awaitingStart, awaitingTerminal, total },
//       lateCallbacks: { afterTimeout, unknownRequest, total },
//       requestIds: string[],
//     } | null,
//     latency: {                                // null unless captureStatus === 'VALID'
//       attempts, n, missingStarts, minMs, medianMs, p95Ms, maxMs,
//     } | null,
//     parseSummary: { linesInspected, diagnosticRecordsFound, parsedRecords,
//                      invalidRecords, firstInvalidLineNumber, errors, lifecycleFailures },
//     nativeParseSummary: <same shape as parseSummary> | null,  // null unless requireNativeLifecycle
//   }
// A schemaVersion bump is required for any breaking change to this shape.
const fs = require('fs');

const JSON_REPORT_SCHEMA_VERSION = 1;

const MARKER = '[tts-playback]';
const NATIVE_MARKER = '[tts-synthesizer-lifecycle]';
const NATIVE_CONTRACT = 'SOUNDWISE_EXPO_SPEECH_GENERATION_DRAIN_V1';
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
const NATIVE_PHASES = new Set([
  'creation',
  'submission',
  'terminal',
  'retirement',
  'invariantFailure',
]);
const TERMINAL_KINDS = new Set(['done', 'stopped']);
const TERMINAL_SOURCES = new Set([
  'delegateFinish',
  'delegateCancel',
  'explicitSuccessfulStop',
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
const ACTIVE_ORDINARY_PHASES = new Set([
  'requested',
  'accepted',
  'rejected-duplicate',
  'submitted-to-native-speech',
  'started',
]);
const RELEASED_ORDINARY_PHASES = new Set(['completed', 'cancelled', 'failed']);
const LEGACY_FIELD_PATTERN =
  /^([A-Za-z][A-Za-z0-9]*)\s*:\s*(?:'([^']*)'|(-?\d+(?:\.\d+)?)|(true|false|null))$/;

function scanDiagnosticRecords(logText, marker = MARKER) {
  const lines = logText.length === 0 ? [] : logText.split(/\r?\n/);
  const records = [];

  for (let index = 0; index < lines.length; index += 1) {
    const markerIndex = lines[index].indexOf(marker);
    if (markerIndex === -1) continue;

    const lineNumber = index + 1;
    const firstPayload = lines[index].slice(markerIndex + marker.length).trim();
    const payloadLines = [firstPayload];
    let incomplete = !firstPayload.endsWith('}');

    while (incomplete && index + 1 < lines.length) {
      if (lines[index + 1].includes(marker)) break;
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
  if (event.phase === 'started') {
    requireFiniteTimestamp(event, 'playbackStartedAtMs');
    if (event.playbackStartedAtMs < event.speechSubmittedAtMs) {
      throw new Error('playbackStartedAtMs must not precede speechSubmittedAtMs');
    }
  }
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

function validateNativeEventSchema(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error('native diagnostic payload must be an object');
  }
  if (event.contract !== NATIVE_CONTRACT) {
    throw new Error(`native diagnostic contract must be ${NATIVE_CONTRACT}`);
  }
  if (!NATIVE_PHASES.has(event.phase)) {
    throw new Error(`unknown native phase: ${String(event.phase)}`);
  }
  if (!Number.isInteger(event.generation) || event.generation < 0) {
    throw new Error('native generation must be a non-negative integer');
  }
  if (
    !Number.isInteger(event.trackedOutstandingUtterances) ||
    event.trackedOutstandingUtterances < 0
  ) {
    throw new Error('trackedOutstandingUtterances must be a non-negative integer');
  }
  requireFiniteTimestamp(event, 'timestampMs');

  const requiresUtteranceId = ['submission', 'terminal', 'retirement'].includes(event.phase);
  if (requiresUtteranceId) {
    if (typeof event.utteranceId !== 'string' || event.utteranceId.length === 0) {
      throw new Error(`${event.phase} must contain a non-empty utteranceId`);
    }
  } else if (event.phase === 'creation') {
    if (event.utteranceId !== null) {
      throw new Error('creation must not carry an utteranceId');
    }
  } else if (event.utteranceId !== null && typeof event.utteranceId !== 'string') {
    throw new Error('utteranceId must be a string or null');
  }

  const requiresTerminalFields = ['terminal', 'retirement'].includes(event.phase);
  if (requiresTerminalFields) {
    if (!TERMINAL_KINDS.has(event.terminalKind)) {
      throw new Error(`${event.phase} must contain a valid terminalKind`);
    }
    if (!TERMINAL_SOURCES.has(event.terminalSource)) {
      throw new Error(`${event.phase} must contain a valid terminalSource`);
    }
  } else if (['creation', 'submission'].includes(event.phase)) {
    if (event.terminalKind !== null || event.terminalSource !== null) {
      throw new Error(`${event.phase} must not carry terminal fields`);
    }
  } else {
    if (event.terminalKind !== null && !TERMINAL_KINDS.has(event.terminalKind)) {
      throw new Error('terminalKind must be a valid kind or null');
    }
    if (event.terminalSource !== null && !TERMINAL_SOURCES.has(event.terminalSource)) {
      throw new Error('terminalSource must be a valid source or null');
    }
  }

  if (event.phase === 'invariantFailure') {
    if (typeof event.anomaly !== 'string' || event.anomaly.length === 0) {
      throw new Error('invariantFailure must contain a non-empty anomaly');
    }
  } else if (event.anomaly !== null) {
    throw new Error(`${event.phase} must not carry an anomaly`);
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
  let activeOwnerRequestId = null;

  for (const { event, lineNumber } of records) {
    const { phase, requestId } = event;
    const ownershipCount = event.coordinatorObservedActivePlaybackOwnershipCount;

    if (ACTIVE_ORDINARY_PHASES.has(phase) && ownershipCount !== 1) {
      fail(lineNumber, `${phase} must report coordinator ownership count 1`);
    }
    if (RELEASED_ORDINARY_PHASES.has(phase) && ownershipCount !== 0) {
      fail(lineNumber, `${phase} must report coordinator ownership count 0`);
    }

    if (phase.startsWith('late-callback-')) {
      if (ownershipCount === 1) {
        if (
          activeOwnerRequestId === null ||
          activeOwnerRequestId === requestId ||
          event.activePlaybackOwnerRequestId !== activeOwnerRequestId
        ) {
          fail(lineNumber, 'late callback must identify the current newer active owner');
        }
      } else if (activeOwnerRequestId !== null) {
        fail(lineNumber, 'late callback ownership count 0 contradicts the current active owner');
      }
      if (phase === 'late-callback-unknown-request') continue;
    }

    let state = states.get(requestId);
    if (phase === 'requested') {
      if (state) {
        fail(lineNumber, 'requested must be the first ordinary event for a request');
      } else {
        state = initialLifecycleState(lineNumber);
        state.requested = true;
        states.set(requestId, state);
      }
      if (activeOwnerRequestId === null) activeOwnerRequestId = requestId;
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
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, `acceptance cannot replace active owner ${activeOwnerRequestId}`);
        }
        if (state.rejected || state.accepted) {
          fail(lineNumber, 'acceptance requires an unrejected request with no prior acceptance');
        } else {
          state.accepted = true;
        }
        break;
      case 'rejected-duplicate':
        if (
          activeOwnerRequestId === null ||
          activeOwnerRequestId === requestId ||
          event.activePlaybackOwnerRequestId !== activeOwnerRequestId
        ) {
          fail(lineNumber, 'rejected duplicate must identify the current active owner');
        }
        if (state.accepted || state.rejected) {
          fail(lineNumber, 'duplicate rejection requires an unaccepted request');
        } else {
          state.rejected = true;
        }
        if (activeOwnerRequestId === requestId) activeOwnerRequestId = null;
        break;
      case 'submitted-to-native-speech':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, 'submission requires this request to be the active owner');
        }
        if (!state.accepted) fail(lineNumber, 'submission requires acceptance');
        else if (state.terminalCount > 0) fail(lineNumber, 'submission cannot follow a terminal outcome');
        else if (state.started) fail(lineNumber, 'submission cannot follow start');
        else if (state.submitted) fail(lineNumber, 'duplicate submission');
        else state.submitted = true;
        break;
      case 'started':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, 'start requires this request to be the active owner');
        }
        if (!state.submitted) fail(lineNumber, 'start requires submission');
        else if (state.terminalCount > 0) fail(lineNumber, 'start cannot follow a terminal outcome');
        else if (state.started) fail(lineNumber, 'duplicate start');
        else state.started = true;
        break;
      case 'completed':
      case 'cancelled':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, `${phase} requires this request to be the active owner`);
        }
        if (!state.submitted) fail(lineNumber, `${phase} requires submission`);
        else {
          state.terminalCount += 1;
          state.terminalPhase = phase;
          if (activeOwnerRequestId === requestId) activeOwnerRequestId = null;
        }
        break;
      case 'failed':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, 'failed requires this request to be the active owner');
        }
        if (!state.accepted) fail(lineNumber, 'failed requires acceptance');
        else {
          state.terminalCount += 1;
          state.terminalPhase = phase;
          if (activeOwnerRequestId === requestId) activeOwnerRequestId = null;
        }
        break;
      case 'ownership-timeout-awaiting-start':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, 'awaiting-start timeout requires this request to be the active owner');
        }
        if (!state.submitted) fail(lineNumber, 'awaiting-start timeout requires submission');
        else if (state.started) fail(lineNumber, 'awaiting-start timeout cannot follow start');
        else {
          state.timedOut = true;
          state.terminalCount += 1;
          state.terminalPhase = phase;
          if (activeOwnerRequestId === requestId) activeOwnerRequestId = null;
        }
        break;
      case 'ownership-timeout-awaiting-terminal':
        if (activeOwnerRequestId !== requestId) {
          fail(lineNumber, 'awaiting-terminal timeout requires this request to be the active owner');
        }
        if (!state.started) fail(lineNumber, 'awaiting-terminal timeout requires start');
        else {
          state.timedOut = true;
          state.terminalCount += 1;
          state.terminalPhase = phase;
          if (activeOwnerRequestId === requestId) activeOwnerRequestId = null;
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

// Validates the native [tts-synthesizer-lifecycle] stream as evidence, not as
// a full port of SpeechGenerationLifecycle.swift's runtime accounting. Only
// 'submission' and 'retirement' phases affect this accounting: 'terminal'
// records are emitted for every delegate callback including suppressed
// duplicates (see SpeechModule.swift's handleTerminal), so only 'retirement'
// represents a trusted, publicly-delivered outcome.
function validateNativeLifecycle(nativeEvents) {
  const failures = [];
  const fail = (lineNumber, message) => failures.push({ lineNumber, message });

  const outstanding = new Set();
  const retired = new Set();
  const submissionLineNumberByUtteranceId = new Map();
  let lastGeneration = null;

  for (const { event, lineNumber } of nativeEvents) {
    const { phase, generation, utteranceId } = event;

    if (phase === 'invariantFailure') {
      fail(lineNumber, `native invariant failure reported: ${event.anomaly}`);
      continue;
    }

    if (phase === 'submission') {
      if (lastGeneration !== null) {
        if (generation > lastGeneration && outstanding.size > 0) {
          fail(
            lineNumber,
            `generation rotated to ${generation} while ${outstanding.size} utterance(s) remained outstanding`
          );
        } else if (generation < lastGeneration) {
          fail(lineNumber, `generation ${generation} regressed from ${lastGeneration}`);
        }
      }
      if (
        submissionLineNumberByUtteranceId.has(utteranceId) &&
        !retired.has(utteranceId)
      ) {
        fail(lineNumber, `duplicate submission for outstanding utterance ${utteranceId}`);
      }
      submissionLineNumberByUtteranceId.set(utteranceId, lineNumber);
      outstanding.add(utteranceId);
      lastGeneration = generation;
      continue;
    }

    if (phase === 'retirement') {
      if (!submissionLineNumberByUtteranceId.has(utteranceId)) {
        fail(lineNumber, `retirement for utterance ${utteranceId} with no prior submission`);
        continue;
      }
      if (retired.has(utteranceId)) {
        fail(lineNumber, `duplicate retirement for utterance ${utteranceId}`);
        continue;
      }
      retired.add(utteranceId);
      outstanding.delete(utteranceId);
      continue;
    }
  }

  for (const [utteranceId, lineNumber] of submissionLineNumberByUtteranceId) {
    if (!retired.has(utteranceId)) {
      fail(lineNumber, `utterance ${utteranceId} was submitted but never retired`);
    }
  }

  return failures;
}

function buildMetrics(events) {
  const count = (phase) => events.filter((event) => event.phase === phase).length;
  const accepted = count('accepted');
  const awaitingStart = count('ownership-timeout-awaiting-start');
  const awaitingTerminal = count('ownership-timeout-awaiting-terminal');
  const afterTimeout = count('late-callback-after-timeout');
  const unknownRequest = count('late-callback-unknown-request');

  return {
    attempts: accepted,
    completed: count('completed'),
    cancelled: count('cancelled'),
    failed: count('failed'),
    rejectedDuplicates: count('rejected-duplicate'),
    timeouts: {
      awaitingStart,
      awaitingTerminal,
      total: awaitingStart + awaitingTerminal,
    },
    lateCallbacks: {
      afterTimeout,
      unknownRequest,
      total: afterTimeout + unknownRequest,
    },
    requestIds: [...new Set(events.map((event) => event.requestId))],
  };
}

function nearestRankPercentile(sortedValues, percentile) {
  const n = sortedValues.length;
  const index = Math.ceil(percentile * n) - 1;
  return sortedValues[Math.min(Math.max(index, 0), n - 1)];
}

function buildLatencyMetrics(events, attempts) {
  const samples = events
    .filter((event) => event.phase === 'started')
    .map((event) => event.playbackStartedAtMs - event.speechSubmittedAtMs)
    .sort((a, b) => a - b);

  const n = samples.length;
  const missingStarts = Math.max(attempts - n, 0);

  if (n === 0) {
    return { attempts, n, missingStarts, minMs: null, medianMs: null, p95Ms: null, maxMs: null };
  }

  const medianMs =
    n % 2 === 1
      ? samples[(n - 1) / 2]
      : (samples[n / 2 - 1] + samples[n / 2]) / 2;

  return {
    attempts,
    n,
    missingStarts,
    minMs: samples[0],
    medianMs,
    p95Ms: nearestRankPercentile(samples, 0.95),
    maxMs: samples[n - 1],
  };
}

function parseMarkedRecords(logText, marker, { validateSchema, lifecycleValidator }) {
  const { linesInspected, records } = scanDiagnosticRecords(logText, marker);
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
        validateSchema(event, record.lineNumber);
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

  const lifecycleFailures = lifecycleValidator(events);
  parseSummary.lifecycleFailures.push(...lifecycleFailures);
  for (const failure of lifecycleFailures) invalidLineNumbers.add(failure.lineNumber);
  parseSummary.invalidRecords = invalidLineNumbers.size;
  parseSummary.parsedRecords -= [...invalidLineNumbers]
    .filter((lineNumber) => events.some((record) => record.lineNumber === lineNumber)).length;
  if (invalidLineNumbers.size > 0) {
    parseSummary.firstInvalidLineNumber = Math.min(...invalidLineNumbers);
  }

  return { parseSummary, events, records };
}

function analyzeValidationLog(logText, { requireNativeLifecycle = false } = {}) {
  const { parseSummary, events, records } = parseMarkedRecords(logText, MARKER, {
    validateSchema: validateEventSchema,
    lifecycleValidator: validateLifecycle,
  });

  let nativeParseSummary = null;
  let nativeInvalid = false;
  if (requireNativeLifecycle) {
    const nativeResult = parseMarkedRecords(logText, NATIVE_MARKER, {
      validateSchema: (event) => validateNativeEventSchema(event),
      lifecycleValidator: validateNativeLifecycle,
    });
    nativeParseSummary = nativeResult.parseSummary;
    nativeInvalid =
      nativeResult.records.length === 0 || nativeResult.parseSummary.invalidRecords > 0;
  }

  if (records.length === 0) {
    return {
      schemaVersion: JSON_REPORT_SCHEMA_VERSION,
      requireNativeLifecycle,
      captureStatus: 'EMPTY_CAPTURE',
      parseSummary,
      nativeParseSummary,
      metrics: null,
      latency: null,
      runtimeVerdict: null,
      validationPassed: false,
    };
  }

  if (parseSummary.invalidRecords > 0 || nativeInvalid) {
    return {
      schemaVersion: JSON_REPORT_SCHEMA_VERSION,
      requireNativeLifecycle,
      captureStatus: 'INVALID_CAPTURE',
      parseSummary,
      nativeParseSummary,
      metrics: null,
      latency: null,
      runtimeVerdict: null,
      validationPassed: false,
    };
  }

  const eventValues = events.map(({ event }) => event);
  const metrics = buildMetrics(eventValues);

  if (metrics.attempts === 0) {
    const lineNumber = records[0].lineNumber;
    parseSummary.errors.push({
      lineNumber,
      category: 'capture',
      message: 'marked diagnostics contain no accepted or submitted attempt denominator',
    });
    return {
      schemaVersion: JSON_REPORT_SCHEMA_VERSION,
      requireNativeLifecycle,
      captureStatus: 'INVALID_CAPTURE',
      parseSummary,
      nativeParseSummary,
      metrics: null,
      latency: null,
      runtimeVerdict: null,
      validationPassed: false,
    };
  }

  const runtimeVerdict = buildRuntimeVerdict(metrics);
  const latency = buildLatencyMetrics(eventValues, metrics.attempts);

  return {
    schemaVersion: JSON_REPORT_SCHEMA_VERSION,
    requireNativeLifecycle,
    captureStatus: 'VALID',
    parseSummary,
    nativeParseSummary,
    metrics,
    latency,
    runtimeVerdict,
    validationPassed: runtimeVerdict.startsWith('PROCEED'),
  };
}

function buildRuntimeVerdict(metrics) {
  if (metrics.timeouts.total > 0) {
    return `BLOCKED — ${metrics.timeouts.total} watchdog recovery/recoveries during normal use. Commit 2 is gated on zero. Investigate whether these are false positives (audio sounded fine) before adjusting timeout constants.`;
  }
  if (metrics.failed > 0) {
    return `REVIEW — no watchdog recoveries, but ${metrics.failed} native error callback(s). Explain these before proceeding.`;
  }
  if (metrics.lateCallbacks.total > 0) {
    return `REVIEW — no watchdog recoveries, but ${metrics.lateCallbacks.total} unexplained late callback(s). Explain these before proceeding.`;
  }
  if (metrics.attempts < 30) {
    return `INCONCLUSIVE — only ${metrics.attempts} attempt(s) captured. Collect at least 30 across cold launch, post-resume, rapid replay, and normal intervals.`;
  }
  return `PROCEED — ${metrics.attempts} attempts, zero watchdog recoveries, zero late callbacks. Commit 1 shows no regression; Commit 2 may begin.`;
}

function formatValidationReport(report) {
  if (report.captureStatus !== 'VALID') {
    return formatEvidenceReport(report);
  }

  const { metrics, latency } = report;
  const lines = [
    'TTS Commit 1 device validation',
    '='.repeat(60),
    ...formatEvidenceSummary(report.parseSummary, report.captureStatus),
    ...formatNativeEvidenceSummary(report),
    '',
    `Total playback attempts        ${metrics.attempts}`,
    `  completed                    ${metrics.completed}`,
    `  cancelled                    ${metrics.cancelled}`,
    `  failed (native error)        ${metrics.failed}`,
    `  rejected as duplicate        ${metrics.rejectedDuplicates}`,
    `Distinct requests seen         ${metrics.requestIds.length}`,
    '',
    `Watchdog timeouts              ${metrics.timeouts.total}`,
    `  awaiting-start               ${metrics.timeouts.awaitingStart}`,
    `  awaiting-terminal            ${metrics.timeouts.awaitingTerminal}`,
    '',
    `Late callbacks                 ${metrics.lateCallbacks.total}`,
    `  after-timeout                ${metrics.lateCallbacks.afterTimeout}`,
    `  unknown-request              ${metrics.lateCallbacks.unknownRequest}`,
    '',
    `Latency samples (n / attempts) ${latency.n} / ${latency.attempts}`,
    `  missing starts                ${latency.missingStarts}`,
    `  min                           ${latency.minMs ?? 'n/a'}ms`,
    `  median                        ${latency.medianMs ?? 'n/a'}ms`,
    `  p95                           ${latency.p95Ms ?? 'n/a'}ms`,
    `  max                           ${latency.maxMs ?? 'n/a'}ms`,
    '='.repeat(60),
    `Runtime verdict: ${report.runtimeVerdict}`,
  ];
  return lines.join('\n');
}

function formatEvidenceSummary(parseSummary, captureStatus) {
  return [
    `Capture classification         ${captureStatus}`,
    `Lines inspected                ${parseSummary.linesInspected}`,
    `Diagnostic records found       ${parseSummary.diagnosticRecordsFound}`,
    `Parsed records                 ${parseSummary.parsedRecords}`,
    `Invalid records                ${parseSummary.invalidRecords}`,
    `First invalid line             ${parseSummary.firstInvalidLineNumber ?? 'none'}`,
  ];
}

function formatNativeEvidenceSummary(report) {
  if (!report.requireNativeLifecycle) return [];
  const summary = report.nativeParseSummary;
  return [
    `Native lifecycle required      yes`,
    `Native records found           ${summary?.diagnosticRecordsFound ?? 0}`,
    `Native invalid records         ${summary?.invalidRecords ?? 0}`,
  ];
}

function formatEvidenceReport({ captureStatus, parseSummary, nativeParseSummary, requireNativeLifecycle }) {
  const lines = [
    'TTS Commit 1 device validation',
    '='.repeat(60),
    ...formatEvidenceSummary(parseSummary, captureStatus),
    ...formatNativeEvidenceSummary({ requireNativeLifecycle, nativeParseSummary }),
  ];

  const diagnostics = [
    ...parseSummary.errors,
    ...parseSummary.lifecycleFailures.map((failure) => ({
      ...failure,
      category: 'lifecycle',
    })),
    ...(nativeParseSummary?.errors ?? []).map((error) => ({
      ...error,
      category: `native-${error.category}`,
    })),
    ...(nativeParseSummary?.lifecycleFailures ?? []).map((failure) => ({
      ...failure,
      category: 'native-lifecycle',
    })),
  ];
  const representativeDiagnostics = diagnostics.slice(0, MAX_REPRESENTATIVE_ERRORS);
  for (const diagnostic of representativeDiagnostics) {
    lines.push(`Line ${diagnostic.lineNumber} (${diagnostic.category}): ${diagnostic.message}`);
  }

  const representedLineNumbers = new Set(
    representativeDiagnostics.map((diagnostic) => diagnostic.lineNumber)
  );
  const totalInvalid =
    parseSummary.invalidRecords + (nativeParseSummary?.invalidRecords ?? 0);
  const additionalDiagnostics = Math.max(
    diagnostics.length - representativeDiagnostics.length,
    totalInvalid - representedLineNumbers.size,
    0
  );
  if (additionalDiagnostics > 0) {
    lines.push(
      `... ${additionalDiagnostics} additional diagnostics not shown (representative limit: ${MAX_REPRESENTATIVE_ERRORS})`
    );
  }

  lines.push('Playback metrics             WITHHELD — capture evidence is not trustworthy');
  lines.push('Runtime verdict              WITHHELD');
  lines.push('='.repeat(60));
  return lines.join('\n');
}

function exitCodeForReport(report) {
  return report.validationPassed ? 0 : 1;
}

module.exports = {
  analyzeValidationLog,
  exitCodeForReport,
  formatValidationReport,
  scanDiagnosticRecords,
  parseDiagnosticRecord,
  validateEventSchema,
  validateLifecycle,
  validateNativeEventSchema,
  validateNativeLifecycle,
  JSON_REPORT_SCHEMA_VERSION,
};

function parseCliArgs(argv) {
  const args = { requireNativeLifecycle: false, json: false, logPath: null };
  for (const arg of argv) {
    if (arg === '--require-native-lifecycle') {
      args.requireNativeLifecycle = true;
    } else if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    } else if (args.logPath === null) {
      args.logPath = arg;
    } else {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
  }
  return args;
}

if (require.main === module) {
  let args;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(
      'Usage: node scripts/analyze-tts-validation-log.js [--require-native-lifecycle] [--json] <log-file>'
    );
    process.exit(2);
  }
  if (!args.logPath) {
    console.error(
      'Usage: node scripts/analyze-tts-validation-log.js [--require-native-lifecycle] [--json] <log-file>'
    );
    process.exit(2);
  }
  const report = analyzeValidationLog(fs.readFileSync(args.logPath, 'utf8'), {
    requireNativeLifecycle: args.requireNativeLifecycle,
  });
  console.log(args.json ? JSON.stringify(report, null, 2) : formatValidationReport(report));
  process.exit(exitCodeForReport(report));
}
