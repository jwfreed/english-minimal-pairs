const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  MAX_ACTIVE_PLAYBACK_OWNERSHIP,
  SpeechPlaybackCoordinator,
} = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'speechPlaybackCoordinator.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

/**
 * Deterministic stand-in for the host timer API. `scripts/run-tests.js` is a
 * bare Node runner with no Jest and therefore no fake timers, so the
 * coordinator takes its scheduler by injection and these tests drive expiry
 * directly instead of sleeping.
 */
function createFakeScheduler(startingNowMs = 1000) {
  let nextTimerId = 1;
  let nowMs = startingNowMs;
  const timers = new Map();

  return {
    scheduler: {
      setTimeout(callback, delayMs) {
        const timerId = nextTimerId++;
        timers.set(timerId, { callback, delayMs });
        return timerId;
      },
      clearTimeout(timerId) {
        timers.delete(timerId);
      },
      now() {
        return nowMs;
      },
    },
    advanceTo(nextNowMs) {
      nowMs = nextNowMs;
    },
    pendingCount() {
      return timers.size;
    },
    pendingDelays() {
      return [...timers.values()].map((timer) => timer.delayMs);
    },
    expireAll() {
      const pending = [...timers.entries()];
      timers.clear();
      for (const [, timer] of pending) {
        timer.callback();
      }
      return pending.length;
    },
  };
}

const BUDGETS = { startBudgetMs: 4000, completionBudgetMs: 3000 };

function beginWithBudgets(coordinator, overrides = {}) {
  return coordinator.begin({
    word: 'oath',
    difficulty: 1,
    nowMs: 100,
    ...BUDGETS,
    ...overrides,
  });
}

function createOwnershipObserver(coordinator) {
  let maximumObservedActivePlaybackOwnership = 0;

  return {
    observe(label) {
      const activePlaybackOwnership =
        coordinator.getActivePlaybackOwnershipCount();
      maximumObservedActivePlaybackOwnership = Math.max(
        maximumObservedActivePlaybackOwnership,
        activePlaybackOwnership
      );
      assert.ok(
        activePlaybackOwnership <= MAX_ACTIVE_PLAYBACK_OWNERSHIP,
        `${label}: active playback ownership was ${activePlaybackOwnership}`
      );
    },
    getMaximum() {
      return maximumObservedActivePlaybackOwnership;
    },
  };
}

runTest('an active request rejects a concurrent request before native submission', () => {
  const coordinator = new SpeechPlaybackCoordinator();
  const ownership = createOwnershipObserver(coordinator);
  let acceptedRequestCount = 0;
  let nativeSpeechSubmissionCount = 0;

  const first = coordinator.begin({ word: 'right', difficulty: 1, nowMs: 100 });
  assert.strictEqual(first.accepted, true);
  acceptedRequestCount += 1;
  ownership.observe('after request A was accepted');

  assert.ok(coordinator.submitSpeech(first.attempt.requestId, 110));
  nativeSpeechSubmissionCount += 1;
  assert.ok(coordinator.start(first.attempt.requestId, 120));
  ownership.observe('after request A started');

  const second = coordinator.begin({ word: 'light', difficulty: 1, nowMs: 130 });
  if (second.accepted) {
    acceptedRequestCount += 1;
    if (coordinator.submitSpeech(second.attempt.requestId, 140)) {
      nativeSpeechSubmissionCount += 1;
    }
  }
  ownership.observe('after request B attempted to start');

  assert.strictEqual(second.accepted, false);
  assert.notStrictEqual(second.request.requestId, first.attempt.requestId);
  assert.strictEqual(second.request.word, 'light');
  assert.strictEqual(second.activeAttempt.requestId, first.attempt.requestId);
  assert.strictEqual(acceptedRequestCount, 1);
  assert.strictEqual(nativeSpeechSubmissionCount, 1);
  assert.strictEqual(acceptedRequestCount, nativeSpeechSubmissionCount);
  assert.strictEqual(ownership.getMaximum(), 1);
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 1);
  assert.strictEqual(
    coordinator.getActivePlaybackOwnerRequestId(),
    first.attempt.requestId
  );
});

