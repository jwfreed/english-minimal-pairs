const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  collectEligibleVoices,
  applyUserExclusions,
  buildPrioritizedVoiceRotationPool,
  buildDifficultyVoicePool,
  buildPlaybackVoicePool,
  currentRotationIndex,
  advanceRotationIndex,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'voiceSelection.ts'));

// Values returned by the vm-loaded module live in another realm; strip
// prototypes before deep comparison (same pattern as masteryPersistence.test.js).
const plain = (value) => JSON.parse(JSON.stringify(value));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// Voice factory: quality is 'Enhanced' | 'Default' (expo-speech serialization)
function v(identifier, name, quality, language) {
  return { identifier, name, quality, language };
}

runTest('collectEligibleVoices keeps only en-* voices', () => {
  const result = collectEligibleVoices([
    v('us-1', 'Samantha', 'Default', 'en-US'),
    v('fr-1', 'Thomas', 'Enhanced', 'fr-FR'),
    v('gb-1', 'Daniel', 'Default', 'en-GB'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier).sort()),
    ['gb-1', 'us-1']
  );
});

runTest('collectEligibleVoices strips novelty voices by name and locale+name', () => {
  const result = collectEligibleVoices([
    v('us-1', 'Samantha', 'Default', 'en-US'),
    v('us-2', 'Zarvox', 'Default', 'en-US'),
    v('us-3', 'Good News', 'Default', 'en-US'),
    v('gb-1', 'Sandy', 'Default', 'en-GB'), // locale+name exclusion
    v('us-4', 'Sandy', 'Default', 'en-US'), // same name, different locale: kept
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier).sort()),
    ['us-1', 'us-4']
  );
});

