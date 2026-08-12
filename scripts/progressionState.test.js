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
  getContrastProgression,
  initialProgressionState,
} = loadTsModule(progressionStatePath);

// Progression entries are keyed by resolved contrast identity, never by the
// bare `Pair.group` string. These two share a group name across languages and
// must never share an entry — the property this module exists to guarantee.
const SPANISH_I_VS_I = 'contrast.spanish.iVsI';
const RUSSIAN_I_VS_I = 'contrast.russian.iVsI';
const SPANISH_B_VS_V = 'contrast.spanish.bV';

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
  await runTest('new contrasts begin at the baseline progression state', () => {
    const state = initialProgressionState();

    assert.deepStrictEqual(plain(getContrastProgression(state, SPANISH_I_VS_I)), {
      speedTier: 0,
      fastStreak: 0,
      longStreak: 0,
    });
    assert.deepStrictEqual(plain(state), {});
  });

  await runTest('answer transitions update one contrast without mutating prior state', () => {
    const initial = initialProgressionState();
    const next = applyProgressionAnswer(initial, SPANISH_I_VS_I, {
      nextSpeed: 1,
      nextFastStreak: 0,
      nextLongStreak: 0,
    });

    assert.deepStrictEqual(plain(initial), {});
    assert.deepStrictEqual(plain(getContrastProgression(next, SPANISH_I_VS_I)), {
      speedTier: 1,
      fastStreak: 0,
      longStreak: 0,
    });
  });

  await runTest('progression transitions remain isolated per contrast', () => {
    const withFirstContrast = applyProgressionAnswer(
      initialProgressionState(),
      SPANISH_I_VS_I,
      {
        nextSpeed: 1,
        nextFastStreak: 2,
        nextLongStreak: 4,
      }
    );
    const withBothContrasts = applyProgressionAnswer(
      withFirstContrast,
      SPANISH_B_VS_V,
      {
        nextSpeed: 2,
        nextFastStreak: 0,
        nextLongStreak: 1,
      }
    );

    assert.deepStrictEqual(
      plain(getContrastProgression(withBothContrasts, SPANISH_I_VS_I)),
      {
        speedTier: 1,
        fastStreak: 2,
        longStreak: 4,
      }
    );
    assert.deepStrictEqual(
      plain(getContrastProgression(withBothContrasts, SPANISH_B_VS_V)),
      {
        speedTier: 2,
        fastStreak: 0,
        longStreak: 1,
      }
    );
  });

  await runTest('one group name in two languages keeps two independent entries', () => {
    const afterSpanish = applyProgressionAnswer(
      initialProgressionState(),
      SPANISH_I_VS_I,
      {
        nextSpeed: 2,
        nextFastStreak: 2,
        nextLongStreak: 5,
      }
    );

    assert.deepStrictEqual(
      plain(getContrastProgression(afterSpanish, RUSSIAN_I_VS_I)),
      {
        speedTier: 0,
        fastStreak: 0,
        longStreak: 0,
      },
      'a streak earned in one language must not advance another'
    );

    const afterBoth = applyProgressionAnswer(afterSpanish, RUSSIAN_I_VS_I, {
      nextSpeed: 0,
      nextFastStreak: 1,
      nextLongStreak: 1,
    });

    assert.deepStrictEqual(
      plain(getContrastProgression(afterBoth, SPANISH_I_VS_I)),
      {
        speedTier: 2,
        fastStreak: 2,
        longStreak: 5,
      },
      'answering one language must not disturb the other'
    );
  });

  await runTest('progression state remains pure and depends only on domain rules', () => {
    const source = fs.readFileSync(progressionStatePath, 'utf8');

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
