const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const moduleCache = new Map();
const placementAssessment = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'practice', 'placementAssessment.ts'),
  moduleCache
);
const practiceSession = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'practiceSession.ts'),
  moduleCache
);

const {
  PLACEMENT_TOTAL_QUESTIONS,
  buildPlacementItems,
  recommendPlacementTier,
} = placementAssessment;

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const makePair = (id, difficulty) => ({
  word1: `${id}-one`,
  word2: `${id}-two`,
  ipa1: '/a/',
  ipa2: '/b/',
  difficulty,
  group: id,
  position: 'initial',
  contrastPhoneme1: 'a',
  contrastPhoneme2: 'b',
});

const ids = (pairs) => pairs.map((pair) => pair.group);

runTest('injected randomness consumes the expected sequence in construction order', () => {
  const pairs = [
    makePair('a', 1),
    makePair('b', 1),
    makePair('c', 1),
    makePair('d', 1),
  ];
  const values = [0.51, 0.01, 0.99, 0.25, 0.5, 0.75];
  const draws = [];
  let nextValue = 0;

  const items = buildPlacementItems({
    pairs,
    random: () => {
      const value = values[nextValue++];
      draws.push(value);
      return value;
    },
  });

  assert.strictEqual(draws.length, 6);
  assert.deepStrictEqual(draws, values);
  assert.strictEqual(JSON.stringify(ids(items)), JSON.stringify(['c', 'b', 'a', 'd']));
});

runTest('normal construction samples each available difficulty then fills to ten', () => {
  const pairs = [
    makePair('tier3-first', 3),
    makePair('tier3-last', 3),
    makePair('tier1-first', 1),
    makePair('tier1-last', 1),
    makePair('tier2-first', 2),
    makePair('tier2-last', 2),
    makePair('tier4-first', 4),
    makePair('tier4-last', 4),
    makePair('tier5-first', 5),
    makePair('tier5-last', 5),
    makePair('tier6-first', 6),
    makePair('tier6-last', 6),
  ];

  const items = buildPlacementItems({ pairs, random: () => 0.999999999999 });

  assert.strictEqual(PLACEMENT_TOTAL_QUESTIONS, 10);
  assert.strictEqual(
    JSON.stringify(ids(items)),
    JSON.stringify([
      'tier3-last',
      'tier1-last',
      'tier2-last',
      'tier4-last',
      'tier5-last',
      'tier6-last',
      'tier3-first',
      'tier1-first',
      'tier2-first',
      'tier4-first',
    ])
  );
});

runTest('small pools return every available pair without padding', () => {
  const pairs = [makePair('tier1-first', 1), makePair('tier1-last', 1), makePair('tier2', 2)];

  const items = buildPlacementItems({ pairs, random: () => 0.999999999999 });

  assert.strictEqual(JSON.stringify(ids(items)), JSON.stringify(['tier1-last', 'tier2', 'tier1-first']));
});

runTest('deduplication uses Pair object identity', () => {
  const shared = makePair('same-value', 1);
  const equalButDistinct = makePair('same-value', 1);
  const tier2 = makePair('tier2', 2);

  const items = buildPlacementItems({
    pairs: [shared, shared, equalButDistinct, tier2],
    random: () => 0,
  });

  assert.strictEqual(items.filter((pair) => pair === shared).length, 1);
  assert.strictEqual(items.filter((pair) => pair === equalButDistinct).length, 1);
  assert.strictEqual(items.filter((pair) => pair === tier2).length, 1);
});

runTest('recommendPlacementTier is directly re-exported from practiceSession', () => {
  assert.strictEqual(recommendPlacementTier, practiceSession.recommendPlacementTier);
});

runTest('placement scoring preserves practiceSession thresholds', () => {
  assert.strictEqual(recommendPlacementTier(9, 10), 4);
  assert.strictEqual(recommendPlacementTier(7, 10), 3);
  assert.strictEqual(recommendPlacementTier(5, 10), 2);
  assert.strictEqual(recommendPlacementTier(4, 10), 1);
});

runTest('PlacementTest memoizes the original pairs reference with only pairs as its dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'PlacementTest.tsx'),
    'utf8'
  );

  assert.ok(
    source.includes(
      `const testItems = useMemo(
    () => buildPlacementItems({ pairs, random: Math.random }),
    [pairs]
  );`
    ),
    'PlacementTest must pass pairs directly inside useMemo and retain the exact [pairs] dependency'
  );
});
