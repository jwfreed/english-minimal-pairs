export interface PracticePlaybackPrompt {
  pairId: string;
  playedIdx: 0 | 1;
  startedAtMs: number;
}

export interface PracticePlaybackAttempt {
  attemptId: number;
  prompt: PracticePlaybackPrompt;
}

export type PracticePlaybackFailureReason =
  | 'deferred-prompt-mismatch'
  | 'request-rejected'
  | 'playback-error'
  | 'playback-stopped'
  | 'start-timeout'
  | 'completion-timeout';

export type PracticePlaybackState =
  | { status: 'idle' }
  | {
      status: 'loading';
      attempt: PracticePlaybackAttempt;
      submission: 'awaiting-render' | 'submitted';
    }
  | { status: 'playing'; attempt: PracticePlaybackAttempt }
  | { status: 'awaiting-answer'; attempt: PracticePlaybackAttempt }
  | { status: 'completed'; attempt: PracticePlaybackAttempt }
  | {
      status: 'failed';
      attempt: PracticePlaybackAttempt;
      reason: PracticePlaybackFailureReason;
    };

export type PracticePlaybackEvent =
  | {
      kind: 'playback-requested';
      attempt: PracticePlaybackAttempt;
      submission: 'awaiting-render' | 'submitted';
    }
  | { kind: 'playback-submitted'; attemptId: number }
  | { kind: 'playback-started'; attemptId: number }
  | { kind: 'playback-completed'; attemptId: number }
  | {
      kind: 'playback-failed';
      attemptId: number;
      reason: PracticePlaybackFailureReason;
    }
  | { kind: 'answer-accepted'; attemptId: number }
  | { kind: 'session-reset' };

export function initialPracticePlaybackState(): PracticePlaybackState {
  return { status: 'idle' };
}

function isCurrentAttempt(
  state: PracticePlaybackState,
  attemptId: number
): state is Exclude<PracticePlaybackState, { status: 'idle' }> {
  return state.status !== 'idle' && state.attempt.attemptId === attemptId;
}

export function reducePracticePlayback(
  state: PracticePlaybackState,
  event: PracticePlaybackEvent
): PracticePlaybackState {
  if (event.kind === 'session-reset') {
    return initialPracticePlaybackState();
  }

  if (event.kind === 'playback-requested') {
    if (
      state.status === 'loading' ||
      state.status === 'playing' ||
      (state.status !== 'idle' &&
        event.attempt.attemptId <= state.attempt.attemptId)
    ) {
      return state;
    }
    return {
      status: 'loading',
      attempt: event.attempt,
      submission: event.submission,
    };
  }

  if (!isCurrentAttempt(state, event.attemptId)) {
    return state;
  }

  switch (event.kind) {
    case 'playback-submitted':
      return state.status === 'loading' &&
        state.submission === 'awaiting-render'
        ? { ...state, submission: 'submitted' }
        : state;
    case 'playback-started':
      return state.status === 'loading' && state.submission === 'submitted'
        ? { status: 'playing', attempt: state.attempt }
        : state;
    case 'playback-completed':
      return (state.status === 'loading' && state.submission === 'submitted') ||
        state.status === 'playing'
        ? { status: 'awaiting-answer', attempt: state.attempt }
        : state;
    case 'playback-failed': {
      const isDeferredMismatch =
        state.status === 'loading' &&
        state.submission === 'awaiting-render' &&
        event.reason === 'deferred-prompt-mismatch';
      const isSubmittedFailure =
        (state.status === 'loading' && state.submission === 'submitted') ||
        state.status === 'playing';
      return isDeferredMismatch || isSubmittedFailure
        ? {
            status: 'failed',
            attempt: state.attempt,
            reason: event.reason,
          }
        : state;
    }
    case 'answer-accepted':
      return state.status === 'awaiting-answer'
        ? { status: 'completed', attempt: state.attempt }
        : state;
  }
}

export function canAnswerPracticePrompt(
  state: PracticePlaybackState
): boolean {
  return state.status === 'awaiting-answer';
}

export function isPracticePlaybackActive(
  state: PracticePlaybackState
): boolean {
  return state.status === 'loading' || state.status === 'playing';
}

export function classifyDeferredPromptRender({
  requestedPairId,
  renderedPairId,
  eligiblePairIds,
}: {
  requestedPairId: string;
  renderedPairId: string | null;
  eligiblePairIds: readonly string[];
}): 'ready' | 'transient-mismatch' | 'stale-mismatch' {
  if (renderedPairId === requestedPairId) {
    return 'ready';
  }
  return eligiblePairIds.includes(requestedPairId)
    ? 'transient-mismatch'
    : 'stale-mismatch';
}
