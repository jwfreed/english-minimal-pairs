const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  setLearningAnalyticsSink,
  trackLearningEvent,
} = loadTsModule(
  path.join(__dirname, '..', 'src', 'analytics', 'learningAnalytics.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('learning analytics forwards typed event envelopes to the installed sink', () => {
  const received = [];
  const restore = setLearningAnalyticsSink((event) => received.push(event));
  const event = {
    name: 'pair_presented',
    properties: {
      contrast_id: 'rL',
      pair_id: 'English__rL__right_light',
      difficulty_tier: 2,
    },
  };

  trackLearningEvent(event);
  restore();

  assert.strictEqual(JSON.stringify(received), JSON.stringify([event]));
});

runTest('learning analytics never interrupts practice when an adapter throws', () => {
  const restore = setLearningAnalyticsSink(() => {
    throw new Error('adapter unavailable');
  });

  assert.doesNotThrow(() =>
    trackLearningEvent({
      name: 'contrast_practice_started',
      properties: { contrast_id: 'rL', mastery_level: 3 },
    })
  );
  restore();
});

runTest('learning analytics handles rejected async delivery without returning a dependency', () => {
  let rejectionHandled = false;
  const rejectedDelivery = {
    catch(onRejected) {
      rejectionHandled = true;
      onRejected(new Error('async adapter unavailable'));
    },
  };
  const restore = setLearningAnalyticsSink(() => rejectedDelivery);

  const result = trackLearningEvent({
    name: 'pair_answered',
    properties: {
      contrast_id: 'rL',
      pair_id: 'English__rL__right_light',
      correct: false,
      response_time_ms: 800,
    },
  });
  restore();

  assert.strictEqual(result, undefined);
  assert.strictEqual(rejectionHandled, true);
});

runTest('restoring a sink reinstates the previous adapter', () => {
  const received = [];
  const restoreFirst = setLearningAnalyticsSink((event) => received.push(event.name));
  const restoreSecond = setLearningAnalyticsSink(() => received.push('temporary'));

  restoreSecond();
  trackLearningEvent({
    name: 'pair_selected',
    properties: { contrast_id: 'rL', pair_id: 'pair-1' },
  });
  restoreFirst();

  assert.strictEqual(JSON.stringify(received), JSON.stringify(['pair_selected']));
});

console.log('\nAll learningAnalytics tests passed.');
