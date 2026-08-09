const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { buildMasterySummary } = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'contrast', 'masterySummary.ts')
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

function makePair(group) {
  return {
    word1: 'right',
    word2: 'light',
    ipa1: '/raɪt/',
    ipa2: '/laɪt/',
    difficulty: 1,
    group,
    position: 'initial',
    contrastPhoneme1: 'r',
    contrastPhoneme2: 'l',
  };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

runTest('buildMasterySummary returns empty totals without pairs', () => {
  assert.deepStrictEqual(
    plain(buildMasterySummary({ pairs: [], mastery: {} })),
    { totalGroups: 0, masteredGroups: 0, totalLevels: 0, completedLevels: 0 }
  );
});

runTest('buildMasterySummary counts duplicate groups once', () => {
  assert.deepStrictEqual(
    plain(buildMasterySummary({
      pairs: [makePair('rL'), makePair('rL')],
      mastery: {},
    })),
    { totalGroups: 1, masteredGroups: 0, totalLevels: 6, completedLevels: 0 }
  );
});

runTest('buildMasterySummary leaves the starting tier incomplete', () => {
  assert.deepStrictEqual(
    plain(buildMasterySummary({ pairs: [makePair('rL')], mastery: { rL: 1 } })),
    { totalGroups: 1, masteredGroups: 0, totalLevels: 6, completedLevels: 0 }
  );
});

runTest('buildMasterySummary treats the final tier as mastered', () => {
  assert.deepStrictEqual(
    plain(buildMasterySummary({ pairs: [makePair('rL')], mastery: { rL: 6 } })),
    { totalGroups: 1, masteredGroups: 1, totalLevels: 6, completedLevels: 5 }
  );
});

runTest('buildMasterySummary caps completed levels above the final tier', () => {
  assert.deepStrictEqual(
    plain(buildMasterySummary({ pairs: [makePair('rL')], mastery: { rL: 7 } })),
    { totalGroups: 1, masteredGroups: 1, totalLevels: 6, completedLevels: 6 }
  );
});

console.log('\nAll masterySummary tests passed.');
