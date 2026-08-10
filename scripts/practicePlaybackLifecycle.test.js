const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const lifecycle = loadTsModule(
  path.join(
    __dirname,
    '..',
    'src',
    'domain',
    'practice',
    'practicePlaybackLifecycle.ts'
  )
);

const plain = (value) => JSON.parse(JSON.stringify(value));
const prompt = {
  pairId: 'rL:rock:lock',
  playedIdx: 0,
  startedAtMs: 1000,
};

function request(state, attemptId = 1, submission = 'submitted') {
  return lifecycle.reducePracticePlayback(state, {
    kind: 'playback-requested',
    attempt: { attemptId, prompt },
    submission,
  });
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('initial state has no prompt and cannot answer', () => {
  const state = lifecycle.initialPracticePlaybackState();
  assert.deepStrictEqual(plain(state), { status: 'idle' });
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);
  assert.strictEqual(lifecycle.isPracticePlaybackActive(state), false);
});

runTest('loading blocks answers before and after render submission', () => {
  let state = request(
    lifecycle.initialPracticePlaybackState(),
    1,
    'awaiting-render'
  );
  assert.strictEqual(state.status, 'loading');
  assert.strictEqual(state.submission, 'awaiting-render');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);
  assert.strictEqual(lifecycle.isPracticePlaybackActive(state), true);

  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-submitted',
    attemptId: 1,
  });
  assert.strictEqual(state.status, 'loading');
  assert.strictEqual(state.submission, 'submitted');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);
});

runTest('playing blocks answers', () => {
  let state = request(lifecycle.initialPracticePlaybackState());
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-started',
    attemptId: 1,
  });
  assert.strictEqual(state.status, 'playing');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);
  assert.strictEqual(lifecycle.isPracticePlaybackActive(state), true);
});

runTest('successful completion is the only playback event that enables answering', () => {
  let state = request(lifecycle.initialPracticePlaybackState());
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-completed',
    attemptId: 1,
  });
  assert.strictEqual(state.status, 'awaiting-answer');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), true);
  assert.strictEqual(lifecycle.isPracticePlaybackActive(state), false);
});

runTest('completion after a reported start also enables answering', () => {
  let state = request(lifecycle.initialPracticePlaybackState());
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-started',
    attemptId: 1,
  });
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-completed',
    attemptId: 1,
  });
  assert.strictEqual(state.status, 'awaiting-answer');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), true);
});

runTest('accepted answer completes the prompt and blocks duplicate answers', () => {
  let state = request(lifecycle.initialPracticePlaybackState());
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-completed',
    attemptId: 1,
  });
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'answer-accepted',
    attemptId: 1,
  });
  assert.strictEqual(state.status, 'completed');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);
});

runTest('failed playback blocks answers and a new attempt provides retry recovery', () => {
  let state = request(lifecycle.initialPracticePlaybackState());
  state = lifecycle.reducePracticePlayback(state, {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'playback-error',
  });
  assert.strictEqual(state.status, 'failed');
  assert.strictEqual(state.reason, 'playback-error');
  assert.strictEqual(lifecycle.canAnswerPracticePrompt(state), false);

  state = request(state, 2);
  assert.strictEqual(state.status, 'loading');
  assert.strictEqual(state.attempt.attemptId, 2);
});

runTest('submitted loading and playing attempts both accept transport failure', () => {
  const loading = request(lifecycle.initialPracticePlaybackState());
  const failedWhileLoading = lifecycle.reducePracticePlayback(loading, {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'request-rejected',
  });
  assert.strictEqual(failedWhileLoading.status, 'failed');
  assert.strictEqual(failedWhileLoading.reason, 'request-rejected');

  const playing = lifecycle.reducePracticePlayback(loading, {
    kind: 'playback-started',
    attemptId: 1,
  });
  const failedWhilePlaying = lifecycle.reducePracticePlayback(playing, {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'completion-timeout',
  });
  assert.strictEqual(failedWhilePlaying.status, 'failed');
  assert.strictEqual(failedWhilePlaying.reason, 'completion-timeout');
});

runTest('idle, awaiting-answer, completed, and failed states accept a newer request', () => {
  const idle = lifecycle.initialPracticePlaybackState();
  const awaitingAnswer = lifecycle.reducePracticePlayback(request(idle), {
    kind: 'playback-completed',
    attemptId: 1,
  });
  const completed = lifecycle.reducePracticePlayback(awaitingAnswer, {
    kind: 'answer-accepted',
    attemptId: 1,
  });
  const failed = lifecycle.reducePracticePlayback(request(idle), {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'playback-error',
  });

  for (const source of [idle, awaitingAnswer, completed, failed]) {
    const next = request(source, 2);
    assert.strictEqual(next.status, 'loading');
    assert.strictEqual(next.attempt.attemptId, 2);
  }
});

runTest('retry and replay requests must advance the attempt id', () => {
  let failed = request(lifecycle.initialPracticePlaybackState(), 2);
  failed = lifecycle.reducePracticePlayback(failed, {
    kind: 'playback-failed',
    attemptId: 2,
    reason: 'playback-error',
  });

  for (const staleAttemptId of [1, 2]) {
    assert.strictEqual(
      request(failed, staleAttemptId),
      failed,
      `attempt ${staleAttemptId} must not replace attempt 2`
    );
  }
  assert.strictEqual(request(failed, 3).attempt.attemptId, 3);
});

runTest('deferred mismatch fails only when the hook identifies the prompt as unavailable', () => {
  const loading = request(
    lifecycle.initialPracticePlaybackState(),
    1,
    'awaiting-render'
  );
  const failed = lifecycle.reducePracticePlayback(loading, {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'deferred-prompt-mismatch',
  });
  assert.strictEqual(failed.status, 'failed');
  assert.strictEqual(failed.reason, 'deferred-prompt-mismatch');
});

