const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  IOS_TTS_UNAVAILABLE_MESSAGE,
  MAX_COMPLETION_BUDGET_MS,
  MIN_COMPLETION_BUDGET_MS,
  START_BUDGET_MS,
  buildSpeechOptions,
  deriveSpeechTimeoutBudgets,
  getPlaybackWord,
  requireIosVoicesForPlayback,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'audioPlayback.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const pair = {
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

runTest('getPlaybackWord returns the requested minimal-pair word', () => {
  assert.strictEqual(getPlaybackWord(pair, 0), 'right');
  assert.strictEqual(getPlaybackWord(pair, 1), 'light');
});

runTest('getPlaybackWord rejects missing selected pair before TTS calls', () => {
  assert.throws(
    () => getPlaybackWord(undefined, 0),
    /No pair selected/
  );
});

runTest('requireIosVoicesForPlayback rejects iOS playback when no TTS voices exist', () => {
  assert.throws(
    () => requireIosVoicesForPlayback('ios', []),
    new RegExp(IOS_TTS_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

runTest('requireIosVoicesForPlayback allows Android without a local voice list', () => {
  assert.doesNotThrow(() => requireIosVoicesForPlayback('android', []));
});

runTest('buildSpeechOptions preserves the app speech defaults and selected voice', () => {
  const voice = {
    identifier: 'voice-1',
    name: 'Sample Voice',
    language: 'en-US',
  };
  const options = buildSpeechOptions({
    rate: 0.85,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-US');
  assert.strictEqual(options.pitch, 1.0);
  assert.strictEqual(options.rate, 0.85);
  assert.strictEqual(options.volume, 1.0);
  assert.strictEqual(options.voice, 'voice-1');
  assert.strictEqual(typeof options.onDone, 'function');
  assert.strictEqual(typeof options.onStopped, 'function');
  assert.strictEqual(typeof options.onError, 'function');
});

runTest('buildSpeechOptions omits voice and falls back to en-US when using the system default', () => {
  const options = buildSpeechOptions({
    rate: 1,
    voice: null,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'voice'), false);
  assert.strictEqual(options.language, 'en-US');
});

runTest('buildSpeechOptions uses a selected en-GB voice\'s own language, not a hardcoded en-US', () => {
  const voice = {
    identifier: 'voice-gb',
    name: 'Daniel',
    language: 'en-GB',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-GB');
  assert.strictEqual(options.voice, 'voice-gb');
});

runTest('buildSpeechOptions preserves a selected non-US English voice\'s own locale (en-AU)', () => {
  const voice = {
    identifier: 'voice-au',
    name: 'Karen',
    language: 'en-AU',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-AU');
  assert.strictEqual(options.voice, 'voice-au');
});

// -----------------------------------------------------------------------------
// Timeout budget derivation. These budgets are speech semantics — utterance
// length and rate — and therefore live here rather than in the playback
// coordinator, which stays speech-agnostic and receives them as plain numbers.
// -----------------------------------------------------------------------------

runTest('deriveSpeechTimeoutBudgets returns a constant start budget independent of the utterance', () => {
  const short = deriveSpeechTimeoutBudgets({ word: 'oath', rate: 0.85 });
  const long = deriveSpeechTimeoutBudgets({ word: 'extraordinarily', rate: 0.5 });

  assert.strictEqual(short.startBudgetMs, START_BUDGET_MS);
  assert.strictEqual(long.startBudgetMs, START_BUDGET_MS);
});

runTest('deriveSpeechTimeoutBudgets raises the documented "oath" example to the completion floor', () => {
  // 4 chars * 140ms / 0.85 = 659ms; * 3 slack = 1976ms; below the 3000ms floor.
  const budgets = deriveSpeechTimeoutBudgets({ word: 'oath', rate: 0.85 });

  assert.strictEqual(budgets.completionBudgetMs, MIN_COMPLETION_BUDGET_MS);
});

runTest('deriveSpeechTimeoutBudgets scales the completion budget with word length', () => {
  const shortWord = deriveSpeechTimeoutBudgets({ word: 'oath', rate: 1 });
  const longWord = deriveSpeechTimeoutBudgets({ word: 'unconscionable', rate: 1 });

  assert.ok(
    longWord.completionBudgetMs > shortWord.completionBudgetMs,
    `expected a longer word to earn a larger budget, got ${longWord.completionBudgetMs} vs ${shortWord.completionBudgetMs}`
  );
});

runTest('deriveSpeechTimeoutBudgets scales the completion budget inversely with rate', () => {
  const fast = deriveSpeechTimeoutBudgets({ word: 'unconscionable', rate: 1.5 });
  const slow = deriveSpeechTimeoutBudgets({ word: 'unconscionable', rate: 0.5 });

  assert.ok(
    slow.completionBudgetMs > fast.completionBudgetMs,
    `expected a slower rate to earn a larger budget, got ${slow.completionBudgetMs} vs ${fast.completionBudgetMs}`
  );
});

runTest('deriveSpeechTimeoutBudgets clamps the completion budget to the documented ceiling', () => {
  const budgets = deriveSpeechTimeoutBudgets({
    word: 'a'.repeat(500),
    rate: 0.1,
  });

  assert.strictEqual(budgets.completionBudgetMs, MAX_COMPLETION_BUDGET_MS);
});

runTest('deriveSpeechTimeoutBudgets never emits a non-finite budget for a degenerate rate', () => {
  // A zero or corrupt rate must not become an Infinity/NaN timer delay, which
  // would silently disarm the watchdog and restore the permanent-lock bug.
  for (const rate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const budgets = deriveSpeechTimeoutBudgets({ word: 'oath', rate });

    assert.ok(
      Number.isFinite(budgets.completionBudgetMs),
      `rate ${rate} produced a non-finite completion budget`
    );
    assert.ok(
      budgets.completionBudgetMs >= MIN_COMPLETION_BUDGET_MS &&
        budgets.completionBudgetMs <= MAX_COMPLETION_BUDGET_MS,
      `rate ${rate} produced an out-of-range completion budget: ${budgets.completionBudgetMs}`
    );
  }
});

runTest('deriveSpeechTimeoutBudgets handles an empty word without dropping below the floor', () => {
  const budgets = deriveSpeechTimeoutBudgets({ word: '', rate: 1 });

  assert.strictEqual(budgets.completionBudgetMs, MIN_COMPLETION_BUDGET_MS);
});

runTest('buildSpeechOptions falls back to en-US when the selected voice has a blank language', () => {
  const voice = {
    identifier: 'voice-blank',
    name: 'Mystery',
    language: '',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-US');
  assert.strictEqual(options.voice, 'voice-blank');
});
