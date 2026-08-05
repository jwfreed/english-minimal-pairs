#!/usr/bin/env node
// Turns a raw device-validation capture into the Commit 1 validation metrics.
//
// Usage:
//   npm run analyze:tts-log -- <captured-log-file>
//   npx expo start 2>&1 | tee /tmp/tts-validation.log   (capture first)
//
// Metro prints console objects across multiple lines with unquoted keys, so
// this scans for phase tokens rather than attempting to parse JSON. That is
// deliberately tolerant: the capture is a human-collected artifact and its
// exact formatting varies between Metro, Xcode, and Console.app.
const fs = require('fs');

// `[^A-Za-z]` guards against matching `timedOutPhase:`, which would otherwise
// double-count every timeout event.
const PHASE_PATTERN = /(?:^|[^A-Za-z])phase:\s*'([a-z-]+)'/g;
const REQUEST_ID_PATTERN = /requestId:\s*'([^']+)'/g;

function countPhases(logText) {
  const counts = new Map();
  for (const match of logText.matchAll(PHASE_PATTERN)) {
    const phase = match[1];
    counts.set(phase, (counts.get(phase) ?? 0) + 1);
  }
  return counts;
}

function collectRequestIds(logText) {
  const seen = [];
  for (const match of logText.matchAll(REQUEST_ID_PATTERN)) {
    if (!seen.includes(match[1])) seen.push(match[1]);
  }
  return seen;
}

function analyzeValidationLog(logText) {
  const phases = countPhases(logText);
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
    requestIds: collectRequestIds(logText),
    clean,
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

module.exports = { analyzeValidationLog, formatValidationReport };

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
