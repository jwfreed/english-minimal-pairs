const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const projectRoot = path.join(__dirname, '..');
const trialSchedulingPath = path.join(
  projectRoot,
  'src',
  'domain',
  'practice',
  'trialScheduling.ts'
);

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
    const specifiers = Array.from(
      source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g),
      (match) => match[1]
    );
    graph.set(file, specifiers);
    for (const specifier of specifiers) {
      const dependency = resolveProjectImport(file, specifier);
      if (dependency) visit(dependency);
    }
  };

  visit(entryPath);
  return graph;
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const scheduling = loadTsModule(trialSchedulingPath);
const plain = (value) => JSON.parse(JSON.stringify(value));
const makePair = (group, word1, word2) => ({
  word1,
  word2,
  ipa1: '/a/',
  ipa2: '/b/',
  difficulty: 1,
  group,
  position: 'initial',
  contrastPhoneme1: 'a',
  contrastPhoneme2: 'b',
});

runTest('initialTrialSchedulingState exports the complete empty state', () => {
  assert.strictEqual(typeof scheduling.initialTrialSchedulingState, 'function');
  assert.deepStrictEqual(plain(scheduling.initialTrialSchedulingState()), {
    lastPairId: null,
    seenThisCycle: [],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: false,
  });
});

runTest('session-reset clears every scheduling field', () => {
  assert.strictEqual(typeof scheduling.reduceTrialScheduling, 'function');
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: 'rL:rock:lock',
      trialsSinceMiss: 2,
    },
    manualOverrideArmed: true,
  };

  const next = scheduling.reduceTrialScheduling(state, {
    kind: 'session-reset',
  });

  assert.deepStrictEqual(
    plain(next),
    plain(scheduling.initialTrialSchedulingState())
  );
  assert.deepStrictEqual(plain(state), {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: 'rL:rock:lock',
      trialsSinceMiss: 2,
    },
    manualOverrideArmed: true,
  });
});

runTest('active-set-changed clears cycle and miss but preserves a valid last pair and override', () => {
  const rockLock = makePair('rL', 'rock', 'lock');
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: 'rL:rock:lock',
      trialsSinceMiss: 3,
    },
    manualOverrideArmed: true,
  };

  const next = scheduling.reduceTrialScheduling(state, {
    kind: 'active-set-changed',
    activeGroupPairs: [rockLock],
  });

  assert.ok(next, 'active-set-changed must return the next scheduling state');
  assert.deepStrictEqual(plain(next), {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: [],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: true,
  });
});

runTest('active-set-changed clears lastPairId only when the pair is absent', () => {
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: false,
  };

  const next = scheduling.reduceTrialScheduling(state, {
    kind: 'active-set-changed',
    activeGroupPairs: [makePair('rL', 'road', 'load')],
  });

  assert.strictEqual(next.lastPairId, null);
});

const scheduledState = {
  lastPairId: 'rL:rock:lock',
  seenThisCycle: ['rL:rock:lock'],
  recentMiss: {
    recentlyMissedPairId: 'rL:road:load',
    trialsSinceMiss: 1,
  },
  manualOverrideArmed: false,
};

runTest('manual-selection preserves scheduling fields within the active group', () => {
  const next = scheduling.reduceTrialScheduling(scheduledState, {
    kind: 'manual-selection',
    groupChanged: false,
  });

  assert.deepStrictEqual(plain(next), {
    ...scheduledState,
    manualOverrideArmed: true,
  });
});

runTest('manual-selection resets scheduling fields when the group changes', () => {
  const next = scheduling.reduceTrialScheduling(scheduledState, {
    kind: 'manual-selection',
    groupChanged: true,
  });

  assert.deepStrictEqual(plain(next), {
    lastPairId: null,
    seenThisCycle: [],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: true,
  });
});

runTest('round-started consumes the override without changing other scheduling fields', () => {
  const armedState = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: 'rL:road:load',
      trialsSinceMiss: 1,
    },
    manualOverrideArmed: true,
  };

  const next = scheduling.reduceTrialScheduling(armedState, {
    kind: 'round-started',
  });

  assert.deepStrictEqual(plain(next), scheduledState);
});

