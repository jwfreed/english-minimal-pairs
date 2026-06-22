// scripts/audit-sparse-tiers.test.js
const assert = require('assert');
const { auditSparseTiers } = require('./audit-sparse-tiers');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function makePair(word1, word2, difficulty, group, overrides = {}) {
  return {
    word1,
    word2,
    ipa1: `/a/`,
    ipa2: `/b/`,
    difficulty,
    group,
    position: 'initial',
    contrastPhoneme1: 'a',
    contrastPhoneme2: 'b',
    ...overrides,
  };
}

// ── Test 1: Healthy tier ──────────────────────────────────────────────────────
runTest('healthy tier with 2+ pairs is not flagged as sparse', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang A',
      pairs: [
        makePair('rake', 'lake', 1, 'rL'),
        makePair('right', 'light', 1, 'rL'),
      ],
    },
  ]);
  assert.strictEqual(result.sparseTierRows.length, 0, 'no sparse rows expected');
  assert.strictEqual(result.healthyCount, 1, 'one healthy tier slot expected');
});

// ── Test 2: Single-pair tier ──────────────────────────────────────────────────
runTest('single-pair tier is flagged with correct severity', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang A',
      pairs: [
        makePair('ban', 'van', 1, 'bV'),   // tier 1 → HIGH
        makePair('bat', 'vat', 4, 'bV'),   // tier 4 → MEDIUM
      ],
    },
  ]);

  assert.strictEqual(result.sparseTierRows.length, 2, '2 sparse rows expected');

  const tierOneRow = result.sparseTierRows.find(r => r.tier === 1);
  assert.ok(tierOneRow, 'tier 1 row missing');
  assert.strictEqual(tierOneRow.categoryName, 'Lang A', 'categoryName');
  assert.strictEqual(tierOneRow.groupId, 'bV', 'groupId');
  assert.strictEqual(tierOneRow.pairCount, 1, 'pairCount');
  assert.strictEqual(tierOneRow.severity, 'HIGH', 'tier 1 should be HIGH');

  const tierFourRow = result.sparseTierRows.find(r => r.tier === 4);
  assert.ok(tierFourRow, 'tier 4 row missing');
  assert.strictEqual(tierFourRow.severity, 'MEDIUM', 'tier 4 should be MEDIUM');
});

// ── Test 3: Possible gap ──────────────────────────────────────────────────────
runTest('reports possible gap for absent intermediate tier within group min–max range', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang A',
      pairs: [
        makePair('rake', 'lake', 1, 'rL'),
        makePair('road', 'load', 3, 'rL'),
        // tier 2 absent between min=1 and max=3
      ],
    },
  ]);

  assert.strictEqual(result.possibleGapRows.length, 1, '1 possible gap expected');
  const gap = result.possibleGapRows[0];
  assert.strictEqual(gap.categoryName, 'Lang A', 'categoryName');
  assert.strictEqual(gap.groupId, 'rL', 'groupId');
  assert.strictEqual(gap.missingTier, 2, 'missingTier');
  assert.strictEqual(gap.severity, 'POSSIBLE_GAP', 'severity');
});

// ── Test 4: No false global-tier assumption ───────────────────────────────────
runTest('group with only tier-4 pairs is not flagged for missing tiers 1–3 or 5–6', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang A',
      pairs: [
        makePair('word', 'ward', 4, 'myGroup'),
        makePair('more', 'bore', 4, 'myGroup'),
        // only tier 4 — min === max, no intermediate range
      ],
    },
  ]);

  assert.strictEqual(result.possibleGapRows.length, 0, 'no gaps should be flagged outside the group range');
  assert.strictEqual(result.sparseTierRows.length, 0, 'tier 4 with 2 pairs is healthy');
});

// ── Test 5: Stable ordering ───────────────────────────────────────────────────
runTest('sparse tier rows are sorted by severity then categoryName then groupId then tier', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang B',
      pairs: [makePair('a', 'b', 4, 'grp1')],  // MEDIUM
    },
    {
      category: 'Lang A',
      pairs: [makePair('c', 'd', 2, 'grp1')],  // HIGH
    },
  ]);

  assert.strictEqual(result.sparseTierRows.length, 2);
  assert.strictEqual(result.sparseTierRows[0].severity, 'HIGH', 'HIGH before MEDIUM');
  assert.strictEqual(result.sparseTierRows[0].categoryName, 'Lang A', 'correct category for HIGH');
  assert.strictEqual(result.sparseTierRows[1].severity, 'MEDIUM', 'MEDIUM second');
  assert.strictEqual(result.sparseTierRows[1].categoryName, 'Lang B', 'correct category for MEDIUM');
});

// ── Test 6: Pair display ──────────────────────────────────────────────────────
runTest('pairs render as word1/word2 in stable alphabetical sort', () => {
  const result = auditSparseTiers([
    {
      category: 'Lang A',
      pairs: [
        makePair('zoo', 'sue', 1, 'zS'),
      ],
    },
  ]);

  assert.strictEqual(result.sparseTierRows.length, 1);
  assert.deepStrictEqual(result.sparseTierRows[0].pairs, ['zoo/sue'], 'pair display format');
});