runTest('a rendered mismatch is transient while the requested prompt remains eligible', () => {
  assert.strictEqual(
    lifecycle.classifyDeferredPromptRender({
      requestedPairId: 'rL:rock:lock',
      renderedPairId: 'rL:rake:lake',
      eligiblePairIds: ['rL:rake:lake', 'rL:rock:lock'],
    }),
    'transient-mismatch'
  );
});

runTest('a rendered mismatch is stale only after the requested prompt leaves eligibility', () => {
  assert.strictEqual(
    lifecycle.classifyDeferredPromptRender({
      requestedPairId: 'rL:rock:lock',
      renderedPairId: 'rL:rake:lake',
      eligiblePairIds: ['rL:rake:lake'],
    }),
    'stale-mismatch'
  );
  assert.strictEqual(
    lifecycle.classifyDeferredPromptRender({
      requestedPairId: 'rL:rock:lock',
      renderedPairId: 'rL:rock:lock',
      eligiblePairIds: ['rL:rock:lock'],
    }),
    'ready'
  );
});

runTest('events from older attempts cannot affect the current prompt', () => {
  const current = request(lifecycle.initialPracticePlaybackState(), 2);
  for (const event of [
    { kind: 'playback-started', attemptId: 1 },
    { kind: 'playback-completed', attemptId: 1 },
    { kind: 'playback-failed', attemptId: 1, reason: 'completion-timeout' },
  ]) {
    assert.strictEqual(
      lifecycle.reducePracticePlayback(current, event),
      current,
      `${event.kind} from a stale attempt must be ignored`
    );
  }
});

runTest('invalid transitions are ignored without manufacturing state', () => {
  const idle = lifecycle.initialPracticePlaybackState();
  assert.strictEqual(
    lifecycle.reducePracticePlayback(idle, {
      kind: 'playback-completed',
      attemptId: 1,
    }),
    idle
  );

  const awaitingAnswer = lifecycle.reducePracticePlayback(
    request(idle),
    { kind: 'playback-completed', attemptId: 1 }
  );
  assert.strictEqual(
    lifecycle.reducePracticePlayback(awaitingAnswer, {
      kind: 'playback-started',
      attemptId: 1,
    }),
    awaitingAnswer
  );

  const awaitingRender = request(idle, 1, 'awaiting-render');
  assert.strictEqual(
    request(awaitingRender, 2),
    awaitingRender,
    'a second request must not replace an active loading attempt'
  );
  for (const event of [
    { kind: 'playback-started', attemptId: 1 },
    { kind: 'playback-completed', attemptId: 1 },
    { kind: 'playback-failed', attemptId: 1, reason: 'playback-error' },
    { kind: 'answer-accepted', attemptId: 1 },
  ]) {
    assert.strictEqual(
      lifecycle.reducePracticePlayback(awaitingRender, event),
      awaitingRender,
      `${event.kind} must not bypass deferred render readiness`
    );
  }

  const playing = lifecycle.reducePracticePlayback(request(idle), {
    kind: 'playback-started',
    attemptId: 1,
  });
  assert.strictEqual(request(playing, 2), playing);
});

runTest('duplicate terminal events are ignored', () => {
  const awaitingAnswer = lifecycle.reducePracticePlayback(
    request(lifecycle.initialPracticePlaybackState()),
    { kind: 'playback-completed', attemptId: 1 }
  );
  assert.strictEqual(
    lifecycle.reducePracticePlayback(awaitingAnswer, {
      kind: 'playback-completed',
      attemptId: 1,
    }),
    awaitingAnswer
  );

  const failed = lifecycle.reducePracticePlayback(
    request(lifecycle.initialPracticePlaybackState()),
    { kind: 'playback-failed', attemptId: 1, reason: 'playback-error' }
  );
  for (const duplicate of [
    { kind: 'playback-completed', attemptId: 1 },
    { kind: 'playback-failed', attemptId: 1, reason: 'completion-timeout' },
  ]) {
    assert.strictEqual(
      lifecycle.reducePracticePlayback(failed, duplicate),
      failed
    );
  }
});

runTest('the reducer is deterministic and does not mutate prior state', () => {
  const state = Object.freeze({
    status: 'loading',
    attempt: Object.freeze({
      attemptId: 1,
      prompt: Object.freeze({ ...prompt }),
    }),
    submission: 'awaiting-render',
  });
  const before = plain(state);
  const event = { kind: 'playback-submitted', attemptId: 1 };

  const first = lifecycle.reducePracticePlayback(state, event);
  const second = lifecycle.reducePracticePlayback(state, event);

  assert.deepStrictEqual(plain(state), before);
  assert.deepStrictEqual(plain(first), plain(second));
  assert.notStrictEqual(first, state);
});

runTest('reset returns every lifecycle state to idle', () => {
  const idle = lifecycle.initialPracticePlaybackState();
  const loading = request(idle);
  const playing = lifecycle.reducePracticePlayback(loading, {
    kind: 'playback-started',
    attemptId: 1,
  });
  const awaitingAnswer = lifecycle.reducePracticePlayback(playing, {
    kind: 'playback-completed',
    attemptId: 1,
  });
  const completed = lifecycle.reducePracticePlayback(awaitingAnswer, {
    kind: 'answer-accepted',
    attemptId: 1,
  });
  const failed = lifecycle.reducePracticePlayback(loading, {
    kind: 'playback-failed',
    attemptId: 1,
    reason: 'playback-error',
  });

  for (const state of [idle, loading, playing, awaitingAnswer, completed, failed]) {
    assert.deepStrictEqual(
      plain(lifecycle.reducePracticePlayback(state, { kind: 'session-reset' })),
      { status: 'idle' }
    );
  }
});
