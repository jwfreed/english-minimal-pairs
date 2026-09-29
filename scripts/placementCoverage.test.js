// Decision 021 guards. Placement must observe every contrast; the inventory
// must keep that achievable; and the accepted sparse-tier baseline (dataset v1
// freeze) must not drift silently. Runtime M6 behavior is unchanged.
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
const { minimalPairs } = loadTsModule(
  path.join(ROOT, 'src', 'constants', 'minimalPairs.ts'),
  cache
);
const {
  PLACEMENT_TOTAL_QUESTIONS,
  PLACEMENT_QUESTIONS_PER_CONTRAST,
  buildPlacementItems,
} = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'practice', 'placementAssessment.ts'),
  cache
);

const TIERS = [1, 2, 3, 4, 5, 6];
const SIMULATION_SEED = 20260929;
const SIMULATION_RUNS = 5000;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const groupsOf = (category) => [...new Set(category.pairs.map((pair) => pair.group))];
const poolSize = (category, group, tier) =>
  category.pairs.filter((pair) => pair.group === group && pair.difficulty === tier).length;

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('every L1 has exactly as many contrasts as placement can cover twice', () => {
  const expected = PLACEMENT_TOTAL_QUESTIONS / PLACEMENT_QUESTIONS_PER_CONTRAST;
  assert.strictEqual(minimalPairs.length, 14);
  for (const category of minimalPairs) {
    assert.strictEqual(groupsOf(category).length, expected, category.category);
  }
});

runTest('every contrast has at least one pair at every tier', () => {
  const empty = [];
  for (const category of minimalPairs) {
    for (const group of groupsOf(category)) {
      for (const tier of TIERS) {
        if (poolSize(category, group, tier) === 0) {
          empty.push(`${category.category}/${group}/${tier}`);
        }
      }
    }
  }
  assert.deepStrictEqual(empty, []);
});

runTest('seeded simulation: no contrast is ever left unobserved and the tier mix is preserved', () => {
  const random = seeded(SIMULATION_SEED);
  for (const category of minimalPairs) {
    const groups = groupsOf(category);
    const tierCounts = Object.fromEntries(TIERS.map((tier) => [tier, 0]));
    let omissions = 0;
    for (let run = 0; run < SIMULATION_RUNS; run++) {
      const items = buildPlacementItems({ pairs: category.pairs, random });
      const observed = new Set(items.map((item) => item.group));
      if (groups.some((group) => !observed.has(group))) omissions += 1;
      for (const item of items) tierCounts[item.difficulty] += 1;
    }
    assert.strictEqual(omissions, 0, `${category.category}: unobserved contrasts`);

    // The previous sampler: one question per tier, then extras drawn from the
    // remaining pairs, so E[tier t] = 1 + extras * (N_t - 1) / (N - tiers).
    const total = category.pairs.length;
    const extras = PLACEMENT_TOTAL_QUESTIONS - TIERS.length;
    for (const tier of TIERS) {
      const pairsAtTier = category.pairs.filter((pair) => pair.difficulty === tier).length;
      const expected = 1 + (extras * (pairsAtTier - 1)) / (total - TIERS.length);
      const observed = tierCounts[tier] / SIMULATION_RUNS;
      assert.ok(
        Math.abs(observed - expected) < 0.06,
        `${category.category} tier ${tier}: ${observed.toFixed(3)} vs ${expected.toFixed(3)}`
      );
    }
  }
});

runTest('the accepted sparse-tier baseline is unchanged (dataset v1 freeze)', () => {
  const singles = [];
  for (const category of minimalPairs) {
    for (const group of groupsOf(category)) {
      for (const tier of TIERS) {
        if (poolSize(category, group, tier) === 1) singles.push({ category: category.category, group, tier });
      }
    }
  }
  // Changing these requires a reviewed content change: regenerate
  // `npm run audit:sparse-tiers -- --write` and update this baseline.
  assert.strictEqual(singles.length, 197);
  assert.deepStrictEqual(
    singles
      .filter((single) => single.tier <= 2)
      .map((single) => `${single.category}/${single.group}/${single.tier}`)
      .sort(),
    [
      'Português/uVsU/1',
      'Português/uVsU/2',
      'Türkçe/uVsU/1',
      'Türkçe/uVsU/2',
      '中文/uVsU/1',
      '中文/uVsU/2',
      'हिन्दी / اردو/wV/1',
      'हिन्दी / اردو/wV/2',
    ].sort()
  );
});
