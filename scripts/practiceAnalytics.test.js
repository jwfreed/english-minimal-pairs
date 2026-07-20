const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const moduleCache = new Map();
const { setLearningAnalyticsSink } = loadTsModule(
  path.join(__dirname, '..', 'src', 'analytics', 'learningAnalytics.ts'),
  moduleCache
);
const { practiceAnalytics } = loadTsModule(
  path.join(__dirname, '..', 'src', 'analytics', 'practiceAnalytics.ts'),
  moduleCache
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

async function runAsyncTest(name, fn) {
  try {
    await fn();
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
  difficulty: 2,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

runTest('answer submission translates to the existing analytics event', () => {
  const received = [];
  const restore = setLearningAnalyticsSink((event) => received.push(event));

  practiceAnalytics.answerSubmitted({
    pair,
    category: 'English',
    correct: false,
    responseTimeMs: 800,
  });
  restore();

  assert.strictEqual(
    JSON.stringify(received),
    JSON.stringify([
      {
        name: 'pair_answered',
        properties: {
          contrast_id: 'rL',
          pair_id: 'English__rL__right_light',
          correct: false,
          response_time_ms: 800,
        },
      },
    ])
  );
});

runTest('all practice actions preserve event names and canonical identifiers', () => {
  const received = [];
  const restore = setLearningAnalyticsSink((event) => received.push(event));

  practiceAnalytics.practiceStarted({ contrast: 'rL', masteryLevel: 3 });
  practiceAnalytics.pairPresented({ pair, category: 'English' });
  practiceAnalytics.comparisonOpened({
    pair,
    category: 'English',
    chosenIndex: 1,
    correctIndex: 0,
    responseTimeMs: 800,
  });
  practiceAnalytics.pairSelected({ pair, category: 'English' });
  restore();

  assert.strictEqual(
    JSON.stringify(received),
    JSON.stringify([
      {
        name: 'contrast_practice_started',
        properties: { contrast_id: 'rL', mastery_level: 3 },
      },
      {
        name: 'pair_presented',
        properties: {
          contrast_id: 'rL',
          pair_id: 'English__rL__right_light',
          difficulty_tier: 2,
        },
      },
      {
        name: 'compare_mode_opened',
        properties: {
          contrast_id: 'rL',
          pair_id: 'English__rL__right_light',
          incorrect_attempt_context: {
            chosen_word: 'light',
            correct_word: 'right',
            response_time_ms: 800,
          },
        },
      },
      {
        name: 'pair_selected',
        properties: {
          contrast_id: 'rL',
          pair_id: 'English__rL__right_light',
        },
      },
    ])
  );
});

runTest('synchronous analytics failures do not escape the practice adapter', () => {
  const restore = setLearningAnalyticsSink(() => {
    throw new Error('provider unavailable');
  });

  assert.doesNotThrow(() =>
    practiceAnalytics.answerSubmitted({
      pair,
      category: 'English',
      correct: true,
      responseTimeMs: 400,
    })
  );
  restore();
});

module.exports = runAsyncTest(
  'rejected analytics promises do not become a practice dependency',
  async () => {
    const restore = setLearningAnalyticsSink(() =>
      Promise.reject(new Error('async provider unavailable'))
    );

    const result = practiceAnalytics.pairPresented({
      pair,
      category: 'English',
    });
    restore();
    await new Promise((resolve) => setImmediate(resolve));

    assert.strictEqual(result, undefined);
  }
).then(() => console.log('\nAll practiceAnalytics tests passed.'));
