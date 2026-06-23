const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  advanceTrialCycleSeenIds,
  applyPracticeAnswer,
  buildTrialPairId,
  buildMasteryForAllGroups,
  choosePlaybackForRound,
  recommendPlacementTier,
  selectNextTrialPair,
  selectVisiblePairsByMastery,
  updateRecentMissState,
  RECENT_MISS_DECAY_TRIALS,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'practiceSession.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const makePair = (group, difficulty, word1 = `${group}${difficulty}a`, word2 = `${group}${difficulty}b`) => ({
  word1,
  word2,
  ipa1: `/a${difficulty}/`,
  ipa2: `/b${difficulty}/`,
  difficulty,
  group,
  position: 'initial',
  contrastPhoneme1: 'a',
  contrastPhoneme2: 'b',
});

runTest('recommendPlacementTier preserves existing placement thresholds', () => {
  assert.strictEqual(recommendPlacementTier(9, 10), 4);
  assert.strictEqual(recommendPlacementTier(7, 10), 3);
  assert.strictEqual(recommendPlacementTier(5, 10), 2);
  assert.strictEqual(recommendPlacementTier(4, 10), 1);
  assert.strictEqual(recommendPlacementTier(0, 0), 1);
});

runTest('selectVisiblePairsByMastery makes mastered-tier group examples visible', () => {
  const pairs = [
    makePair('rL', 1, 'right', 'light'),
    makePair('rL', 2, 'road', 'load'),
    makePair('vW', 1, 'vine', 'wine'),
    makePair('vW', 2, 'vest', 'west'),
  ];

  const visible = selectVisiblePairsByMastery(pairs, { rL: 2 });

  assert.strictEqual(
    JSON.stringify(visible.map((pair) => `${pair.group}:${pair.difficulty}:${pair.word1}/${pair.word2}`)),
    JSON.stringify(['rL:2:road/load', 'vW:1:vine/wine'])
  );
});

runTest('selectVisiblePairsByMastery includes every same-tier example for a mastered group', () => {
  const pairs = [
    makePair('rL', 1, 'right', 'light'),
    makePair('rL', 2, 'road', 'load'),
    makePair('rL', 2, 'rice', 'lice'),
    makePair('vW', 1, 'vine', 'wine'),
  ];

  const visible = selectVisiblePairsByMastery(pairs, { rL: 2 });

  assert.strictEqual(
    JSON.stringify(visible.map((pair) => `${pair.group}:${pair.difficulty}:${pair.word1}/${pair.word2}`)),
    JSON.stringify(['rL:2:road/load', 'rL:2:rice/lice', 'vW:1:vine/wine'])
  );
});

runTest('selectVisiblePairsByMastery falls back to first group pair when mastery tier is missing', () => {
  const pairs = [makePair('rL', 1, 'right', 'light'), makePair('rL', 3, 'rip', 'lip')];

  const visible = selectVisiblePairsByMastery(pairs, { rL: 2 });

  assert.strictEqual(visible.length, 1);
  assert.strictEqual(visible[0].word1, 'right');
});

runTest('buildMasteryForAllGroups clamps placement tier and covers each group', () => {
  const pairs = [makePair('rL', 1), makePair('rL', 2), makePair('vW', 1)];

  assert.strictEqual(JSON.stringify(buildMasteryForAllGroups(pairs, 9)), JSON.stringify({ rL: 6, vW: 6 }));
  assert.strictEqual(JSON.stringify(buildMasteryForAllGroups(pairs, 0)), JSON.stringify({ rL: 1, vW: 1 }));
});

runTest('selectNextTrialPair returns null when no active-group pair exists', () => {
  const pairs = [makePair('vW', 1, 'vine', 'wine')];

  const next = selectNextTrialPair({
    eligiblePairs: pairs,
    activeGroup: 'rL',
    random: () => 0,
  });

  assert.strictEqual(next, null);
});

runTest('selectNextTrialPair returns the only active-group pair', () => {
  const only = makePair('rL', 1, 'right', 'light');
  const pairs = [makePair('vW', 1, 'vine', 'wine'), only];

  const next = selectNextTrialPair({
    eligiblePairs: pairs,
    activeGroup: 'rL',
    random: () => 0.99,
  });

  assert.strictEqual(next, only);
});

