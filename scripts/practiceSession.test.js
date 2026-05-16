const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  applyPracticeAnswer,
  buildMasteryForAllGroups,
  choosePlaybackForRound,
  recommendPlacementTier,
  selectVisiblePairsByMastery,
} = loadTsModule(path.join(__dirname, '..', 'app', 'domain', 'practiceSession.ts'));

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

runTest('selectVisiblePairsByMastery picks one pair per group at the mastered tier', () => {
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
