// scripts/audit-pair-expansion-targets.test.js
const assert = require('assert');
const {
  TARGET_PAIRS_BY_TIER,
  auditPairExpansionTargets,
  generatePairExpansionMarkdown,
} = require('./audit-pair-expansion-targets');

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

function makeCategory(category, pairs) {
  return { category, pairs };
}

function findSlot(result, categoryLabel, groupId, tier) {
  return result.slots.find(
    (slot) =>
      slot.categoryLabel === categoryLabel &&
      slot.groupId === groupId &&
      slot.tier === tier
  );
}

runTest('target counts use 3 pairs for tiers 1-3 and 2 pairs for tiers 4-6', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [
      makePair('alpha', 'beta', 1, 'ab'),
      makePair('delta', 'echo', 4, 'ab'),
    ]),
  ]);

  assert.strictEqual(TARGET_PAIRS_BY_TIER[1], 3, 'tier 1 target');
  assert.strictEqual(TARGET_PAIRS_BY_TIER[4], 2, 'tier 4 target');

  const tierOne = findSlot(result, 'Lang A', 'ab', 1);
  assert.ok(tierOne, 'tier 1 slot exists');
  assert.strictEqual(tierOne.currentCount, 1, 'tier 1 current count');
  assert.strictEqual(tierOne.targetCount, 3, 'tier 1 target count');
  assert.strictEqual(tierOne.missingCount, 2, 'tier 1 missing count');

  const tierFour = findSlot(result, 'Lang A', 'ab', 4);
  assert.ok(tierFour, 'tier 4 slot exists');
  assert.strictEqual(tierFour.currentCount, 1, 'tier 4 current count');
  assert.strictEqual(tierFour.targetCount, 2, 'tier 4 target count');
  assert.strictEqual(tierFour.missingCount, 1, 'tier 4 missing count');
});

runTest('complete slots have zero missing count and LOW severity', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [
      makePair('alpha', 'beta', 1, 'ab'),
      makePair('amber', 'bomber', 1, 'ab'),
      makePair('atom', 'bottom', 1, 'ab'),
      makePair('delta', 'echo', 4, 'ab'),
      makePair('dune', 'eon', 4, 'ab'),
    ]),
  ]);

  const tierOne = findSlot(result, 'Lang A', 'ab', 1);
  assert.strictEqual(tierOne.currentCount, 3, 'tier 1 current count');
  assert.strictEqual(tierOne.missingCount, 0, 'tier 1 missing count');
  assert.strictEqual(tierOne.severity, 'LOW', 'tier 1 complete severity');

  const tierFour = findSlot(result, 'Lang A', 'ab', 4);
  assert.strictEqual(tierFour.currentCount, 2, 'tier 4 current count');
  assert.strictEqual(tierFour.missingCount, 0, 'tier 4 missing count');
  assert.strictEqual(tierFour.severity, 'LOW', 'tier 4 complete severity');
});

runTest('underfilled early-tier slots are HIGH severity', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [makePair('alpha', 'beta', 2, 'ab')]),
  ]);

  const slot = findSlot(result, 'Lang A', 'ab', 2);
  assert.strictEqual(slot.missingCount, 2, 'tier 2 missing count');
  assert.strictEqual(slot.severity, 'HIGH', 'tier 2 severity');
});

runTest('underfilled upper-tier slots are MEDIUM severity', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [makePair('alpha', 'beta', 5, 'ab')]),
  ]);

  const slot = findSlot(result, 'Lang A', 'ab', 5);
  assert.strictEqual(slot.missingCount, 1, 'tier 5 missing count');
  assert.strictEqual(slot.severity, 'MEDIUM', 'tier 5 severity');
});

runTest('generates tiers 1-6 for existing category groups only', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [makePair('alpha', 'beta', 1, 'ab')]),
  ]);

  assert.strictEqual(result.summary.totalCategories, 1, 'one category');
  assert.strictEqual(result.summary.totalCategoryGroups, 1, 'one category/group');
  assert.strictEqual(result.summary.totalSlots, 6, 'six target tier slots');
  assert.deepStrictEqual(
    result.slots.map((slot) => `${slot.categoryLabel}:${slot.groupId}:${slot.tier}`),
    ['Lang A:ab:1', 'Lang A:ab:2', 'Lang A:ab:3', 'Lang A:ab:4', 'Lang A:ab:5', 'Lang A:ab:6'],
    'only the existing category/group gets tier slots'
  );
});

runTest('underfilled slots are sorted by severity then category then group then tier', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang B', [makePair('upper', 'slot', 5, 'zz')]),
    makeCategory('Lang A', [makePair('early', 'slot', 2, 'aa')]),
  ]);

  assert.strictEqual(result.underfilledSlots[0].severity, 'HIGH', 'HIGH first');
  assert.strictEqual(result.underfilledSlots[0].categoryLabel, 'Lang A', 'Lang A first');
  assert.strictEqual(result.underfilledSlots[0].groupId, 'aa', 'aa first');
  assert.strictEqual(result.underfilledSlots[0].tier, 1, 'earliest missing tier first');
  assert.strictEqual(result.underfilledSlots.at(-1).severity, 'MEDIUM', 'MEDIUM last');
  assert.strictEqual(result.underfilledSlots.at(-1).categoryLabel, 'Lang B', 'Lang B last');
});

runTest('markdown includes the required report sections', () => {
  const result = auditPairExpansionTargets([
    makeCategory('Lang A', [makePair('alpha', 'beta', 1, 'ab')]),
  ]);
  const markdown = generatePairExpansionMarkdown(result);

  assert.ok(markdown.includes('## 1. Summary'), 'Summary section');
  assert.ok(markdown.includes('## 2. Target Coverage Model'), 'Target Coverage Model section');
  assert.ok(markdown.includes('## 3. Underfilled Slots'), 'Underfilled Slots section');
  assert.ok(markdown.includes('## 4. Priority Expansion Backlog'), 'Priority Expansion Backlog section');
  assert.ok(markdown.includes('## 5. Exceptions'), 'Exceptions section');
  assert.ok(markdown.includes('## 6. Regenerating This Report'), 'Regenerating section');
});

runTest('exceptions reduce urgency without hiding counts or markdown visibility', () => {
  const targetExceptions = [
    {
      categoryKey: 'Lang A',
      groupId: 'ab',
      tier: 6,
      reason: 'needs_linguistic_review',
      status: 'deferred',
      note: 'No clean candidates identified yet.',
    },
  ];
  const result = auditPairExpansionTargets(
    [makeCategory('Lang A', [makePair('alpha', 'beta', 6, 'ab')])],
    { targetExceptions }
  );

  const slot = findSlot(result, 'Lang A', 'ab', 6);
  assert.strictEqual(slot.currentCount, 1, 'current count remains visible');
  assert.strictEqual(slot.targetCount, 2, 'target count remains visible');
  assert.strictEqual(slot.missingCount, 1, 'missing count remains visible');
  assert.strictEqual(slot.severity, 'EXCEPTION', 'exception severity');
  assert.deepStrictEqual(slot.exception, targetExceptions[0], 'slot exception is attached');
  assert.strictEqual(result.exceptions.length, 1, 'structured exception is reported');

  const markdown = generatePairExpansionMarkdown(result);
  assert.ok(markdown.includes('| Lang A | ab | a/b | 6 | 1 | 2 | 1 | EXCEPTION | alpha/beta |'), 'underfilled exception row');
  assert.ok(markdown.includes('| Lang A | ab | 6 | needs_linguistic_review | deferred | No clean candidates identified yet. |'), 'exception table row');
});