runTest('selectNextTrialPair filters out other groups before random selection', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');
  const vineWine = makePair('vW', 1, 'vine', 'wine');

  const next = selectNextTrialPair({
    eligiblePairs: [vineWine, rightLight, riceLice],
    activeGroup: 'rL',
    random: () => 0.99,
  });

  assert.strictEqual(next, riceLice);
});

runTest('selectNextTrialPair avoids immediate repeat when alternatives exist', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');

  const next = selectNextTrialPair({
    eligiblePairs: [rightLight, riceLice],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(rightLight),
    random: () => 0,
  });

  assert.strictEqual(next, riceLice);
});

runTest('selectNextTrialPair selects unseen same-tier pairs before repeats', () => {
  const rightLight = makePair('rL', 2, 'right', 'light');
  const riceLice = makePair('rL', 2, 'rice', 'lice');
  const roadLoad = makePair('rL', 2, 'road', 'load');

  const next = selectNextTrialPair({
    eligiblePairs: [rightLight, riceLice, roadLoad],
    activeGroup: 'rL',
    seenThisCycle: [buildTrialPairId(rightLight)],
    random: () => 0,
  });

  assert.strictEqual(next, riceLice);
});

runTest('selectNextTrialPair allows repeats after all active-group pairs have been seen', () => {
  const rightLight = makePair('rL', 2, 'right', 'light');
  const riceLice = makePair('rL', 2, 'rice', 'lice');

  const next = selectNextTrialPair({
    eligiblePairs: [rightLight, riceLice],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(rightLight),
    seenThisCycle: [buildTrialPairId(rightLight), buildTrialPairId(riceLice)],
    random: () => 0,
  });

  assert.strictEqual(next, riceLice);
});

runTest('selectNextTrialPair uses injected random function deterministically', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');
  const roadLoad = makePair('rL', 1, 'road', 'load');

  const next = selectNextTrialPair({
    eligiblePairs: [rightLight, riceLice, roadLoad],
    activeGroup: 'rL',
    random: () => 0.66,
  });

  assert.strictEqual(next, riceLice);
});

runTest('selectNextTrialPair does not mutate inputs', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');
  const pairs = [rightLight, riceLice, makePair('vW', 1, 'vine', 'wine')];
  const seenThisCycle = [buildTrialPairId(rightLight)];
  const beforePairs = JSON.stringify(pairs);
  const beforeSeen = JSON.stringify(seenThisCycle);

  selectNextTrialPair({
    eligiblePairs: pairs,
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(rightLight),
    seenThisCycle,
    random: () => 0,
  });

  assert.strictEqual(JSON.stringify(pairs), beforePairs);
  assert.strictEqual(JSON.stringify(seenThisCycle), beforeSeen);
});

runTest('selectNextTrialPair leaves group-based mastery selection unchanged', () => {
  const pairs = [
    makePair('rL', 1, 'right', 'light'),
    makePair('rL', 2, 'rice', 'lice'),
    makePair('rL', 2, 'road', 'load'),
    makePair('vW', 1, 'vine', 'wine'),
  ];
  const visible = selectVisiblePairsByMastery(pairs, { rL: 2 });

  const next = selectNextTrialPair({
    eligiblePairs: visible,
    activeGroup: 'rL',
    random: () => 0.99,
  });

  assert.strictEqual(next.word1, 'road');
  assert.strictEqual(next.group, 'rL');
  assert.strictEqual(next.difficulty, 2);
});

runTest('advanceTrialCycleSeenIds records selected pair without mutating existing seen ids', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');
  const roadLoad = makePair('rL', 1, 'road', 'load');
  const seenThisCycle = [buildTrialPairId(rightLight)];
  const beforeSeen = JSON.stringify(seenThisCycle);

  const nextSeen = advanceTrialCycleSeenIds({
    activeGroupPairs: [rightLight, riceLice, roadLoad],
    selectedPair: riceLice,
    seenThisCycle,
  });

  assert.strictEqual(JSON.stringify(seenThisCycle), beforeSeen);
  assert.strictEqual(
    JSON.stringify(nextSeen.sort()),
    JSON.stringify([buildTrialPairId(riceLice), buildTrialPairId(rightLight)].sort())
  );
});

