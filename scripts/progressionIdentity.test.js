const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { loadTsModule } = require('./load-ts-module');

const projectRoot = path.join(__dirname, '..');
const progressionIdentityPath = path.join(
  projectRoot,
  'src',
  'domain',
  'practice',
  'progressionIdentity.ts'
);

function collectStaticImportSpecifiers(source) {
  return Array.from(
    source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g),
    (match) => match[1]
  );
}

function resolveProjectImport(parentFile, specifier) {
  const basePath = specifier.startsWith('@/')
    ? path.join(projectRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(parentFile), specifier)
      : null;
  if (!basePath) return null;

  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function collectProjectImportGraph(entryPath) {
  const graph = new Map();
  const visit = (file) => {
    if (graph.has(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    const specifiers = collectStaticImportSpecifiers(source);
    graph.set(file, specifiers);
    for (const specifier of specifiers) {
      const dependency = resolveProjectImport(file, specifier);
      if (dependency) visit(dependency);
    }
  };

  visit(entryPath);
  return graph;
}

const { resolveProgressionKey } = loadTsModule(progressionIdentityPath);
const { minimalPairs } = loadTsModule(
  path.join(projectRoot, 'src', 'constants', 'minimalPairs.ts')
);
const { historicalIdentityMapping } = loadTsModule(
  path.join(
    projectRoot,
    'src',
    'domain',
    'compatibility',
    'historicalIdentityMapping.ts'
  )
);

/** Every (category label, group) pair present in the shipped dataset. */
function liveContrastCoordinates() {
  const coordinates = [];
  for (const category of minimalPairs) {
    for (const group of new Set(category.pairs.map((pair) => pair.group))) {
      coordinates.push({ categoryLabel: category.category, group });
    }
  }
  return coordinates;
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

module.exports = (async () => {
  await runTest('every live contrast resolves to its stable ContrastId', () => {
    const coordinates = liveContrastCoordinates();
    assert.ok(
      coordinates.length > 0,
      'the dataset must contribute at least one contrast coordinate'
    );

    const unresolved = [];
    for (const { categoryLabel, group } of coordinates) {
      const expected = historicalIdentityMapping.resolveContrast(
        categoryLabel,
        group
      );
      if (expected === undefined) {
        unresolved.push(`${categoryLabel}/${group}`);
        continue;
      }
      assert.strictEqual(
        resolveProgressionKey(categoryLabel, group),
        expected,
        `${categoryLabel}/${group} must key on its stable ContrastId`
      );
    }

    assert.deepStrictEqual(
      unresolved,
      [],
      'every shipped contrast coordinate must have a stable identity'
    );
  });

  await runTest('live progression keys are unique across the dataset', () => {
    const coordinates = liveContrastCoordinates();
    const keysByValue = new Map();

    for (const { categoryLabel, group } of coordinates) {
      const key = resolveProgressionKey(categoryLabel, group);
      const collision = keysByValue.get(key);
      assert.strictEqual(
        collision,
        undefined,
        `key ${key} is shared by ${categoryLabel}/${group} and ${collision}`
      );
      keysByValue.set(key, `${categoryLabel}/${group}`);
    }

    assert.strictEqual(
      keysByValue.size,
      coordinates.length,
      'each live contrast coordinate must own exactly one key'
    );
  });

  await runTest('a group name shared across languages cannot collide', () => {
    const coordinates = liveContrastCoordinates();
    const labelsByGroup = new Map();
    for (const { categoryLabel, group } of coordinates) {
      if (!labelsByGroup.has(group)) labelsByGroup.set(group, []);
      labelsByGroup.get(group).push(categoryLabel);
    }

    const sharedGroups = [...labelsByGroup.entries()].filter(
      ([, labels]) => labels.length > 1
    );
    assert.ok(
      sharedGroups.length > 0,
      'the dataset must still contain a group name used by more than one language'
    );

    for (const [group, labels] of sharedGroups) {
      const keys = labels.map((label) => resolveProgressionKey(label, group));
      assert.strictEqual(
        new Set(keys).size,
        labels.length,
        `group ${group} must produce one distinct key per language`
      );
    }
  });

  await runTest('unresolvable coordinates cannot become progression identity', () => {
    assert.throws(
      () => resolveProgressionKey('Unmapped Category', 'rL'),
      /Unable to resolve progression ContrastId.*Unmapped Category.*rL/,
      'progression state must never fall back to label-derived identity'
    );
  });

  await runTest('progression identity dependencies remain domain-only and perform no I/O', () => {
    // Comments are stripped first. Domain modules legitimately *describe* the
    // storage values their callers read — `masteryPersistence.ts` documents
    // that it takes raw AsyncStorage values as arguments while importing
    // nothing and touching no adapter. Scanning prose would fail on an
    // accurate comment and teach the next author to delete it.
    const stripComments = (source) =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

    const importGraph = collectProjectImportGraph(progressionIdentityPath);
    const ioMarkers = [
      'AsyncStorage',
      'localStorage',
      'fetch(',
      'XMLHttpRequest',
      'require(',
      'setItem',
      'getItem',
      'removeItem',
    ];

    for (const file of importGraph.keys()) {
      const source = stripComments(fs.readFileSync(file, 'utf8'));
      for (const marker of ioMarkers) {
        assert.ok(
          !source.includes(marker),
          `${path.relative(projectRoot, file)} reaches I/O via ${marker}`
        );
      }
    }

    for (const [file, specifiers] of importGraph) {
      for (const specifier of specifiers) {
        const resolvedDependency = resolveProjectImport(file, specifier);
        const dependencyId = resolvedDependency
          ? path
              .relative(projectRoot, resolvedDependency)
              .split(path.sep)
              .join('/')
          : specifier.startsWith('@/')
            ? specifier.slice(2)
            : specifier;
        assert.ok(
          ![
            /^react(?:-native)?(?:\/|$)/,
            /^@react-native(?:\/|$)/,
            /^expo(?:-|\/|$)/,
            /^src\/(?:analytics|storage|hooks|context|components|config)(?:\/|$)/,
            /featureFlags/i,
            /rollout/i,
            /migration/i,
            /(?:network|database|repository|service)/i,
          ].some(
            (forbidden) =>
              forbidden.test(specifier) || forbidden.test(dependencyId)
          ),
          `${path.relative(projectRoot, file)} has forbidden dependency ${specifier}`
        );
      }
    }
  });
})();
