const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { loadTsModule } = require('./load-ts-module');

const projectRoot = path.join(__dirname, '..');
const progressionStatePath = path.join(
  projectRoot,
  'src',
  'domain',
  'practice',
  'progressionState.ts'
);
const plain = (value) => JSON.parse(JSON.stringify(value));

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

const {
  applyProgressionAnswer,
  getGroupProgression,
  initialProgressionState,
} = loadTsModule(progressionStatePath);

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
  await runTest('new groups begin at the baseline progression state', () => {
    const state = initialProgressionState();

    assert.deepStrictEqual(plain(getGroupProgression(state, 'rL')), {
      speedTier: 0,
      fastStreak: 0,
      longStreak: 0,
    });
    assert.deepStrictEqual(plain(state), {});
  });

  await runTest('answer transitions update one group without mutating prior state', () => {
    const initial = initialProgressionState();
    const next = applyProgressionAnswer(initial, {
      group: 'rL',
      nextSpeed: 1,
      nextFastStreak: 0,
      nextLongStreak: 0,
    });

    assert.deepStrictEqual(plain(initial), {});
    assert.deepStrictEqual(plain(getGroupProgression(next, 'rL')), {
      speedTier: 1,
      fastStreak: 0,
      longStreak: 0,
    });
  });

  await runTest('progression transitions remain isolated per group', () => {
    const withFirstGroup = applyProgressionAnswer(
      initialProgressionState(),
      {
        group: 'rL',
        nextSpeed: 1,
        nextFastStreak: 2,
        nextLongStreak: 4,
      }
    );
    const withBothGroups = applyProgressionAnswer(withFirstGroup, {
      group: 'bV',
      nextSpeed: 2,
      nextFastStreak: 0,
      nextLongStreak: 1,
    });

    assert.deepStrictEqual(
      plain(getGroupProgression(withBothGroups, 'rL')),
      {
        speedTier: 1,
        fastStreak: 2,
        longStreak: 4,
      }
    );
    assert.deepStrictEqual(
      plain(getGroupProgression(withBothGroups, 'bV')),
      {
        speedTier: 2,
        fastStreak: 0,
        longStreak: 1,
      }
    );
  });

  await runTest('dependency scan includes side-effect imports', () => {
    const imports = collectStaticImportSpecifiers(`
      import type { SpeedTier } from '@/src/learning/adaptiveProgression';
      import 'react';
    `);

    assert.deepStrictEqual(imports, [
      '@/src/learning/adaptiveProgression',
      'react',
    ]);
  });

  await runTest('progression state remains pure and depends only on domain rules', () => {
    const source = fs.readFileSync(progressionStatePath, 'utf8');
    const imports = collectStaticImportSpecifiers(source);

    assert.deepStrictEqual(imports, [
      '@/src/domain/practiceSession',
      '@/src/learning/adaptiveProgression',
    ]);

    for (const forbiddenIdentifier of [
      'AsyncStorage',
      'FEATURE_FLAGS',
      'CONTRAST_MASTERY_ROLLOUT_STATE',
      "from 'react'",
      'from "react"',
      'useState',
      'useRef',
      'useEffect',
      'practiceAnalytics',
      'trackLearningEvent',
      'promoteMastery',
      'currentMasteryTier',
      'nextMasteryTier',
      'planNextTrial',
      'reduceTrialScheduling',
      'require(',
      'import(',
      'fetch(',
      'XMLHttpRequest',
    ]) {
      assert.ok(
        !source.includes(forbiddenIdentifier),
        `progression state crossed a forbidden boundary: ${forbiddenIdentifier}`
      );
    }

    const importGraph = collectProjectImportGraph(progressionStatePath);
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
            /AsyncStorage/i,
            /persist/i,
            /featureFlags/i,
            /rollout/i,
            /mastery/i,
            /schedul/i,
            /migration/i,
            /compatib/i,
            /audio/i,
            /playback/i,
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