runTest('advanceTrialCycleSeenIds starts a new cycle after every active-group pair has been seen', () => {
  const rightLight = makePair('rL', 1, 'right', 'light');
  const riceLice = makePair('rL', 1, 'rice', 'lice');

  const nextSeen = advanceTrialCycleSeenIds({
    activeGroupPairs: [rightLight, riceLice],
    selectedPair: riceLice,
    seenThisCycle: [buildTrialPairId(rightLight)],
  });

  assert.strictEqual(JSON.stringify(nextSeen), JSON.stringify([]));
});

runTest('choosePlaybackForRound replays the same word during an unanswered round', () => {
  assert.strictEqual(
    JSON.stringify(choosePlaybackForRound({ playedIdx: 1, feedback: null, randomValue: 0.1 })),
    JSON.stringify({ playedIdx: 1, startsNewRound: false })
  );
});

runTest('choosePlaybackForRound starts a new deterministic round after feedback', () => {
  assert.strictEqual(
    JSON.stringify(choosePlaybackForRound({ playedIdx: 1, feedback: 'correct', randomValue: 0.49 })),
    JSON.stringify({ playedIdx: 0, startsNewRound: true })
  );
  assert.strictEqual(
    JSON.stringify(choosePlaybackForRound({ playedIdx: null, feedback: null, randomValue: 0.5 })),
    JSON.stringify({ playedIdx: 1, startsNewRound: true })
  );
});

runTest('applyPracticeAnswer returns null before a word has been played or selected', () => {
  const pair = makePair('rL', 1, 'right', 'light');

  assert.strictEqual(
    applyPracticeAnswer({
      selectedPair: undefined,
      category: 'Test',
      answerIdx: 0,
      playedIdx: 0,
      startTime: 1000,
      nowMs: 1500,
      currentSpeed: 0,
      fastStreak: 0,
      longStreak: 0,
      currentMasteryTier: 1,
    }),
    null
  );
  assert.strictEqual(
    applyPracticeAnswer({
      selectedPair: pair,
      category: 'Test',
      answerIdx: 0,
      playedIdx: null,
      startTime: 1000,
      nowMs: 1500,
      currentSpeed: 0,
      fastStreak: 0,
      longStreak: 0,
      currentMasteryTier: 1,
    }),
    null
  );
});

runTest('applyPracticeAnswer treats zero startTime as a real timestamp', () => {
  const pair = makePair('rL', 1, 'right', 'light');

  const result = applyPracticeAnswer({
    selectedPair: pair,
    category: 'Test',
    answerIdx: 0,
    playedIdx: 0,
    startTime: 0,
    nowMs: 2500,
    currentSpeed: 0,
    fastStreak: 0,
    longStreak: 0,
    currentMasteryTier: 1,
  });

  assert.strictEqual(result.responseTimeMs, 2500);
  assert.strictEqual(result.durationMin, 2500 / 60000);
});

runTest('applyPracticeAnswer does not mutate its input pair or input object', () => {
  const pair = makePair('rL', 1, 'right', 'light');
  const input = {
    selectedPair: pair,
    category: 'Test',
    answerIdx: 0,
    playedIdx: 0,
    startTime: 1000,
    nowMs: 4500,
    currentSpeed: 0,
    fastStreak: 1,
    longStreak: 1,
    currentMasteryTier: 1,
  };
  const beforePair = JSON.stringify(pair);
  const beforeInput = JSON.stringify(input);

  applyPracticeAnswer(input);

  assert.strictEqual(JSON.stringify(pair), beforePair);
  assert.strictEqual(JSON.stringify(input), beforeInput);
});

runTest('applyPracticeAnswer advances fast streak and promotes speed on fast correct answers', () => {
  const pair = makePair('rL', 1, 'right', 'light');

  const result = applyPracticeAnswer({
    selectedPair: pair,
    category: 'Test',
    answerIdx: 0,
    playedIdx: 0,
    startTime: 1000,
    nowMs: 4500,
    currentSpeed: 0,
    fastStreak: 2,
    longStreak: 2,
    currentMasteryTier: 1,
  });

  assert.strictEqual(result.correct, true);
  assert.strictEqual(result.feedback, 'correct');
  assert.strictEqual(result.responseTimeMs, 3500);
  assert.strictEqual(result.durationMin, 3500 / 60000);
  assert.strictEqual(result.pairId, 'Test__rL__right_light');
  assert.strictEqual(result.nextSpeed, 1);
  assert.strictEqual(result.nextFastStreak, 0);
  assert.strictEqual(result.nextLongStreak, 0);
  assert.strictEqual(result.promoteSpeed, true);
  assert.strictEqual(result.promoteMastery, false);
  assert.strictEqual(result.promotedTier, null);
  assert.strictEqual(result.resetPairIndex, false);
});

