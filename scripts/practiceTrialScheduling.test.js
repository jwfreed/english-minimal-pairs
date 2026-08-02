const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  createPracticeTrialSchedulingHarness,
  plain,
} = require('./helpers/practiceTrialSchedulingHarness');

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      'fixtures',
      'practice-trial-scheduling-replay.json'
    ),
    'utf8'
  )
);

// Phase 4.1 scheduling invariant map:
// - This hook replay covers I0, I5-I8, I10-I11, and I16-I18.
// - scripts/practiceSession.test.js remains the behavioral authority for the
//   pure scheduling rules I1-I4, I9, and I12-I15.

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function eventTypes(events) {
  return events.map((event) => event.type);
}

function findStep(replay, label) {
  const step = replay.steps.find((candidate) => candidate.label === label);
  assert.ok(step, `missing replay step: ${label}`);
  return step;
}

async function playAndRender(scenario) {
  const eventStart = scenario.events.length;
  await scenario.current.handlePlay();
  const beforeRenderEnd = scenario.events.length;
  const immediateEvents = scenario.events.slice(eventStart, beforeRenderEnd);
  scenario.render();
  const renderEvents = scenario.events.slice(beforeRenderEnd);

  return {
    immediateEventTypes: eventTypes(immediateEvents),
    renderEventTypes: eventTypes(renderEvents),
  };
}

async function runReplay(replayFixture) {
  const scenario = createPracticeTrialSchedulingHarness(replayFixture);
  scenario.render();
  const initialEventTypes = eventTypes(scenario.events);
  const steps = [];

  for (const action of replayFixture.actions) {
    const eventStart = scenario.events.length;
    const playObservations = [];

    if (action.type === 'round' || action.type === 'play-only') {
      playObservations.push(await playAndRender(scenario));

      if (action.replayBeforeAnswer) {
        playObservations.push(await playAndRender(scenario));
      }

      if (action.type === 'round') {
        const playedIdx = scenario.current.playedIdx;
        assert.notStrictEqual(
          playedIdx,
          null,
          `${action.label}: round must expose a played index before answer`
        );
        scenario.advanceClock(action.responseMs);
        const answerIdx =
          action.answer === 'correct' ? playedIdx : playedIdx === 0 ? 1 : 0;
        scenario.current.handleAnswer(answerIdx);
        scenario.render();
      }
    } else if (action.type === 'manual-select') {
      const index = scenario.current.stableVisible.findIndex(
        (pair) => scenario.buildPairId(pair) === action.pairId
      );
      assert.notStrictEqual(
        index,
        -1,
        `${action.label}: manual pair must be visible`
      );
      scenario.current.handlePairChange(index);
      scenario.render();
    } else if (action.type === 'mastery-replace') {
      scenario.replaceMastery(
        action.category,
        action.mastery,
        action.reason
      );
      scenario.render();
    } else if (action.type === 'target') {
      scenario.setTarget(action.group);
      scenario.render();
    } else if (action.type === 'category-switch') {
      scenario.setCategory(action.category);
      scenario.render();
    } else {
      throw new Error(`Unsupported replay action: ${action.type}`);
    }

    const actionEvents = scenario.events.slice(eventStart);
    steps.push({
      label: action.label,
      type: action.type,
      selectedPairId: scenario.buildPairId(scenario.current.selectedPair),
      feedback: scenario.current.feedback,
      playedIdx: scenario.current.playedIdx,
      promotedTier: scenario.current.promotedTier,
      mastery: scenario.mastery,
      randomDrawCount: scenario.randomDrawCount,
      presentedPairIds: actionEvents
        .filter((event) => event.type === 'pair-presented')
        .map((event) => event.pairId),
      answerResponseTimes: actionEvents
        .filter((event) => event.type === 'answer-submitted')
        .map((event) => event.responseTimeMs),
      selectionInputs: actionEvents
        .filter((event) => event.type === 'selection-input')
        .map((event) => ({
          activeGroup: event.activeGroup,
          eligiblePairIds: event.eligiblePairIds,
          lastPairId: event.lastPairId,
          seenThisCycle: event.seenThisCycle,
          recentlyMissedPairId: event.recentlyMissedPairId,
        })),
      eventTypes: eventTypes(actionEvents),
      playObservations,
    });
  }

  return {
    initialEventTypes,
    presentedPairIds: scenario.events
      .filter((event) => event.type === 'pair-presented')
      .map((event) => event.pairId),
    randomDrawValues: scenario.events
      .filter((event) => event.type === 'random-draw')
      .map((event) => event.value),
    steps,
  };
}

