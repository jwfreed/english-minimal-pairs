const assert = require('assert');

const {
  createPracticeTrialSchedulingHarness,
  plain,
} = require('./practiceTrialSchedulingHarness');

function findVisibleGroupIndex(scenario, group) {
  return scenario.current.stableVisible.findIndex(
    (pair) => pair.group === group
  );
}

function selectGroup(scenario, group) {
  if (scenario.current.selectedPair?.group === group) return;

  const index = findVisibleGroupIndex(scenario, group);
  assert.notStrictEqual(index, -1, `group ${group} must be visible`);
  scenario.current.handlePairChange(index);
  scenario.render();
  assert.strictEqual(
    scenario.current.selectedPair?.group,
    group,
    `manual selection must expose group ${group}`
  );
}

async function presentRound(scenario) {
  const eventStart = scenario.events.length;
  await scenario.current.handlePlay();
  scenario.render();

  const playbackEvents = scenario.events
    .slice(eventStart)
    .filter((event) => event.type === 'audio-played');
  assert.strictEqual(
    playbackEvents.length,
    1,
    'each scripted round must produce exactly one observable playback'
  );
  return playbackEvents[0];
}

async function answerRound(scenario, action, category) {
  selectGroup(scenario, action.group);
  const masteryBefore = plain(scenario.mastery);
  const playback = await presentRound(scenario);
  const playedIdx = scenario.current.playedIdx;
  assert.notStrictEqual(playedIdx, null, `${action.label}: played index required`);

  scenario.advanceClock(action.responseMs);
  const answerIdx =
    action.answer === 'correct' ? playedIdx : playedIdx === 0 ? 1 : 0;
  scenario.current.handleAnswer(answerIdx);
  scenario.render();

  return {
    label: action.label,
    type: 'answer',
    category,
    group: action.group,
    playbackRate: playback.rate,
    masteryBefore,
    masteryAfter: plain(scenario.mastery),
    feedbackAfterAnswer: scenario.current.feedback,
    promotedTierAfterAnswer: scenario.current.promotedTier,
  };
}

async function observeRate(scenario, action, category) {
  selectGroup(scenario, action.group);
  const playback = await presentRound(scenario);
  return {
    label: action.label,
    type: 'rate-observation',
    category,
    group: action.group,
    playbackRate: playback.rate,
    mastery: plain(scenario.mastery),
  };
}

async function runProgressionScenario(fixture, scenarioFixture) {
  const scenario = createPracticeTrialSchedulingHarness({
    ...fixture,
    initialCategory: scenarioFixture.initialCategory,
    initialMastery:
      scenarioFixture.initialMastery ?? fixture.initialMastery,
    actions: [],
  });
  scenario.render();

  let category = scenarioFixture.initialCategory;
  let promotionCount = 0;
  const steps = [];
  for (const action of scenarioFixture.actions) {
    if (action.type === 'category-switch') {
      scenario.setCategory(action.category);
      scenario.render();
      category = action.category;
      steps.push({
        label: action.label,
        type: action.type,
        category,
        group: scenario.current.selectedPair?.group ?? null,
        mastery: plain(scenario.mastery),
      });
      continue;
    }

    if (action.type === 'answer') {
      const step = await answerRound(scenario, action, category);
      if (
        (step.masteryAfter[action.group] ?? 1) >
        (step.masteryBefore[action.group] ?? 1)
      ) {
        promotionCount += 1;
      }
      steps.push({ ...step, promotionCount });
      continue;
    }

    if (action.type === 'observe-rate') {
      steps.push({
        ...(await observeRate(scenario, action, category)),
        promotionCount,
      });
      continue;
    }

    if (action.type === 'remount') {
      scenario.remount();
      scenario.render();
      steps.push({
        label: action.label,
        type: action.type,
        category,
        group: scenario.current.selectedPair?.group ?? null,
        mastery: plain(scenario.mastery),
        promotionCount,
      });
      continue;
    }

    throw new Error(`Unsupported progression action: ${action.type}`);
  }

  return {
    steps,
    lifecycle: {
      hookModuleLoads: scenario.hookModuleLoads,
      hookInstancesMounted: scenario.hookInstancesMounted,
    },
  };
}

module.exports = {
  plain,
  runProgressionScenario,
};