runTest('collectEligibleVoices sorts enhanced first, then locale, then name', () => {
  const result = collectEligibleVoices([
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
    v('au-e', 'Karen', 'Enhanced', 'en-AU'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['au-e', 'gb-e', 'us-e', 'us-d']
  );
});

runTest('collectEligibleVoices collapses duplicate identifiers deterministically', () => {
  const a = v('dup', 'Karen', 'Default', 'en-AU');
  const b = v('dup', 'Karen', 'Enhanced', 'en-AU');
  const forward = collectEligibleVoices([a, b]);
  const backward = collectEligibleVoices([b, a]);
  assert.strictEqual(forward.length, 1);
  assert.strictEqual(forward[0].quality, 'Enhanced'); // enhanced wins
  assert.deepStrictEqual(plain(forward), plain(backward)); // input order irrelevant
});

runTest('applyUserExclusions removes excluded identifiers and keeps order', () => {
  const pool = collectEligibleVoices([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
  ]);
  const result = applyUserExclusions(pool, new Set(['gb-e']));
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-e', 'us-d']
  );
});

runTest('applyUserExclusions with no exclusions returns the same voices', () => {
  const pool = collectEligibleVoices([v('us-1', 'Samantha', 'Default', 'en-US')]);
  assert.deepStrictEqual(plain(applyUserExclusions(pool, new Set())), plain(pool));
});

runTest('buildPrioritizedVoiceRotationPool orders by tier and keeps every voice', () => {
  const pool = [
    v('au-d', 'Lee', 'Default', 'en-AU'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ];
  const result = buildPrioritizedVoiceRotationPool(pool);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-e', 'us-d', 'gb-e', 'au-d'] // enhanced US, default US, enhanced en-*, default en-*
  );
});

runTest('buildPrioritizedVoiceRotationPool does not discard defaults when enhanced exist', () => {
  const result = buildPrioritizedVoiceRotationPool([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  assert.strictEqual(result.length, 2);
});

runTest('buildPrioritizedVoiceRotationPool with no enhanced voices keeps all defaults usable', () => {
  const result = buildPrioritizedVoiceRotationPool([
    v('gb-d', 'Serena', 'Default', 'en-GB'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-d', 'gb-d']
  );
});

runTest('buildPrioritizedVoiceRotationPool with only non-US voices still orders enhanced first', () => {
  const result = buildPrioritizedVoiceRotationPool([
    v('gb-d', 'Serena', 'Default', 'en-GB'),
    v('au-e', 'Karen', 'Enhanced', 'en-AU'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['au-e', 'gb-d']
  );
});

runTest('buildPrioritizedVoiceRotationPool returns [] for an empty pool', () => {
  assert.deepStrictEqual(plain(buildPrioritizedVoiceRotationPool([])), []);
});

runTest('buildPrioritizedVoiceRotationPool ties break deterministically (language, name, id)', () => {
  const a = v('id-a', 'Karen', 'Enhanced', 'en-AU');
  const b = v('id-b', 'Karen', 'Enhanced', 'en-AU');
  assert.deepStrictEqual(
    plain(buildPrioritizedVoiceRotationPool([b, a]).map((x) => x.identifier)),
    ['id-a', 'id-b']
  );
});

runTest('currentRotationIndex keeps the index for an unchanged pool', () => {
  const pool = buildPrioritizedVoiceRotationPool([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  const ids = pool.map((x) => x.identifier);
  assert.strictEqual(currentRotationIndex(ids, 1, pool), 1);
});

runTest('currentRotationIndex resets to 0 when the pool identity changes', () => {
  const pool = buildPrioritizedVoiceRotationPool([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  assert.strictEqual(currentRotationIndex(['us-e', 'gone'], 1, pool), 0);
  assert.strictEqual(currentRotationIndex(['us-e'], 0, pool), 0); // length change
  assert.strictEqual(currentRotationIndex([], 0, pool), 0); // first call
});

runTest('currentRotationIndex clamps an out-of-range index to 0', () => {
  const pool = buildPrioritizedVoiceRotationPool([v('us-e', 'Evan', 'Enhanced', 'en-US')]);
  assert.strictEqual(currentRotationIndex(['us-e'], 5, pool), 0);
  assert.strictEqual(currentRotationIndex(['us-e'], -1, pool), 0);
});

runTest('advanceRotationIndex wraps and guards empty pools', () => {
  assert.strictEqual(advanceRotationIndex(0, 3), 1);
  assert.strictEqual(advanceRotationIndex(2, 3), 0);
  assert.strictEqual(advanceRotationIndex(0, 1), 0);
  assert.strictEqual(advanceRotationIndex(0, 0), 0);
});

runTest('unchanged pool of two or more voices never repeats consecutively', () => {
  const pool = buildPrioritizedVoiceRotationPool([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
  ]);
  const ids = pool.map((x) => x.identifier);
  let state = { poolIds: [], index: 0 };
  let previous = null;
  for (let i = 0; i < 10; i++) {
    const index = currentRotationIndex(state.poolIds, state.index, pool);
    const voice = pool[index];
    assert.notStrictEqual(voice.identifier, previous);
    previous = voice.identifier;
    state = { poolIds: ids, index: advanceRotationIndex(index, pool.length) };
  }
});

runTest('single-voice pool repeats safely without crashing', () => {
  const pool = buildPrioritizedVoiceRotationPool([v('us-e', 'Evan', 'Enhanced', 'en-US')]);
  const ids = pool.map((x) => x.identifier);
  let state = { poolIds: [], index: 0 };
  for (let i = 0; i < 3; i++) {
    const index = currentRotationIndex(state.poolIds, state.index, pool);
    assert.strictEqual(pool[index].identifier, 'us-e');
    state = { poolIds: ids, index: advanceRotationIndex(index, pool.length) };
  }
});

// ── buildDifficultyVoicePool: staged voice variability by pair difficulty ──

// Four-voice prioritized pool: en-US enhanced, en-US default, en-GB enhanced,
// en-AU default (buildPrioritizedVoiceRotationPool tier order).
function prioritizedFour() {
  return buildPrioritizedVoiceRotationPool([
    v('au-d', 'Lee', 'Default', 'en-AU'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ]);
}

runTest('buildDifficultyVoicePool easy (difficulty 1-2) returns only the first prioritized voice', () => {
  const pool = prioritizedFour();
  for (const difficulty of [1, 2]) {
    assert.deepStrictEqual(
      plain(buildDifficultyVoicePool(pool, difficulty).map((x) => x.identifier)),
      ['us-e']
    );
  }
});

runTest('buildDifficultyVoicePool medium (difficulty 3-4) returns the first two prioritized voices', () => {
  const pool = prioritizedFour();
  for (const difficulty of [3, 4]) {
    assert.deepStrictEqual(
      plain(buildDifficultyVoicePool(pool, difficulty).map((x) => x.identifier)),
      ['us-e', 'us-d']
    );
  }
});

runTest('buildDifficultyVoicePool hard (difficulty 5-6) returns the complete prioritized pool', () => {
  const pool = prioritizedFour();
  for (const difficulty of [5, 6]) {
    assert.deepStrictEqual(
      plain(buildDifficultyVoicePool(pool, difficulty).map((x) => x.identifier)),
      ['us-e', 'us-d', 'gb-e', 'au-d']
    );
  }
});

runTest('buildDifficultyVoicePool without a difficulty returns the complete pool (legacy callers)', () => {
  const pool = prioritizedFour();
  assert.deepStrictEqual(
    plain(buildDifficultyVoicePool(pool, undefined).map((x) => x.identifier)),
    ['us-e', 'us-d', 'gb-e', 'au-d']
  );
});

runTest('buildDifficultyVoicePool single-voice pool behaves identically at every difficulty', () => {
  const pool = buildPrioritizedVoiceRotationPool([v('us-e', 'Evan', 'Enhanced', 'en-US')]);
  for (const difficulty of [1, 2, 3, 4, 5, 6]) {
    assert.deepStrictEqual(
      plain(buildDifficultyVoicePool(pool, difficulty).map((x) => x.identifier)),
      ['us-e']
    );
  }
});

runTest('buildDifficultyVoicePool two-voice pool uses one voice at easy and both at medium/hard', () => {
  const pool = buildPrioritizedVoiceRotationPool([
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ]);
  assert.deepStrictEqual(
    plain(buildDifficultyVoicePool(pool, 1).map((x) => x.identifier)),
    ['us-e']
  );
  for (const difficulty of [3, 5]) {
    assert.deepStrictEqual(
      plain(buildDifficultyVoicePool(pool, difficulty).map((x) => x.identifier)),
      ['us-e', 'us-d']
    );
  }
});

runTest('buildDifficultyVoicePool empty pool returns [] at every difficulty', () => {
  for (const difficulty of [1, 3, 5]) {
    assert.deepStrictEqual(plain(buildDifficultyVoicePool([], difficulty)), []);
  }
});

runTest('buildDifficultyVoicePool applies after user exclusions, not before', () => {
  const eligible = collectEligibleVoices([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
  ]);
  // Excluding the top-priority voice promotes the next one into the easy slot.
  const active = applyUserExclusions(eligible, new Set(['us-e']));
  const staged = buildDifficultyVoicePool(
    buildPrioritizedVoiceRotationPool(active),
    1
  );
  assert.deepStrictEqual(plain(staged.map((x) => x.identifier)), ['us-d']);
});

runTest('rotation stays within the staged subset and reuses existing round-robin semantics', () => {
  const staged = buildDifficultyVoicePool(prioritizedFour(), 3); // us-e, us-d
  const ids = staged.map((x) => x.identifier);
  let state = { poolIds: [], index: 0 };
  const spoken = [];
  for (let i = 0; i < 6; i++) {
    const index = currentRotationIndex(state.poolIds, state.index, staged);
    spoken.push(staged[index].identifier);
    state = { poolIds: ids, index: advanceRotationIndex(index, staged.length) };
  }
  assert.deepStrictEqual(spoken, ['us-e', 'us-d', 'us-e', 'us-d', 'us-e', 'us-d']);
});

runTest('easy difficulty repeats the same voice consistently across playbacks', () => {
  const staged = buildDifficultyVoicePool(prioritizedFour(), 1);
  const ids = staged.map((x) => x.identifier);
  let state = { poolIds: [], index: 0 };
  for (let i = 0; i < 4; i++) {
    const index = currentRotationIndex(state.poolIds, state.index, staged);
    assert.strictEqual(staged[index].identifier, 'us-e');
    state = { poolIds: ids, index: advanceRotationIndex(index, staged.length) };
  }
});

runTest('stage transition changes the subset and resets rotation deterministically', () => {
  const pool = prioritizedFour();
  const medium = buildDifficultyVoicePool(pool, 3);
  const hard = buildDifficultyVoicePool(pool, 5);
  assert.notDeepStrictEqual(
    plain(medium.map((x) => x.identifier)),
    plain(hard.map((x) => x.identifier))
  );
  // Rotation state recorded against the medium subset resets when the staged
  // pool grows (currentRotationIndex treats it as a new pool).
  const mediumIds = medium.map((x) => x.identifier);
  assert.strictEqual(currentRotationIndex(mediumIds, 1, hard), 0);
});

runTest('buildDifficultyVoicePool never mutates its input pool', () => {
  const pool = prioritizedFour();
  const before = plain(pool);
  buildDifficultyVoicePool(pool, 1);
  buildDifficultyVoicePool(pool, 3);
  buildDifficultyVoicePool(pool, 5);
  assert.deepStrictEqual(plain(pool), before);
});

// ── buildPlaybackVoicePool: per-utterance pool with placement override ──

runTest('buildPlaybackVoicePool practice mode stages by difficulty', () => {
  const pool = prioritizedFour();
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, { mode: 'practice', difficulty: 1 }).map((x) => x.identifier)),
    ['us-e']
  );
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, { mode: 'practice', difficulty: 3 }).map((x) => x.identifier)),
    ['us-e', 'us-d']
  );
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, { mode: 'practice', difficulty: 5 }).map((x) => x.identifier)),
    ['us-e', 'us-d', 'gb-e', 'au-d']
  );
  // Difficulty alone (no explicit mode) is also practice.
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, { difficulty: 1 }).map((x) => x.identifier)),
    ['us-e']
  );
});