function buildGoldenReplay(replay) {
  let previousMastery = null;
  const masteryChanges = [];
  for (const step of replay.steps) {
    const serializedMastery = JSON.stringify(step.mastery);
    if (serializedMastery !== previousMastery) {
      masteryChanges.push([step.label, step.mastery]);
      previousMastery = serializedMastery;
    }
  }

  const selectionTransitions = replay.steps.flatMap((step) =>
    step.selectionInputs.map((input) => [step.label, input])
  );
  let previousEligibleSet = null;
  const eligibleSetChanges = [];
  for (const [label, input] of selectionTransitions) {
    const serializedEligibleSet = JSON.stringify(input.eligiblePairIds);
    if (serializedEligibleSet !== previousEligibleSet) {
      eligibleSetChanges.push([label, input.eligiblePairIds]);
      previousEligibleSet = serializedEligibleSet;
    }
  }

  return {
    initialEventTypes: replay.initialEventTypes,
    presentedPairIds: replay.presentedPairIds,
    randomDrawValues: replay.randomDrawValues,
    uiStateAfterSteps: replay.steps.map((step) => [
      step.label,
      step.selectedPairId,
      step.feedback,
      step.playedIdx,
      step.promotedTier,
      step.randomDrawCount,
    ]),
    masteryChanges,
    eligibleSetChanges,
    schedulingStateTransitions: selectionTransitions.map(([label, input]) =>
      [
        label,
        input.activeGroup,
        input.lastPairId,
        input.seenThisCycle,
        input.recentlyMissedPairId,
      ]
    ),
    playbackTrace: replay.steps
      .filter((step) => step.playObservations.length > 0)
      .map((step) => [
        step.label,
        step.playedIdx,
        step.presentedPairIds,
        step.randomDrawCount,
        step.playObservations.map((observation) =>
          observation.immediateEventTypes.includes('audio-played')
            ? 'immediate'
            : observation.renderEventTypes.includes('audio-played')
              ? 'deferred'
              : 'none'
        ),
      ]),
  };
}