runTest('one request records exactly one submit, start, and finish lifecycle', () => {
  const coordinator = new SpeechPlaybackCoordinator();
  const result = coordinator.begin({ word: 'light', difficulty: 1, nowMs: 100 });
  assert.strictEqual(result.accepted, true);
  const requestId = result.attempt.requestId;

  coordinator.selectVoice(requestId, 'voice-1');
  const submitted = coordinator.submitSpeech(requestId, 110);
  const started = coordinator.start(requestId, 120);
  const finished = coordinator.finish(requestId, 200);

  assert.strictEqual(submitted.speechSubmittedAtMs, 110);
  assert.strictEqual(started.playbackStartedAtMs, 120);
  assert.strictEqual(finished.playbackFinishedAtMs, 200);
  assert.strictEqual(finished.voiceIdentifier, 'voice-1');
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(coordinator.getActivePlaybackOwnerRequestId(), null);
});

runTest('late callbacks from cancelled request A cannot clear active request B', () => {
  const coordinator = new SpeechPlaybackCoordinator();
  const ownership = createOwnershipObserver(coordinator);
  let acceptedRequestCount = 0;
  let nativeSpeechSubmissionCount = 0;

  const first = coordinator.begin({ word: 'three', difficulty: 2, nowMs: 100 });
  assert.strictEqual(first.accepted, true);
  acceptedRequestCount += 1;
  const firstId = first.attempt.requestId;
  assert.ok(coordinator.submitSpeech(firstId, 110));
  nativeSpeechSubmissionCount += 1;
  assert.ok(coordinator.start(firstId, 120));
  ownership.observe('after request A started');
  assert.strictEqual(coordinator.cancel(firstId, 130).cancellationAtMs, 130);
  ownership.observe('after request A was cancelled');

  const second = coordinator.begin({ word: 'cat', difficulty: 1, nowMs: 200 });
  assert.strictEqual(second.accepted, true);
  acceptedRequestCount += 1;
  const secondId = second.attempt.requestId;
  assert.ok(coordinator.submitSpeech(secondId, 210));
  nativeSpeechSubmissionCount += 1;
  assert.ok(coordinator.start(secondId, 220));
  ownership.observe('after request B started');

  assert.strictEqual(coordinator.finish(firstId, 230), null);
  ownership.observe('after request A late completion callback');
  assert.strictEqual(coordinator.cancel(firstId, 240), null);
  ownership.observe('after request A late cancellation callback');

  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 1);
  assert.strictEqual(coordinator.getActivePlaybackOwnerRequestId(), secondId);
  assert.strictEqual(acceptedRequestCount, 2);
  assert.strictEqual(nativeSpeechSubmissionCount, 2);
  assert.strictEqual(acceptedRequestCount, nativeSpeechSubmissionCount);

  assert.strictEqual(coordinator.finish(secondId, 300).playbackFinishedAtMs, 300);
  ownership.observe('after request B completed');
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(coordinator.getActivePlaybackOwnerRequestId(), null);
  assert.strictEqual(ownership.getMaximum(), 1);
});

runTest('cancellation and failure both release the coordinator', () => {
  const coordinator = new SpeechPlaybackCoordinator();
  const first = coordinator.begin({ word: 'right', difficulty: 1, nowMs: 100 });
  assert.strictEqual(coordinator.cancel(first.attempt.requestId, 110).cancellationAtMs, 110);

  const second = coordinator.begin({ word: 'light', difficulty: 1, nowMs: 120 });
  assert.strictEqual(coordinator.fail(second.attempt.requestId, 130).failureAtMs, 130);
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
});

// -----------------------------------------------------------------------------
// Ownership timeout recovery.
//
// Without these, a lost native terminal callback leaves activeAttempt set
// forever: every later press is rejected as a duplicate, isSpeaking stays true,
// and TTS is dead for the rest of the process with no user-visible error.
// -----------------------------------------------------------------------------

