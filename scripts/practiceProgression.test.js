const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  plain,
  runProgressionScenario,
} = require('./helpers/practiceProgressionHarness');

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'fixtures', 'practice-progression-replay.json'),
    'utf8'
  )
);

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function findStep(replays, scenarioName, label) {
  const replay = replays[scenarioName];
  assert.ok(replay, `missing progression scenario: ${scenarioName}`);
  const step = replay.steps.find((candidate) => candidate.label === label);
  assert.ok(step, `missing progression step: ${scenarioName}/${label}`);
  return step;
}

function buildGoldenReplay(replays) {
  return Object.fromEntries(
    Object.entries(replays).map(([name, replay]) => [
      name,
      {
        answers: replay.steps
          .filter((step) => step.type === 'answer')
          .map((step) => [
            step.label,
            step.playbackRate,
            step.feedbackAfterAnswer,
            step.promotedTierAfterAnswer,
            step.promotionCount,
          ]),
        observations: replay.steps
          .filter((step) => step.type === 'rate-observation')
          .map((step) => [step.label, step.playbackRate, step.promotionCount]),
        masteryChanges: replay.steps
          .filter(
            (step) =>
              step.type === 'answer' &&
              (step.masteryAfter[step.group] ?? 1) >
                (step.masteryBefore[step.group] ?? 1)
          )
          .map((step) => [step.label, step.masteryAfter]),
        remounts: replay.steps
          .filter((step) => step.type === 'remount')
          .map((step) => [step.label, step.mastery, step.promotionCount]),
        ...(replay.lifecycle.hookInstancesMounted > 1
          ? { lifecycle: replay.lifecycle }
          : {}),
      },
    ])
  );
}

