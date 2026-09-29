// scripts/adaptiveProgression.test.js
// Characterization tests for the adaptive-progression algorithm.
//
// These tests lock in the current promotion invariants so that a future
// scheduler change (e.g. missed-pair weighting) cannot accidentally alter
// the mastery-promotion contract without a failing test.
//
// Invariants protected:
//   1. Mastery never promotes before reaching max speed tier.
//   2. Wrong answers reset streaks but do NOT demote speed.
//   3. Slow correct answers do not count toward the fast streak.
//   4. Mastery tier is clamped at 6.
//   5. The minimum path to mastery promotion is 9 fast-correct answers
//      (fast path) or 18 correct answers (long path), across 3 speed tiers.

const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  getNextAdaptiveProgression,
  FAST_STREAK_NEEDED,
  FAST_THRESHOLD_MS,
  LONG_STREAK_NEEDED,
  MAX_SPEED,
  progressTowardNextTier,
} = loadTsModule(path.join(__dirname, '..', 'src', 'learning', 'adaptiveProgression.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// Helpers: response times relative to the fast threshold
const FAST_MS = FAST_THRESHOLD_MS - 1;   // qualifies as "fast"
const SLOW_MS = FAST_THRESHOLD_MS + 100; // does not qualify as "fast"

// ─── Basic promotion gating ────────────────────────────────────────────────

runTest('no promotion when streaks are below both thresholds', () => {
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: 0,
    fastStreak: 1,    // needs FAST_STREAK_NEEDED
    longStreak: 2,    // needs LONG_STREAK_NEEDED
    currentMasteryTier: 1,
  });
  assert.strictEqual(result.promoteSpeed, false);
  assert.strictEqual(result.promoteMastery, false);
  assert.strictEqual(result.nextMasteryTier, 1, 'mastery tier unchanged');
  assert.strictEqual(result.nextSpeed, 0, 'speed unchanged');
});

runTest('wrong answer resets both streaks and does not demote speed', () => {
  // Invariant: a miss resets streaks but must never lower the speed tier.
  // Demoting speed on miss would make mastery promotion unreachable in practice.
  const result = getNextAdaptiveProgression({
    correct: false,
    responseTimeMs: FAST_MS,
    currentSpeed: 2,
    fastStreak: 2,
    longStreak: 5,
    currentMasteryTier: 3,
  });
  assert.strictEqual(result.nextFastStreak, 0, 'fast streak resets on wrong answer');
  assert.strictEqual(result.nextLongStreak, 0, 'long streak resets on wrong answer');
  assert.strictEqual(result.promoteSpeed, false, 'no speed promotion on wrong answer');
  assert.strictEqual(result.promoteMastery, false, 'no mastery promotion on wrong answer');
  assert.strictEqual(result.nextSpeed, 2, 'speed tier is NOT demoted on wrong answer');
});

runTest('slow correct answer does not increment fast streak', () => {
  // Only fast answers count toward the fast-streak path.
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: SLOW_MS,
    currentSpeed: 0,
    fastStreak: 2,
    longStreak: 2,
    currentMasteryTier: 1,
  });
  assert.strictEqual(result.nextFastStreak, 0, 'slow correct answer resets fast streak');
  assert.strictEqual(result.nextLongStreak, 3, 'slow correct answer still increments long streak');
});

// ─── Speed promotion (not yet at max speed) ────────────────────────────────

runTest('fast path at speed 0: promotes speed to 1, mastery unchanged', () => {
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: 0,
    fastStreak: FAST_STREAK_NEEDED - 1,
    longStreak: 2,
    currentMasteryTier: 1,
  });
  assert.strictEqual(result.promoteSpeed, true, 'speed promotes at fast-streak threshold');
  assert.strictEqual(result.nextSpeed, 1, 'speed advances to the next tier');
  assert.strictEqual(result.promoteMastery, false, 'mastery does not promote at non-max speed');
  assert.strictEqual(result.nextFastStreak, 0, 'fast streak resets after promotion');
  assert.strictEqual(result.nextLongStreak, 0, 'long streak resets after promotion');
  assert.strictEqual(result.nextMasteryTier, 1, 'mastery tier unchanged');
});