runTest('ownership is released when native never reports a start', () => {
  const { scheduler, expireAll, advanceTo } = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler });
  const timeouts = [];
  coordinator.subscribeToOwnershipTimeout((attempt) => timeouts.push(attempt));

  const begun = beginWithBudgets(coordinator);
  coordinator.submitSpeech(begun.attempt.requestId, 110);
  advanceTo(4110);
  expireAll();

  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(coordinator.getActivePlaybackOwnerRequestId(), null);
  assert.strictEqual(timeouts.length, 1);
  assert.strictEqual(timeouts[0].requestId, begun.attempt.requestId);
  assert.strictEqual(timeouts[0].timedOutPhase, 'awaiting-start');
  assert.strictEqual(timeouts[0].timedOutAtMs, 4110);
  assert.strictEqual(timeouts[0].playbackStartedAtMs, null);
});

runTest('ownership is released when native starts but never reports a terminal callback', () => {
  const { scheduler, expireAll, advanceTo } = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler });
  const timeouts = [];
  coordinator.subscribeToOwnershipTimeout((attempt) => timeouts.push(attempt));

  const begun = beginWithBudgets(coordinator);
  coordinator.submitSpeech(begun.attempt.requestId, 110);
  coordinator.start(begun.attempt.requestId, 120);
  advanceTo(3120);
  expireAll();

  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(timeouts.length, 1);
  assert.strictEqual(timeouts[0].timedOutPhase, 'awaiting-terminal');
  assert.strictEqual(timeouts[0].playbackStartedAtMs, 120);
});

runTest('a terminal callback arriving after a timeout is ignored and classified', () => {
  const { scheduler, expireAll } = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler });

  const begun = beginWithBudgets(coordinator);
  const requestId = begun.attempt.requestId;
  coordinator.submitSpeech(requestId, 110);
  coordinator.start(requestId, 120);
  expireAll();

  assert.strictEqual(coordinator.finish(requestId, 5000), null);
  assert.strictEqual(coordinator.cancel(requestId, 5010), null);
  assert.strictEqual(coordinator.fail(requestId, 5020), null);
  assert.strictEqual(
    coordinator.classifyStaleCallback(requestId),
    'after-timeout'
  );
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
});

runTest('a late callback after a newer request begins cannot release the newer request', () => {
  const { scheduler, expireAll } = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler });
  const ownership = createOwnershipObserver(coordinator);

  const first = beginWithBudgets(coordinator, { word: 'right' });
  const firstId = first.attempt.requestId;
  coordinator.submitSpeech(firstId, 110);
  coordinator.start(firstId, 120);
  expireAll();
  ownership.observe('after request A timed out');

  const second = beginWithBudgets(coordinator, { word: 'light', nowMs: 6000 });
  assert.strictEqual(second.accepted, true);
  const secondId = second.attempt.requestId;
  coordinator.submitSpeech(secondId, 6010);
  coordinator.start(secondId, 6020);
  ownership.observe('after request B started');

  assert.strictEqual(coordinator.finish(firstId, 6030), null);
  assert.strictEqual(
    coordinator.classifyStaleCallback(firstId),
    'after-timeout'
  );
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 1);
  assert.strictEqual(coordinator.getActivePlaybackOwnerRequestId(), secondId);

  assert.strictEqual(coordinator.finish(secondId, 6100).playbackFinishedAtMs, 6100);
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(ownership.getMaximum(), 1);
});

runTest('a callback for a request the coordinator never owned is classified as unknown', () => {
  const coordinator = new SpeechPlaybackCoordinator();

  assert.strictEqual(
    coordinator.classifyStaleCallback('tts-never-existed-1'),
    'unknown-request'
  );
});

runTest('the injected scheduler owns every timer the coordinator arms and cancels', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });

  const begun = beginWithBudgets(coordinator);
  const requestId = begun.attempt.requestId;
  assert.strictEqual(
    fake.pendingCount(),
    0,
    'admission alone must not arm a timer; nothing has been submitted to native speech yet'
  );

  coordinator.submitSpeech(requestId, 110);
  assert.deepStrictEqual(fake.pendingDelays(), [BUDGETS.startBudgetMs]);

  coordinator.start(requestId, 120);
  assert.deepStrictEqual(
    fake.pendingDelays(),
    [BUDGETS.completionBudgetMs],
    'the start budget must be replaced by the completion budget, not added to it'
  );

  coordinator.finish(requestId, 200);
  assert.strictEqual(
    fake.pendingCount(),
    0,
    'a normal terminal callback must leave no timer armed'
  );
});