module.exports = (async () => {
  const replays = {};
  for (const scenario of fixture.scenarios) {
    replays[scenario.name] = await runProgressionScenario(fixture, scenario);
  }
  const goldenReplay = plain(buildGoldenReplay(replays));

  await runTest('deterministic hook replay matches the committed progression lifecycle', () => {
    assert.ok(
      fixture.expected,
      `Capture this deterministic replay as fixture.expected:\n${JSON.stringify(goldenReplay)}`
    );
    assert.deepStrictEqual(goldenReplay, fixture.expected);
  });

  await runTest('three answers below 5000ms advance each speed tier and the ninth promotes mastery', () => {
    const replay = replays['fast-mastery-ladder'];
    const answerRates = replay.steps
      .filter((step) => step.type === 'answer')
      .map((step) => step.playbackRate);
    assert.deepStrictEqual(answerRates, [
      0.85, 0.85, 0.85,
      1, 1, 1,
      1.15, 1.15, 1.15,
    ]);
    assert.deepStrictEqual(
      findStep(replays, 'fast-mastery-ladder', 'fast-8').masteryAfter,
      { rL: 1, bV: 1 },
      'eight qualifying answers must not promote mastery'
    );
    assert.deepStrictEqual(
      findStep(replays, 'fast-mastery-ladder', 'fast-9-mastery').masteryAfter,
      { rL: 2, bV: 1 },
      'the ninth qualifying answer must promote mastery exactly once'
    );
  });

  await runTest('eighteen 5000ms answers traverse both speeds and promote mastery exactly once', () => {
    const replay = replays['long-mastery-ladder'];
    const answerRates = replay.steps
      .filter((step) => step.type === 'answer')
      .map((step) => step.playbackRate);
    assert.deepStrictEqual(answerRates, [
      0.85, 0.85, 0.85, 0.85, 0.85, 0.85,
      1, 1, 1, 1, 1, 1,
      1.15, 1.15, 1.15, 1.15, 1.15, 1.15,
    ]);
    const beforePromotion = findStep(
      replays,
      'long-mastery-ladder',
      'slow-17'
    );
    assert.deepStrictEqual(beforePromotion.masteryAfter, { rL: 1, bV: 1 });
    assert.strictEqual(beforePromotion.promotedTierAfterAnswer, null);
    assert.strictEqual(beforePromotion.promotionCount, 0);

    const promotion = findStep(
      replays,
      'long-mastery-ladder',
      'slow-18-mastery'
    );
    assert.deepStrictEqual(promotion.masteryAfter, { rL: 2, bV: 1 });
    assert.strictEqual(promotion.promotedTierAfterAnswer, 2);
    assert.strictEqual(promotion.promotionCount, 1);
    assert.strictEqual(promotion.feedbackAfterAnswer, null);
    assert.strictEqual(
      findStep(
        replays,
        'long-mastery-ladder',
        'after-long-mastery-speed-reset'
      ).playbackRate,
      0.85,
      'the first playback after the exact mastery answer must use reset speed'
    );
  });

  await runTest('an incorrect answer clears an established long streak before progression resumes', () => {
    const replay = replays['long-streak-reset'];
    const postMissAnswers = replay.steps.filter(
      (step) => step.type === 'answer' && step.label.startsWith('post-miss-slow')
    );
    assert.deepStrictEqual(
      postMissAnswers.map((step) => step.playbackRate),
      [0.85, 0.85, 0.85, 0.85, 0.85, 0.85],
      'five retained long-streak answers would advance playback before this trace completes'
    );
    assert.deepStrictEqual(
      postMissAnswers.map((step) => step.promotionCount),
      [0, 0, 0, 0, 0, 0]
    );
    assert.strictEqual(
      findStep(
        replays,
        'long-streak-reset',
        'after-post-miss-long-promotion'
      ).playbackRate,
      1,
      'six new slow answers are required after the incorrect answer'
    );
  });

  await runTest('an incorrect answer resets the fast path without demoting speed', () => {
    const miss = findStep(
      replays,
      'fast-reset-without-demotion',
      'miss-resets-fast-streak'
    );
    assert.strictEqual(miss.playbackRate, 1, 'the miss occurs at speed tier one');
    assert.strictEqual(
      findStep(replays, 'fast-reset-without-demotion', 'post-fast-miss-1')
        .playbackRate,
      1,
      'a miss must not demote the earned speed tier'
    );
    assert.strictEqual(
      findStep(replays, 'fast-reset-without-demotion', 'post-fast-miss-2')
        .playbackRate,
      1,
      'two post-miss fast answers must remain below the promotion threshold'
    );
    assert.strictEqual(
      findStep(
        replays,
        'fast-reset-without-demotion',
        'after-post-fast-miss-promotion'
      ).playbackRate,
      1.15,
      'the third post-miss fast answer must promote from speed one to two'
    );
  });

  await runTest('the qualifying answer exposes one promoted tier and resets the next playback', () => {
    const promotion = findStep(
      replays,
      'fast-mastery-ladder',
      'fast-9-mastery'
    );
    assert.strictEqual(
      promotion.feedbackAfterAnswer,
      null,
      'mastery promotion resets the completed round feedback state'
    );
    assert.strictEqual(promotion.promotedTierAfterAnswer, 2);
    assert.strictEqual(promotion.promotionCount, 1);
    assert.strictEqual(
      findStep(
        replays,
        'fast-mastery-ladder',
        'after-mastery-speed-reset'
      ).playbackRate,
      0.85,
      'the first playback after mastery promotion must observe reset speed'
    );
  });

  await runTest('fast progression remains isolated per group within one mounted category', () => {
    assert.strictEqual(
      findStep(replays, 'per-group-fast-isolation', 'bv-fast-2').playbackRate,
      0.85,
      'rL answers must not advance the bV speed threshold'
    );
    assert.strictEqual(
      findStep(replays, 'per-group-fast-isolation', 'bv-after-own-fast-promotion')
        .playbackRate,
      1
    );
    assert.strictEqual(
      findStep(replays, 'per-group-fast-isolation', 'rl-retains-own-fast-speed')
        .playbackRate,
      1
    );
  });

  await runTest('interleaved long streaks advance only their own group', () => {
    assert.strictEqual(
      findStep(
        replays,
        'per-group-long-isolation',
        'bv-before-own-long-promotion'
      ).playbackRate,
      0.85,
      'six rL slow answers must not complete the five-answer bV long streak'
    );
    assert.strictEqual(
      findStep(
        replays,
        'per-group-long-isolation',
        'bv-after-own-long-promotion'
      ).playbackRate,
      1,
      'bV advances only after its own sixth slow answer'
    );
    assert.strictEqual(
      findStep(
        replays,
        'per-group-long-isolation',
        'rl-retains-own-long-speed'
      ).playbackRate,
      1,
      'bV progression must not disturb the speed earned by rL'
    );
  });

  await runTest('category changes preserve same-group progression within a mounted hook', () => {
    assert.strictEqual(
      findStep(
        replays,
        'category-change-same-mount',
        'category-b-sees-carried-speed'
      ).playbackRate,
      1,
      'the current hook does not category-scope progression for shared group IDs'
    );
  });

  await runTest('a new hook instance resets progression without reloading the hook module', () => {
    const replay = replays['same-module-hook-remount'];

    assert.strictEqual(
      findStep(replays, 'same-module-hook-remount', 'earned-speed-before-remount')
        .playbackRate,
      1
    );
    assert.strictEqual(
      findStep(replays, 'same-module-hook-remount', 'initial-speed-after-remount')
        .playbackRate,
      0.85
    );
    assert.deepStrictEqual(replay.lifecycle, {
      hookModuleLoads: 1,
      hookInstancesMounted: 2,
    });
    assert.deepStrictEqual(
      findStep(replays, 'same-module-hook-remount', 'initial-speed-after-remount')
        .mastery,
      { rL: 2 },
      'supplied mastery remains available to the new hook instance'
    );
  });

  await runTest('speed transitions leave mastery unchanged until one qualifying promotion', () => {
    const fastReplay = replays['fast-mastery-ladder'];
    const promotionCounts = fastReplay.steps
      .filter((step) => step.type === 'answer')
      .map((step) => step.promotionCount);
    assert.deepStrictEqual(
      promotionCounts,
      [0, 0, 0, 0, 0, 0, 0, 0, 1],
      'speed and streak transitions must not mutate mastery before readiness'
    );
  });
})();