module.exports = (async () => {
  const replay = await runReplay(fixture);
  const goldenReplay = buildGoldenReplay(replay);

  await runTest('deterministic hook replay matches the committed scheduling trace', () => {
    assert.ok(
      fixture.expected,
      `Capture this deterministic replay as fixture.expected:\n${JSON.stringify(goldenReplay)}`
    );
    assert.deepStrictEqual(plain(goldenReplay), fixture.expected);
  });

  await runTest('replay rounds eagerly consume playback randomness without rescheduling', () => {
    const step = findStep(replay, 'r1-fast-correct-with-replay');
    assert.strictEqual(step.playObservations.length, 2);
    assert.strictEqual(step.randomDrawCount, 3);
    assert.strictEqual(step.selectionInputs.length, 1);
    assert.ok(
      step.playObservations[1].immediateEventTypes.includes('random-draw'),
      'the unanswered replay must consume its eager playback draw'
    );
    assert.ok(
      step.playObservations[1].immediateEventTypes.includes('round-replayed'),
      'the second play must remain in the current round'
    );
  });

  await runTest('scheduling query and events precede conditional presentation', () => {
    const step = findStep(replay, 'r1-fast-correct-with-replay');
    const firstPlayEvents = step.playObservations[0].immediateEventTypes;
    assert.deepStrictEqual(
      firstPlayEvents.filter((event) => event.startsWith('trial-scheduling-')),
      [
        'trial-scheduling-query',
        'trial-scheduling-round-started',
        'trial-scheduling-trial-presented',
      ],
      'scheduling must query before consuming the override and recording presentation'
    );
    assert.ok(firstPlayEvents.includes('mark-scheduled-pair'));
    assert.ok(firstPlayEvents.includes('pair-presented'));
    assert.ok(
      firstPlayEvents.indexOf('mark-scheduled-pair') <
        firstPlayEvents.indexOf('pair-presented'),
      'scheduling state must commit before presentation analytics observes it'
    );

    const emptyStep = findStep(replay, 'round-without-presentation');
    assert.deepStrictEqual(
      emptyStep.eventTypes.filter((event) =>
        event.startsWith('trial-scheduling-')
      ),
      ['trial-scheduling-query', 'trial-scheduling-round-started'],
      'an empty round must consume the override without recording presentation'
    );
    assert.ok(!emptyStep.eventTypes.includes('pair-presented'));
  });

  await runTest('feedback state commits before answer observers run', () => {
    const step = findStep(replay, 'r2-fast-correct');
    assert.ok(
      step.eventTypes.indexOf('feedback-committed') <
        step.eventTypes.indexOf('attempt-recorded')
    );
    assert.ok(
      step.eventTypes.indexOf('feedback-committed') <
        step.eventTypes.indexOf('answer-submitted')
    );
  });

  await runTest('active-set refresh and promotion preserve their distinct reset shapes', () => {
    const refreshStep = findStep(
      replay,
      'same-contrast-active-set-refresh'
    );
    assert.deepStrictEqual(refreshStep.selectionInputs, []);

    const afterRefresh = findStep(replay, 'r7-miss').selectionInputs[0];
    assert.ok(afterRefresh.lastPairId, 'last pair remains in the unchanged active set');
    assert.deepStrictEqual(afterRefresh.seenThisCycle, []);
    assert.strictEqual(afterRefresh.recentlyMissedPairId, null);

    const promotionStep = findStep(replay, 'r10-mastery-promotion');
    assert.ok(promotionStep.eventTypes.includes('mastery-promoted'));
    assert.deepStrictEqual(promotionStep.answerResponseTimes, [1000]);
    assert.ok(
      !findStep(replay, 'r9-fast-correct').eventTypes.includes(
        'mastery-promoted'
      ),
      'the script-controlled clock must not promote one round early'
    );
    const afterPromotion = findStep(
      replay,
      'r11-after-promotion-reset'
    ).selectionInputs[0];
    assert.strictEqual(afterPromotion.lastPairId, null);
    assert.deepStrictEqual(afterPromotion.seenThisCycle, []);
    assert.strictEqual(afterPromotion.recentlyMissedPairId, null);
  });

  await runTest('manual selection owns one round and session resets disarm it', () => {
    const manualRound = findStep(replay, 'manual-owned-round');
    const resumedRound = findStep(replay, 'scheduling-resumes');
    assert.strictEqual(manualRound.selectionInputs.length, 0);
    assert.strictEqual(resumedRound.selectionInputs.length, 1);

    const targetRound = findStep(replay, 'round-after-target-reset');
    assert.strictEqual(targetRound.selectionInputs[0].lastPairId, null);
    assert.deepStrictEqual(targetRound.selectionInputs[0].seenThisCycle, []);
    assert.strictEqual(
      targetRound.selectionInputs[0].recentlyMissedPairId,
      null
    );

    const categoryRound = findStep(replay, 'round-after-category-reset');
    assert.strictEqual(categoryRound.selectionInputs[0].lastPairId, null);
    assert.deepStrictEqual(categoryRound.selectionInputs[0].seenThisCycle, []);
    assert.strictEqual(
      categoryRound.selectionInputs[0].recentlyMissedPairId,
      null
    );
  });

  await runTest('deferred playback occurs only after the scheduled pair renders', () => {
    const deferredRound = findStep(replay, 'r1-fast-correct-with-replay')
      .playObservations[0];
    assert.ok(!deferredRound.immediateEventTypes.includes('audio-played'));
    assert.ok(deferredRound.renderEventTypes.includes('audio-played'));

    const synchronousRound = findStep(replay, 'single-pair-scheduled-round')
      .playObservations[0];
    assert.ok(synchronousRound.immediateEventTypes.includes('audio-played'));
    assert.deepStrictEqual(synchronousRound.renderEventTypes, []);
  });

  await runTest('deferred playback remains pending while the rendered pair id mismatches', async () => {
    const scenario = createPracticeTrialSchedulingHarness(fixture);
    scenario.render();

    await scenario.current.handlePlay();
    assert.ok(
      scenario.events.some((event) => event.type === 'pair-presented'),
      'the different pair must be scheduled and presented before rendering'
    );
    assert.ok(
      !scenario.events.some((event) => event.type === 'audio-played'),
      'the different pair must not play synchronously'
    );

    const mismatchStart = scenario.events.length;
    scenario.replaceMastery(
      'Test A',
      { rL: 2, bV: 1 },
      'deferred-playback-mismatch'
    );
    scenario.render();
    assert.ok(
      !scenario.events
        .slice(mismatchStart)
        .some((event) => event.type === 'audio-played'),
      'a mismatched selected pair must leave playback unplayed'
    );

    const restoreStart = scenario.events.length;
    scenario.replaceMastery(
      'Test A',
      { rL: 1, bV: 1 },
      'restore-scheduled-pair'
    );
    scenario.render();
    const resumedPlayback = scenario.events
      .slice(restoreStart)
      .find((event) => event.type === 'audio-played');
    assert.strictEqual(
      resumedPlayback?.pairId,
      'rL:rock:lock',
      'the original deferred request remains pending until its pair renders again'
    );
  });

  await runTest('scheduler reads the live visible set while picker data stays frozen', async () => {
    const scenario = createPracticeTrialSchedulingHarness(fixture);
    scenario.render();
    scenario.current.handlePickerScrollStart();
    scenario.replaceMastery(
      'Test A',
      { rL: 2, bV: 1 },
      'picker-scroll-live-visible-check'
    );
    scenario.render();

    const eventStart = scenario.events.length;
    await scenario.current.handlePlay();
    const selectionInput = scenario.events
      .slice(eventStart)
      .find((event) => event.type === 'selection-input');
    assert.deepStrictEqual(selectionInput?.eligiblePairIds, [
      'rL:rake:lake',
      'bV:ban:van',
    ]);
    assert.strictEqual(
      scenario.current.stableVisible.length,
      6,
      'the picker snapshot remains at the pre-scroll eligible set'
    );
  });
})();