runTest('the injected scheduler is used for timeout timestamps rather than the wall clock', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });
  const timeouts = [];
  coordinator.subscribeToOwnershipTimeout((attempt) => timeouts.push(attempt));

  const begun = beginWithBudgets(coordinator);
  coordinator.submitSpeech(begun.attempt.requestId, 110);
  fake.advanceTo(987654);
  fake.expireAll();

  assert.strictEqual(timeouts[0].timedOutAtMs, 987654);
});

runTest('cancellation and failure also disarm the timeout', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });

  const first = beginWithBudgets(coordinator);
  coordinator.submitSpeech(first.attempt.requestId, 110);
  coordinator.cancel(first.attempt.requestId, 120);
  assert.strictEqual(fake.pendingCount(), 0);

  const second = beginWithBudgets(coordinator, { nowMs: 200 });
  coordinator.submitSpeech(second.attempt.requestId, 210);
  coordinator.fail(second.attempt.requestId, 220);
  assert.strictEqual(fake.pendingCount(), 0);
});

runTest('the timed-out request ring stays bounded and evicts the oldest entry', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });
  const timedOutIds = [];

  for (let index = 0; index < 9; index += 1) {
    const begun = beginWithBudgets(coordinator, { nowMs: 1000 + index });
    timedOutIds.push(begun.attempt.requestId);
    coordinator.submitSpeech(begun.attempt.requestId, 1000 + index);
    fake.expireAll();
  }

  assert.strictEqual(
    coordinator.classifyStaleCallback(timedOutIds[0]),
    'unknown-request',
    'the oldest of nine timed-out requests must have been evicted from the ring of 8'
  );
  for (const requestId of timedOutIds.slice(1)) {
    assert.strictEqual(
      coordinator.classifyStaleCallback(requestId),
      'after-timeout'
    );
  }
});

runTest('a throwing timeout subscriber never prevents ownership release', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });
  const survivingNotifications = [];
  coordinator.subscribeToOwnershipTimeout(() => {
    throw new Error('subscriber exploded');
  });
  coordinator.subscribeToOwnershipTimeout((attempt) =>
    survivingNotifications.push(attempt)
  );

  const begun = beginWithBudgets(coordinator);
  coordinator.submitSpeech(begun.attempt.requestId, 110);

  assert.doesNotThrow(() => fake.expireAll());
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
  assert.strictEqual(
    survivingNotifications.length,
    1,
    'one throwing subscriber must not suppress the others'
  );
});

runTest('unsubscribing stops notifications but leaves the safety timeout armed', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });
  const timeouts = [];
  const unsubscribe = coordinator.subscribeToOwnershipTimeout((attempt) =>
    timeouts.push(attempt)
  );

  const begun = beginWithBudgets(coordinator);
  coordinator.submitSpeech(begun.attempt.requestId, 110);
  unsubscribe();
  fake.expireAll();

  assert.strictEqual(timeouts.length, 0);
  assert.strictEqual(
    coordinator.getActivePlaybackOwnershipCount(),
    0,
    'a remount between submit and timeout must not resurrect the permanent-lock bug'
  );
});

runTest('a timed-out request frees the coordinator for the next press', () => {
  const fake = createFakeScheduler();
  const coordinator = new SpeechPlaybackCoordinator({ scheduler: fake.scheduler });

  const first = beginWithBudgets(coordinator);
  coordinator.submitSpeech(first.attempt.requestId, 110);
  fake.expireAll();

  const second = beginWithBudgets(coordinator, { nowMs: 9000 });
  assert.strictEqual(
    second.accepted,
    true,
    'the press after a timeout must be accepted rather than rejected as a duplicate'
  );
});

runTest('a coordinator constructed without a scheduler still admits and releases requests', () => {
  const coordinator = new SpeechPlaybackCoordinator();
  const begun = beginWithBudgets(coordinator);

  assert.strictEqual(begun.accepted, true);
  coordinator.submitSpeech(begun.attempt.requestId, 110);
  coordinator.start(begun.attempt.requestId, 120);
  assert.strictEqual(coordinator.finish(begun.attempt.requestId, 200).playbackFinishedAtMs, 200);
  assert.strictEqual(coordinator.getActivePlaybackOwnershipCount(), 0);
});
