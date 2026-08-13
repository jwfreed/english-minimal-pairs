const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { deriveContrastKnowledge } = loadTsModule(
  path.join(
    __dirname,
    '..',
    'src',
    'domain',
    'contrast',
    'contrastKnowledge.ts'
  )
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

const plain = (value) => JSON.parse(JSON.stringify(value));

function attempt(timestamp, isCorrect = true) {
  return { isCorrect, timestamp };
}

function derive(overrides = {}) {
  return deriveContrastKnowledge({
    attributedAttempts: [],
    completeness: 'attested',
    evaluationTimestamp: 10_000,
    minimumAttributedAttemptCount: 2,
    ...overrides,
  });
}

runTest('unattested completeness is indeterminate regardless of attempts', () => {
  assert.deepStrictEqual(
    plain(
      derive({
        attributedAttempts: [attempt(1_000), attempt(2_000)],
        completeness: 'unattested',
        minimumAttributedAttemptCount: 1,
      })
    ),
    { standing: 'indeterminate' }
  );
});

runTest('attested evidence with zero attempts is unobserved', () => {
  assert.deepStrictEqual(plain(derive()), { standing: 'unobserved' });
});

runTest('positive evidence below the caller minimum is insufficient', () => {
  assert.deepStrictEqual(
    plain(derive({ attributedAttempts: [attempt(2_000, false)] })),
    {
      standing: 'insufficient',
      attributedAttemptCount: 1,
      correctCount: 0,
      recency: { elapsedMilliseconds: 8_000 },
    }
  );
});

runTest('evidence meeting the caller minimum is observed', () => {
  assert.deepStrictEqual(
    plain(
      derive({
        attributedAttempts: [attempt(1_000, false), attempt(4_000)],
      })
    ),
    {
      standing: 'observed',
      attributedAttemptCount: 2,
      correctCount: 1,
      recency: { elapsedMilliseconds: 6_000 },
    }
  );
});

runTest('never attempted evidence is not equivalent to all-incorrect evidence', () => {
  const neverAttempted = derive();
  const allIncorrect = derive({
    attributedAttempts: [attempt(1_000, false), attempt(2_000, false)],
  });

  assert.strictEqual(neverAttempted.standing, 'unobserved');
  assert.strictEqual(allIncorrect.standing, 'observed');
  assert.notDeepStrictEqual(plain(neverAttempted), plain(allIncorrect));
});

runTest('the caller minimum changes insufficiency without changing evidence', () => {
  const attributedAttempts = [attempt(1_000, false), attempt(2_000)];

  assert.strictEqual(
    derive({ attributedAttempts, minimumAttributedAttemptCount: 3 }).standing,
    'insufficient'
  );
  assert.strictEqual(
    derive({ attributedAttempts, minimumAttributedAttemptCount: 2 }).standing,
    'observed'
  );
});

runTest('the caller minimum must be a positive safe integer', () => {
  for (const minimumAttributedAttemptCount of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    0,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => derive({ minimumAttributedAttemptCount }),
      /minimum attributed attempt count must be a positive safe integer/
    );
  }
});

runTest('evaluation time changes only the elapsed recency observation', () => {
  const attributedAttempts = [attempt(1_000, false), attempt(4_000)];
  const earlier = plain(
    derive({ attributedAttempts, evaluationTimestamp: 5_000 })
  );
  const later = plain(
    derive({ attributedAttempts, evaluationTimestamp: 9_000 })
  );

  assert.deepStrictEqual(earlier, {
    standing: 'observed',
    attributedAttemptCount: 2,
    correctCount: 1,
    recency: { elapsedMilliseconds: 1_000 },
  });
  assert.deepStrictEqual(later, {
    ...earlier,
    recency: { elapsedMilliseconds: 5_000 },
  });
});

runTest('latest-attempt selection is independent of input order', () => {
  const forward = [attempt(1_000), attempt(7_000, false), attempt(3_000)];
  const reversed = [...forward].reverse();

  assert.deepStrictEqual(
    plain(derive({ attributedAttempts: forward, minimumAttributedAttemptCount: 3 })),
    plain(derive({ attributedAttempts: reversed, minimumAttributedAttemptCount: 3 }))
  );
  assert.strictEqual(
    derive({ attributedAttempts: forward, minimumAttributedAttemptCount: 3 })
      .recency.elapsedMilliseconds,
    3_000
  );
});

runTest('a future latest attempt preserves negative elapsed time', () => {
  const knowledge = derive({
    attributedAttempts: [attempt(12_500)],
    minimumAttributedAttemptCount: 1,
  });

  assert.deepStrictEqual(plain(knowledge.recency), {
    elapsedMilliseconds: -2_500,
  });
});

console.log('\nAll ContrastKnowledge tests passed.');