runTest('applyPracticeAnswer resets streaks after incorrect answers without demoting speed', () => {
  const pair = makePair('rL', 1, 'right', 'light');

  const result = applyPracticeAnswer({
    selectedPair: pair,
    category: 'Test',
    answerIdx: 1,
    playedIdx: 0,
    startTime: 1000,
    nowMs: 6500,
    currentSpeed: 2,
    fastStreak: 2,
    longStreak: 5,
    currentMasteryTier: 3,
  });

  assert.strictEqual(result.correct, false);
  assert.strictEqual(result.feedback, 'incorrect');
  assert.strictEqual(result.nextSpeed, 2);
  assert.strictEqual(result.nextFastStreak, 0);
  assert.strictEqual(result.nextLongStreak, 0);
  assert.strictEqual(result.promoteSpeed, false);
  assert.strictEqual(result.promoteMastery, false);
});

runTest('applyPracticeAnswer promotes mastery and resets speed at max speed', () => {
  const pair = makePair('rL', 3, 'rip', 'lip');

  const result = applyPracticeAnswer({
    selectedPair: pair,
    category: 'Test',
    answerIdx: 0,
    playedIdx: 0,
    startTime: 1000,
    nowMs: 2500,
    currentSpeed: 2,
    fastStreak: 2,
    longStreak: 2,
    currentMasteryTier: 3,
  });

  assert.strictEqual(result.promoteSpeed, false);
  assert.strictEqual(result.promoteMastery, true);
  assert.strictEqual(result.nextSpeed, 0);
  assert.strictEqual(result.promotedTier, 4);
  assert.strictEqual(result.resetPairIndex, true);
});

// ─── Characterization: contrast-group as the mastery unit ─────────────────
//
// These tests lock in the invariant that mastery is keyed by contrast group,
// not by individual word pair. A future algorithm change that accidentally
// promotes a pair's mastery independently of its group would break them.

runTest('mastery tier is applied per contrast group — all pairs in the same group share one tier', () => {
  // Invariant: two pairs with the same group ID share one mastery tier.
  // selectVisiblePairsByMastery must use pair.group as the key, not pair position.
  const pairs = [
    makePair('rL', 1, 'rake', 'lake'),
    makePair('rL', 2, 'rate', 'late'),
    makePair('rL', 3, 'rip', 'lip'),
  ];
  // mastery['rL'] = 2 → all rL pairs resolve to difficulty-2 tier
  const visible = selectVisiblePairsByMastery(pairs, { rL: 2 });
  assert.strictEqual(visible.length, 1, 'only the one difficulty-2 pair is visible');
  assert.strictEqual(visible[0].word1, 'rate', 'the difficulty-2 pair is the visible one');
  assert.strictEqual(visible[0].group, 'rL', 'the visible pair belongs to the rL group');
});

runTest('mastery tier resolution is unaffected by the order pairs appear within a group', () => {
  // Invariant: reordering pairs within the same group must not change which pairs
  // are visible. The key is pair.group, not array position.
  const pairs = [
    makePair('rL', 1, 'rake', 'lake'),
    makePair('rL', 2, 'rate', 'late'),
  ];
  const pairsReversed = [
    makePair('rL', 2, 'rate', 'late'),
    makePair('rL', 1, 'rake', 'lake'),
  ];
  const mastery = { rL: 2 };

  const visibleNormal = selectVisiblePairsByMastery(pairs, mastery);
  const visibleReversed = selectVisiblePairsByMastery(pairsReversed, mastery);

  assert.strictEqual(visibleNormal.length, 1);
  assert.strictEqual(visibleReversed.length, 1);
  assert.strictEqual(
    visibleNormal[0].word1,
    visibleReversed[0].word1,
    'same pair is visible regardless of input order',
  );
  assert.strictEqual(
    visibleNormal[0].group,
    visibleReversed[0].group,
    'group identity is unaffected by pair order',
  );
});