runTest('trial-presented records the pair and advances cycle coverage', () => {
  const rockLock = makePair('rL', 'rock', 'lock');
  const roadLoad = makePair('rL', 'road', 'load');
  const state = {
    ...scheduling.initialTrialSchedulingState(),
    manualOverrideArmed: true,
  };

  const next = scheduling.reduceTrialScheduling(state, {
    kind: 'trial-presented',
    pair: rockLock,
    activeGroupPairs: [rockLock, roadLoad],
  });

  assert.ok(next, 'trial-presented must return the next state');
  assert.deepStrictEqual(plain(next), {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: true,
  });
});

runTest('answer-recorded advances recent-miss state without changing cycle state', () => {
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: false,
  };

  const next = scheduling.reduceTrialScheduling(state, {
    kind: 'answer-recorded',
    answeredPairId: 'rL:rock:lock',
    wasCorrect: false,
  });

  assert.ok(next, 'answer-recorded must return the next state');
  assert.deepStrictEqual(plain(next), {
    ...state,
    recentMiss: {
      recentlyMissedPairId: 'rL:rock:lock',
      trialsSinceMiss: 0,
    },
  });
});

runTest('planNextTrial gives an armed manual selection precedence without consuming state', () => {
  assert.strictEqual(typeof scheduling.planNextTrial, 'function');
  const rockLock = makePair('rL', 'rock', 'lock');
  const roadLoad = makePair('rL', 'road', 'load');
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: true,
  };
  const stateBefore = plain(state);
  let randomDraws = 0;

  const next = scheduling.planNextTrial({
    state,
    eligiblePairs: [rockLock, roadLoad],
    activeGroup: 'rL',
    selectedPair: roadLoad,
    random: () => {
      randomDraws += 1;
      return 0;
    },
  });

  assert.strictEqual(next, roadLoad);
  assert.strictEqual(randomDraws, 0);
  assert.deepStrictEqual(plain(state), stateBefore);
});

runTest('planNextTrial delegates contrast-scoped selection with live inputs', () => {
  const rockLock = makePair('rL', 'rock', 'lock');
  const roadLoad = makePair('rL', 'road', 'load');
  const banVan = makePair('bV', 'ban', 'van');
  const eligiblePairs = [rockLock, roadLoad, banVan];
  const state = {
    lastPairId: 'rL:rock:lock',
    seenThisCycle: ['rL:rock:lock'],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: false,
  };
  const eligibleBefore = plain(eligiblePairs);
  let randomDraws = 0;

  const next = scheduling.planNextTrial({
    state,
    eligiblePairs,
    activeGroup: 'rL',
    selectedPair: rockLock,
    random: () => {
      randomDraws += 1;
      return 0.75;
    },
  });

  assert.strictEqual(next, roadLoad);
  assert.strictEqual(randomDraws, 1);
  assert.deepStrictEqual(plain(eligiblePairs), eligibleBefore);
});

runTest('trial scheduling remains pure and depends only on domain inputs and rules', () => {
  const source = fs.readFileSync(trialSchedulingPath, 'utf8');
  const imports = Array.from(
    source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1]
  );

  assert.deepStrictEqual(imports, [
    '@/src/constants/minimalPairs',
    '@/src/domain/practiceSession',
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
    'trackLearningEvent',
    'practiceAnalytics',
  ]) {
    assert.ok(
      !source.includes(forbiddenIdentifier),
      `trial scheduling crossed a forbidden boundary: ${forbiddenIdentifier}`
    );
  }

  const importGraph = collectProjectImportGraph(trialSchedulingPath);
  for (const [file, specifiers] of importGraph) {
    for (const specifier of specifiers) {
      const resolvedDependency = resolveProjectImport(file, specifier);
      const dependencyId = resolvedDependency
        ? path.relative(projectRoot, resolvedDependency).split(path.sep).join('/')
        : specifier.startsWith('@/')
          ? specifier.slice(2)
          : specifier;
      assert.ok(
        ![
          /^react(?:-native)?(?:\/|$)/,
          /^src\/(?:analytics|storage|hooks|context)(?:\/|$)/,
          /featureFlags/,
          /masteryPersistence/,
          /masteryRollout/,
          /migration/i,
          /audio/i,
        ].some(
          (forbidden) =>
            forbidden.test(specifier) || forbidden.test(dependencyId)
        ),
        `${path.relative(projectRoot, file)} has forbidden dependency ${specifier}`
      );
    }
  }
});