runTest('buildPlaybackVoicePool placement mode always uses the full pool, even at easy difficulty', () => {
  const pool = prioritizedFour();
  const full = ['us-e', 'us-d', 'gb-e', 'au-d'];
  for (const difficulty of [1, 3, 5, undefined]) {
    assert.deepStrictEqual(
      plain(buildPlaybackVoicePool(pool, { mode: 'placement', difficulty }).map((x) => x.identifier)),
      full
    );
  }
});

runTest('buildPlaybackVoicePool legacy callers without a context receive the full pool', () => {
  const pool = prioritizedFour();
  const full = ['us-e', 'us-d', 'gb-e', 'au-d'];
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, undefined).map((x) => x.identifier)),
    full
  );
  assert.deepStrictEqual(
    plain(buildPlaybackVoicePool(pool, {}).map((x) => x.identifier)),
    full
  );
});

runTest('buildPlaybackVoicePool handles empty pools and never mutates its input', () => {
  assert.deepStrictEqual(plain(buildPlaybackVoicePool([], { mode: 'placement' })), []);
  assert.deepStrictEqual(plain(buildPlaybackVoicePool([], { difficulty: 1 })), []);
  const pool = prioritizedFour();
  const before = plain(pool);
  buildPlaybackVoicePool(pool, { mode: 'placement', difficulty: 1 });
  buildPlaybackVoicePool(pool, { difficulty: 1 });
  assert.deepStrictEqual(plain(pool), before);
});
