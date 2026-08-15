const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const projectRoot = path.join(__dirname, '..');
const productionRoots = ['app', 'src', 'utils'];
const retiredImplementationNames = [
  'recommendNextPractice',
  'computePracticeNextRecommendation',
];
const retiredResultsTranslationKeys = [
  'practiceThisNext',
  'practiceThisNextReason',
  'practiceThisNextReasonNew',
  'practiceThisNextEmpty',
];

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function readProductionSources(relativeDirectory) {
  const absoluteDirectory = path.join(projectRoot, relativeDirectory);
  const sources = [];

  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...readProductionSources(relativePath));
    } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      sources.push({
        relativePath,
        source: fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'),
      });
    }
  }

  return sources;
}

runTest('production source cannot restore or reuse the retired Results recommender', () => {
  const violations = productionRoots
    .flatMap(readProductionSources)
    .flatMap(({ relativePath, source }) =>
      retiredImplementationNames
        .filter((name) => source.includes(name))
        .map((name) => `${relativePath}: ${name}`)
    );

  assert.deepStrictEqual(
    violations,
    [],
    `retired recommendation implementation remains in production:\n${violations.join('\n')}`
  );
});

runTest('Results does not reference retired recommendation copy', () => {
  const resultsSource = fs.readFileSync(
    path.join(projectRoot, 'app', '(tabs)', 'results.tsx'),
    'utf8'
  );
  const violations = retiredResultsTranslationKeys.filter((key) =>
    resultsSource.includes(key)
  );

  assert.deepStrictEqual(violations, []);
});

runTest('the sole authorized Practice suggestion remains inactive', () => {
  const featureFlags = loadTsModule(
    path.join(projectRoot, 'src', 'config', 'featureFlags.ts')
  );

  assert.strictEqual(
    featureFlags.CONTRAST_PRACTICE_SUGGESTION_ENABLED,
    false
  );
  assert.strictEqual(
    featureFlags.CONTRAST_MASTERY_ROLLOUT_STATE,
    'disabled'
  );
});

console.log('\nAll recommendation authority tests passed.');
