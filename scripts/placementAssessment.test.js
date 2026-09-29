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

const { minimalPairs } = loadTsModule(
  path.join(__dirname, '..', 'src', 'constants', 'minimalPairs.ts'),
  moduleCache
);
const { PLACEMENT_QUESTIONS_PER_CONTRAST, initializePlacementLevels } =
  placementAssessment;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertCoverage(items, category, label) {
  const groups = [...new Set(category.pairs.map((pair) => pair.group))];
  assert.strictEqual(items.length, PLACEMENT_TOTAL_QUESTIONS, label);
  assert.strictEqual(new Set(items).size, items.length, `${label}: duplicate pair`);
  for (const item of items) {
    assert.ok(category.pairs.includes(item), `${label}: item outside inventory`);
  }
  for (const group of groups) {
    const asked = items.filter((item) => item.group === group);
    assert.strictEqual(asked.length, PLACEMENT_QUESTIONS_PER_CONTRAST, `${label}: ${group}`);
    assert.strictEqual(
      new Set(asked.map((item) => item.difficulty)).size,
      asked.length,
      `${label}: ${group} asked twice at one tier`
    );
  }
  for (let tier = 1; tier <= 6; tier++) {
    assert.ok(items.some((item) => item.difficulty === tier), `${label}: tier ${tier} missing`);
  }
}

runTest('every L1 placement asks each contrast exactly twice on distinct tiers and covers tiers 1-6', () => {
  assert.strictEqual(PLACEMENT_TOTAL_QUESTIONS, 10);
  assert.strictEqual(PLACEMENT_QUESTIONS_PER_CONTRAST, 2);
  for (const category of minimalPairs) {
    for (let seed = 1; seed <= 300; seed++) {
      assertCoverage(
        buildPlacementItems({ pairs: category.pairs, random: seeded(seed) }),
        category,
        `${category.category} seed ${seed}`
      );
    }
  }
});

runTest('coverage holds for degenerate random sources', () => {
  for (const category of minimalPairs) {
    for (const value of [0, 0.1, 0.5, 0.999999999999]) {
      assertCoverage(
        buildPlacementItems({ pairs: category.pairs, random: () => value }),
        category,
        `${category.category} constant ${value}`
      );
    }
  }
});

runTest('placement construction is reproducible for a given random sequence', () => {
  const [category] = minimalPairs;
  const first = buildPlacementItems({ pairs: category.pairs, random: seeded(42) });
  const second = buildPlacementItems({ pairs: category.pairs, random: seeded(42) });
  assert.deepStrictEqual(first, second);
});

runTest('deduplication uses Pair object identity', () => {
  const [category] = minimalPairs;
  const doubled = [...category.pairs, ...category.pairs];
  assertCoverage(
    buildPlacementItems({ pairs: doubled, random: seeded(7) }),
    category,
    'duplicated input'
  );
});

const answersFor = (entries) =>
  entries.flatMap(([group, results]) =>
    results.map((correct) => ({ group, correct }))
  );
const contrastPairs = ['a', 'b', 'c', 'd', 'e'].map((group) => makePair(group, 1));
const plainLevels = (levels) => JSON.parse(JSON.stringify(levels));

runTest('a contrast with at least one correct answer starts at the global placement level', () => {
  const levels = initializePlacementLevels({
    pairs: contrastPairs,
    answers: answersFor([
      ['a', [true, true]],
      ['b', [true, true]],
      ['c', [true, true]],
      ['d', [true, true]],
      ['e', [true, false]],
    ]),
  });
  // 9/10 → level 4 through the unchanged thresholds.
  assert.deepStrictEqual(plainLevels(levels), { a: 4, b: 4, c: 4, d: 4, e: 4 });
});

runTest('a contrast answered 0/2 starts at level 1 while others take the global level', () => {
  const levels = initializePlacementLevels({
    pairs: contrastPairs,
    answers: answersFor([
      ['a', [true, true]],
      ['b', [true, true]],
      ['c', [true, true]],
      ['d', [true, true]],
      ['e', [false, false]],
    ]),
  });
  // 8/10 → level 3; e has direct counter-evidence.
  assert.deepStrictEqual(plainLevels(levels), { a: 3, b: 3, c: 3, d: 3, e: 1 });
});

runTest('an unobserved contrast defensively starts at level 1', () => {
  const levels = initializePlacementLevels({
    pairs: contrastPairs,
    answers: answersFor([
      ['a', [true, true, true]],
      ['b', [true, true, true]],
      ['c', [true, true, true]],
      ['d', [true]],
    ]),
  });
  assert.deepStrictEqual(plainLevels(levels), { a: 4, b: 4, c: 4, d: 4, e: 1 });
});

runTest('placement levels follow the existing thresholds and never reach level 7', () => {
  for (let correct = 0; correct <= 10; correct++) {
    const answers = Array.from({ length: 10 }, (_, index) => ({
      group: ['a', 'b', 'c', 'd', 'e'][index % 5],
      correct: index < correct,
    }));
    const levels = initializePlacementLevels({ pairs: contrastPairs, answers });
    const expected = recommendPlacementTier(correct, 10);
    for (const [group, level] of Object.entries(levels)) {
      const evidenced = answers.some((answer) => answer.group === group && answer.correct);
      assert.strictEqual(level, evidenced ? expected : 1, `${correct}/10 ${group}`);
      assert.ok(level >= 1 && level <= 4, `${correct}/10 ${group}`);
    }
  }
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