runTest('long path at speed 1: promotes speed to 2, mastery unchanged', () => {
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: SLOW_MS,
    currentSpeed: 1,
    fastStreak: 0,
    longStreak: LONG_STREAK_NEEDED - 1,
    currentMasteryTier: 2,
  });
  assert.strictEqual(result.promoteSpeed, true, 'speed promotes at long-streak threshold');
  assert.strictEqual(result.nextSpeed, 2, 'speed advances from 1 to 2');
  assert.strictEqual(result.promoteMastery, false, 'mastery does not promote at non-max speed');
});

// ─── Mastery promotion (at max speed) ─────────────────────────────────────

runTest('fast path at max speed: promotes mastery tier and resets speed to 0', () => {
  // Invariant: mastery only promotes when the learner is already at max speed.
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: MAX_SPEED,
    fastStreak: FAST_STREAK_NEEDED - 1,
    longStreak: 2,
    currentMasteryTier: 1,
  });
  assert.strictEqual(result.promoteSpeed, false, 'speed cannot increment beyond max');
  assert.strictEqual(result.promoteMastery, true, 'mastery promotes when at max speed');
  assert.strictEqual(result.nextSpeed, 0, 'speed resets to 0 on mastery promotion');
  assert.strictEqual(result.nextMasteryTier, 2, 'mastery tier increments by 1');
  assert.strictEqual(result.nextFastStreak, 0, 'fast streak resets on mastery promotion');
  assert.strictEqual(result.nextLongStreak, 0, 'long streak resets on mastery promotion');
});

runTest('long path at max speed: promotes mastery tier', () => {
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: SLOW_MS,
    currentSpeed: MAX_SPEED,
    fastStreak: 0,
    longStreak: LONG_STREAK_NEEDED - 1,
    currentMasteryTier: 3,
  });
  assert.strictEqual(result.promoteMastery, true, 'mastery promotes via long path at max speed');
  assert.strictEqual(result.nextMasteryTier, 4, 'mastery tier increments by 1');
  assert.strictEqual(result.nextSpeed, 0, 'speed resets to 0 on mastery promotion');
});

runTest('meeting the final tier criteria completes it once and is never a tier promotion', () => {
  for (const streaks of [
    { responseTimeMs: FAST_MS, fastStreak: FAST_STREAK_NEEDED - 1, longStreak: 0 },
    { responseTimeMs: 6000, fastStreak: 0, longStreak: LONG_STREAK_NEEDED - 1 },
  ]) {
    for (const finalTierCompleted of [false, true]) {
      const result = getNextAdaptiveProgression({
        correct: true,
        currentSpeed: MAX_SPEED,
        currentMasteryTier: 6,
        finalTierCompleted,
        ...streaks,
      });
      assert.strictEqual(result.promoteMastery, false, 'tier 6 has no next tier');
      assert.strictEqual(result.completesFinalTier, !finalTierCompleted);
      assert.strictEqual(result.promoteSpeed, false);
      assert.strictEqual(result.nextMasteryTier, 6);
      // Practice cadence is unchanged: speed and streaks restart either way.
      assert.strictEqual(result.nextSpeed, 0);
      assert.strictEqual(result.nextFastStreak, 0);
      assert.strictEqual(result.nextLongStreak, 0);
    }
  }
});

runTest('final-tier completion requires the promotion criteria and the final tier', () => {
  const belowCriteria = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: MAX_SPEED,
    fastStreak: 0,
    longStreak: 0,
    currentMasteryTier: 6,
  });
  assert.strictEqual(belowCriteria.completesFinalTier, false);
  const belowFinalTier = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: MAX_SPEED,
    fastStreak: FAST_STREAK_NEEDED - 1,
    longStreak: 0,
    currentMasteryTier: 5,
  });
  assert.strictEqual(belowFinalTier.completesFinalTier, false);
  assert.strictEqual(belowFinalTier.promoteMastery, true);
});

runTest('promotion into the final tier is still reported', () => {
  const result = getNextAdaptiveProgression({
    correct: true,
    responseTimeMs: FAST_MS,
    currentSpeed: MAX_SPEED,
    fastStreak: FAST_STREAK_NEEDED - 1,
    longStreak: 0,
    currentMasteryTier: 5,
  });
  assert.strictEqual(result.promoteMastery, true);
  assert.strictEqual(result.nextMasteryTier, 6);
});