runTest('mastery for two different groups is tracked independently', () => {
  // Two groups at different tiers should each expose the correct tier pairs.
  const pairs = [
    makePair('rL', 1, 'rake', 'lake'),
    makePair('rL', 2, 'rate', 'late'),
    makePair('bV', 1, 'ban', 'van'),
    makePair('bV', 2, 'berry', 'very'),
  ];
  const visible = selectVisiblePairsByMastery(pairs, { rL: 2, bV: 1 });

  const rLVisible = visible.filter((p) => p.group === 'rL');
  const bVVisible = visible.filter((p) => p.group === 'bV');

  assert.strictEqual(rLVisible.length, 1);
  assert.strictEqual(rLVisible[0].word1, 'rate', 'rL shows difficulty-2 pair');
  assert.strictEqual(bVVisible.length, 1);
  assert.strictEqual(bVVisible[0].word1, 'ban', 'bV shows difficulty-1 pair');
});

// ─── Characterization: single-pair tier limitation ────────────────────────
//
// When a contrast group has only one pair at the current difficulty tier,
// the scheduler CANNOT produce within-tier variety. Immediate repeat is
// unavoidable. This is a DATASET LIMITATION, not a scheduler defect.
// These tests document that boundary explicitly.

runTest('single-pair tier: scheduler returns the sole pair on every call — dataset limitation, not a bug', () => {
  // A group like bV (tier 1: ban/van only) cannot provide variety.
  // The scheduler correctly falls back to the only available pair.
  const onlyPair = makePair('bV', 1, 'ban', 'van');

  const first = selectNextTrialPair({
    eligiblePairs: [onlyPair],
    activeGroup: 'bV',
    random: () => 0,
  });
  // Supply the only pair as lastPairId to simulate consecutive plays
  const second = selectNextTrialPair({
    eligiblePairs: [onlyPair],
    activeGroup: 'bV',
    lastPairId: buildTrialPairId(onlyPair),
    random: () => 0,
  });

  assert.strictEqual(first, onlyPair, 'scheduler returns the only eligible pair');
  assert.strictEqual(second, onlyPair, 'scheduler returns the same pair again — unavoidable with one pair at this tier');
  assert.notStrictEqual(first, null, 'scheduler does not return null for a single-pair tier');
});

runTest('single-pair tier: seenThisCycle resets immediately after the only pair is seen', () => {
  // With one pair in the group, the cycle resets after every play.
  // This means seenThisCycle stays empty — it never blocks the only pair.
  const onlyPair = makePair('bV', 1, 'ban', 'van');

  const nextSeen = advanceTrialCycleSeenIds({
    activeGroupPairs: [onlyPair],
    selectedPair: onlyPair,
    seenThisCycle: [],
  });

  // Use JSON.stringify to avoid cross-realm array comparison issues (loadTsModule VM context).
  assert.strictEqual(JSON.stringify(nextSeen), '[]', 'cycle resets immediately when the only pair is seen');
});

// ─── Characterization: full cycle coverage with multiple same-tier pairs ──

runTest('full cycle with three same-tier pairs surfaces each exactly once before any repeat', () => {
  // Extends no-repeat coverage to N=3 pairs.
  // Each pair must appear before any is repeated in a single cycle.
  const p1 = makePair('rL', 2, 'rate', 'late');
  const p2 = makePair('rL', 2, 'rice', 'lice');
  const p3 = makePair('rL', 2, 'road', 'load');
  const eligiblePairs = [p1, p2, p3];

  let lastPairId = null;
  let seenThisCycle = [];
  const seenInCycle = new Set();

  for (let i = 0; i < 3; i++) {
    const next = selectNextTrialPair({
      eligiblePairs,
      activeGroup: 'rL',
      lastPairId,
      seenThisCycle,
      random: () => 0,
    });
    assert.ok(next !== null, `trial ${i + 1}: scheduler returned a pair`);
    const nextId = buildTrialPairId(next);
    assert.ok(!seenInCycle.has(nextId), `pair ${nextId} should not have appeared yet this cycle`);
    seenInCycle.add(nextId);

    seenThisCycle = advanceTrialCycleSeenIds({
      activeGroupPairs: eligiblePairs,
      selectedPair: next,
      seenThisCycle,
    });
    lastPairId = nextId;
  }

  assert.strictEqual(seenInCycle.size, 3, 'all three pairs appear exactly once per cycle');
  // Use JSON.stringify to avoid cross-realm array comparison issues (loadTsModule VM context).
  assert.strictEqual(JSON.stringify(seenThisCycle), '[]', 'cycle resets after all pairs have been seen');
});

