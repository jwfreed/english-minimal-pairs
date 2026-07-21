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