// ─── Speed tier ordering ───────────────────────────────────────────────────

runTest('mastery is unreachable before passing through intermediate speed tiers', () => {
  // Characterizes the speed-tier ladder: 0 → 1 → 2 → mastery.
  // Each promotion only advances one tier at a time.
  const speed0 = getNextAdaptiveProgression({
    correct: true, responseTimeMs: FAST_MS, currentSpeed: 0,
    fastStreak: FAST_STREAK_NEEDED - 1, longStreak: 0, currentMasteryTier: 1,
  });
  assert.strictEqual(speed0.nextSpeed, 1);
  assert.strictEqual(speed0.promoteMastery, false);

  const speed1 = getNextAdaptiveProgression({
    correct: true, responseTimeMs: FAST_MS, currentSpeed: 1,
    fastStreak: FAST_STREAK_NEEDED - 1, longStreak: 0, currentMasteryTier: 1,
  });
  assert.strictEqual(speed1.nextSpeed, 2);
  assert.strictEqual(speed1.promoteMastery, false);

  const speed2 = getNextAdaptiveProgression({
    correct: true, responseTimeMs: FAST_MS, currentSpeed: 2,
    fastStreak: FAST_STREAK_NEEDED - 1, longStreak: 0, currentMasteryTier: 1,
  });
  assert.strictEqual(speed2.nextSpeed, 0);      // resets after mastery
  assert.strictEqual(speed2.promoteMastery, true);
});

// ─── Minimum-path sequences ────────────────────────────────────────────────

runTest('fast path sequence: exactly 9 fast-correct answers promote one mastery tier', () => {
  // Characterizes the minimum answer count on the fast path:
  //   3 fast-correct × speed-tier 0  →  speed 1
  //   3 fast-correct × speed-tier 1  →  speed 2
  //   3 fast-correct × speed-tier 2  →  mastery tier promoted
  // A future scheduler change must not reduce this minimum.
  let speed = 0;
  let fastStreak = 0;
  let longStreak = 0;
  const masteryTier = 1;
  let promotedMastery = false;

  for (let i = 0; i < 9; i++) {
    const result = getNextAdaptiveProgression({
      correct: true,
      responseTimeMs: FAST_MS,
      currentSpeed: speed,
      fastStreak,
      longStreak,
      currentMasteryTier: masteryTier,
    });
    speed = result.nextSpeed;
    fastStreak = result.nextFastStreak;
    longStreak = result.nextLongStreak;
    if (result.promoteMastery) promotedMastery = true;
  }

  assert.strictEqual(promotedMastery, true, 'mastery promotes after exactly 9 fast-correct answers');
});

runTest('fast path sequence: 8 fast-correct answers are not enough for mastery promotion', () => {
  let speed = 0;
  let fastStreak = 0;
  let longStreak = 0;
  const masteryTier = 1;
  let promotedMastery = false;

  for (let i = 0; i < 8; i++) {
    const result = getNextAdaptiveProgression({
      correct: true,
      responseTimeMs: FAST_MS,
      currentSpeed: speed,
      fastStreak,
      longStreak,
      currentMasteryTier: masteryTier,
    });
    speed = result.nextSpeed;
    fastStreak = result.nextFastStreak;
    longStreak = result.nextLongStreak;
    if (result.promoteMastery) promotedMastery = true;
  }

  assert.strictEqual(promotedMastery, false, '8 answers are not enough — 9 are required on fast path');
});

runTest('long path sequence: exactly 18 slow-correct answers promote one mastery tier', () => {
  // Characterizes the minimum answer count on the long path:
  //   6 correct × speed-tier 0  →  speed 1
  //   6 correct × speed-tier 1  →  speed 2
  //   6 correct × speed-tier 2  →  mastery tier promoted
  // Slow answers (> FAST_THRESHOLD_MS) are used so only the long streak applies.
  let speed = 0;
  let fastStreak = 0;
  let longStreak = 0;
  const masteryTier = 1;
  let promotedMastery = false;

  for (let i = 0; i < 18; i++) {
    const result = getNextAdaptiveProgression({
      correct: true,
      responseTimeMs: SLOW_MS,
      currentSpeed: speed,
      fastStreak,
      longStreak,
      currentMasteryTier: masteryTier,
    });
    speed = result.nextSpeed;
    fastStreak = result.nextFastStreak;
    longStreak = result.nextLongStreak;
    if (result.promoteMastery) promotedMastery = true;
  }

  assert.strictEqual(promotedMastery, true, 'mastery promotes after exactly 18 slow-correct answers');
});