// ─── Bounded missed-pair weighting ────────────────────────────────────────────
//
// These tests define the boost policy:
//   - Coverage phase (unseen pairs exist): boost is ignored; unseen pairs win.
//   - All-seen phase: recently missed pair is selected before neutral seen pairs.
//   - No-immediate-repeat rule outranks boost: missed pair cannot be last pair.
//   - Boost decays after RECENT_MISS_DECAY_TRIALS subsequent answered trials.
//   - Correct answer on the missed pair clears boost immediately.
//   - A new miss overrides the previous missed pair.

runTest('selectNextTrialPair: unseen pair wins over recently missed pair in coverage phase', () => {
  // Even when pairA is marked as recently missed, pairB (unseen) takes priority.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // recently missed, already seen
  const pairB = makePair('rL', 2, 'rate', 'late');   // unseen
  const pairC = makePair('rL', 2, 'rip', 'lip');     // seen

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB, pairC],
    activeGroup: 'rL',
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairC)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0,
  });

  assert.strictEqual(next, pairB, 'unseen pair wins over missed-pair boost during coverage phase');
});

runTest('selectNextTrialPair: recently missed pair is preferred once all same-tier pairs have been seen', () => {
  // All pairs seen. random: () => 0.99 would pick pairC (index 1 of [pairA, pairC])
  // without boost, but boost must override and return pairA.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // recently missed
  const pairB = makePair('rL', 2, 'rate', 'late');   // last shown (excluded by lastPairId)
  const pairC = makePair('rL', 2, 'rip', 'lip');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB, pairC],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairB),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB), buildTrialPairId(pairC)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0.99,  // would pick pairC without boost
  });

  assert.strictEqual(next, pairA, 'missed pair is preferred in all-seen phase');
});

runTest('selectNextTrialPair: missed pair is not chosen when it was the immediately previous pair', () => {
  // lastPairId === recentlyMissedPairId: no-repeat rule outranks boost.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // missed AND just shown
  const pairB = makePair('rL', 2, 'rate', 'late');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairA),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0,
  });

  assert.strictEqual(next, pairB, 'no-repeat rule blocks missed-pair boost when pair was just shown');
});

runTest('updateRecentMissState: boost expires after RECENT_MISS_DECAY_TRIALS subsequent correct answers', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  // Record a miss on pairA.
  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA), 'miss is recorded');
  assert.strictEqual(state.trialsSinceMiss, 0, 'trialsSinceMiss initializes to 0 on first miss');

  // Answer pairB correctly (RECENT_MISS_DECAY_TRIALS - 1) times — boost still active.
  for (let i = 0; i < RECENT_MISS_DECAY_TRIALS - 1; i++) {
    state = updateRecentMissState({
      state,
      answeredPairId: buildTrialPairId(pairB),
      wasCorrect: true,
    });
    assert.ok(state.recentlyMissedPairId !== null, `boost still active after ${i + 1} correct answers on other pair`);
  }

  // One final correct answer on pairB → decay threshold reached → boost clears.
  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairB),
    wasCorrect: true,
  });
  assert.strictEqual(state.recentlyMissedPairId, null, 'boost expires after RECENT_MISS_DECAY_TRIALS trials');
  assert.strictEqual(state.trialsSinceMiss, 0, 'counter resets after expiry');
});

runTest('updateRecentMissState: correct answer on the missed pair clears boost immediately', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');

  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA), 'miss is recorded on pairA before clearing');

  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: true,
  });
  assert.strictEqual(state.recentlyMissedPairId, null, 'correct answer on missed pair clears boost');
  assert.strictEqual(state.trialsSinceMiss, 0, 'trialsSinceMiss resets when boost is cleared by correct answer');
});

runTest('selectNextTrialPair: no boost applied when recentlyMissedPairId is null — random selection governs', () => {
  // With null recentlyMissedPairId, behavior is unchanged from the existing scheduler.
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairA),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB)],
    recentlyMissedPairId: null,
    random: () => 0,
  });

  // repeatSafePairs = [pairB]; random: () => 0 → pairB.
  assert.strictEqual(next, pairB, 'null recentlyMissedPairId leaves selection to random');
});

runTest('updateRecentMissState: a new incorrect answer overrides the previous missed pair', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA), 'initial miss on pairA is recorded');

  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairB),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairB), 'new miss overrides old missed pair');
  assert.strictEqual(state.trialsSinceMiss, 0, 'trial counter resets on new miss');
});