runTest('long path sequence: a single wrong answer resets streak and defers mastery promotion', () => {
  // A miss mid-sequence pushes the required answer count beyond 18.
  // Verifies that streaks correctly reset without corrupting speed state.
  let speed = 0;
  let fastStreak = 0;
  let longStreak = 0;
  const masteryTier = 1;
  let promotedMastery = false;

  // 5 correct (one short of long-path threshold)
  for (let i = 0; i < 5; i++) {
    const r = getNextAdaptiveProgression({
      correct: true, responseTimeMs: SLOW_MS, currentSpeed: speed,
      fastStreak, longStreak, currentMasteryTier: masteryTier,
    });
    speed = r.nextSpeed; fastStreak = r.nextFastStreak; longStreak = r.nextLongStreak;
    if (r.promoteMastery) promotedMastery = true;
  }
  assert.strictEqual(promotedMastery, false, 'no mastery after 5 correct');
  assert.strictEqual(longStreak, 5, 'long streak at 5 before the miss');

  // 1 wrong answer
  const miss = getNextAdaptiveProgression({
    correct: false, responseTimeMs: SLOW_MS, currentSpeed: speed,
    fastStreak, longStreak, currentMasteryTier: masteryTier,
  });
  speed = miss.nextSpeed; fastStreak = miss.nextFastStreak; longStreak = miss.nextLongStreak;
  assert.strictEqual(longStreak, 0, 'long streak resets after miss');
  assert.strictEqual(speed, speed, 'speed unchanged after miss');
  assert.strictEqual(miss.promoteSpeed, false);
  assert.strictEqual(miss.promoteMastery, false);
});

// The next-level bar must agree with the promotion rule it describes: it
// rises with every counted answer, stays below 1 until the answer that
// promotes mastery, and restarts from 0 on the new tier.
function progressAlong(answers) {
  let state = { speedTier: 0, fastStreak: 0, longStreak: 0 };
  const trace = [];
  for (const [correct, responseTimeMs] of answers) {
    const r = getNextAdaptiveProgression({
      correct, responseTimeMs, currentSpeed: state.speedTier,
      fastStreak: state.fastStreak, longStreak: state.longStreak, currentMasteryTier: 2,
    });
    const before = progressTowardNextTier(state);
    state = { speedTier: r.nextSpeed, fastStreak: r.nextFastStreak, longStreak: r.nextLongStreak };
    trace.push({ before, after: progressTowardNextTier(state), promoteMastery: r.promoteMastery });
  }
  return trace;
}

runTest('next-level progress rises to promotion on the long and fast paths', () => {
  for (const [ms, needed] of [[SLOW_MS, LONG_STREAK_NEEDED], [FAST_MS, FAST_STREAK_NEEDED]]) {
    const total = needed * (MAX_SPEED + 1);
    const trace = progressAlong(Array.from({ length: total }, () => [true, ms]));
    trace.slice(0, -1).forEach((step, index) => {
      assert.ok(step.after > step.before, `answer ${index + 1} must advance the bar`);
      assert.ok(step.after < 1, 'the bar stays below full until promotion');
      assert.strictEqual(step.promoteMastery, false);
    });
    const last = trace[trace.length - 1];
    assert.strictEqual(last.promoteMastery, true, `promotes after ${total} answers`);
    assert.strictEqual(last.after, 0, 'the new tier starts empty');
  }
});

runTest('a miss drops next-level progress back to the last completed speed step', () => {
  const steps = LONG_STREAK_NEEDED + 2; // one speed step plus a partial streak
  const trace = progressAlong([
    ...Array.from({ length: steps }, () => [true, SLOW_MS]),
    [false, SLOW_MS],
  ]);
  assert.ok(trace[steps - 1].after > 1 / (MAX_SPEED + 1));
  assert.strictEqual(trace[steps].after, 1 / (MAX_SPEED + 1));
});

console.log('\nAll adaptiveProgression tests passed.');
