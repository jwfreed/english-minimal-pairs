/**
 * Protects the ContrastKnowledge completeness invariant.
 *
 * `inspectContrastKnowledge` attests completeness from the WHOLE projection
 * (Decision 017). A caller that narrows the projection before inspection —
 * filtering it to one language, reconstructing it, or passing a subset —
 * silently upgrades `unattested` to `attested`, turning unknown evidence into
 * a positive standing. That is the exact inversion Decision 017 forbids, and
 * it cannot be detected from inside the domain: a narrowed projection is
 * structurally indistinguishable from a complete one.
 *
 * These tests therefore protect the invariant at the call site.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const INSPECTION_PATH = path.join(
  SRC,
  'domain',
  'contrast',
  'contrastKnowledgeInspection.ts'
);
const REPORT_PATH = path.join(
  SRC,
  'dev',
  'contrastKnowledgeInspectionReport.ts'
);
const SUGGESTION_PATH = path.join(
  SRC,
  'domain',
  'practice',
  'nextContrastSuggestion.ts'
);

const { inspectContrastKnowledge } = loadTsModule(INSPECTION_PATH);
const { contrastRegistry } = loadTsModule(
  path.join(SRC, 'domain', 'contrast', 'contrastRegistry.ts')
);
const { projectPairProgressToContrasts } = loadTsModule(
  path.join(SRC, 'domain', 'contrast', 'pairProgressProjection.ts')
);
const { historicalIdentityMapping } = loadTsModule(
  path.join(SRC, 'domain', 'compatibility', 'historicalIdentityMapping.ts')
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

function sourceFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

/**
 * Returns the text of each `fnName({ ... })` argument object in `source`,
 * balancing braces so nested literals do not truncate the match.
 */
function callArgumentBlocks(source, fnName) {
  const blocks = [];
  const opener = `${fnName}({`;
  let index = source.indexOf(opener);

  while (index !== -1) {
    let depth = 0;
    let cursor = index + fnName.length + 1;
    const start = cursor + 1;

    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    blocks.push(source.slice(start, cursor));
    index = source.indexOf(opener, cursor);
  }

  return blocks;
}

/**
 * Resolves the identifier supplied for `property`, accepting only shorthand
 * (`projection,`) or a bare identifier (`projection: value,`). Any expression
 * — a spread, call, filter, or object literal — returns undefined.
 */
function suppliedIdentifier(block, property) {
  const shorthand = new RegExp(`(?:^|[,{\\n])\\s*${property}\\s*(?:,|$)`);
  if (shorthand.test(block)) return property;

  const explicit = new RegExp(
    `(?:^|[,{\\n])\\s*${property}\\s*:\\s*([A-Za-z_$][\\w$]*)\\s*(?:,|$)`
  );
  const match = block.match(explicit);
  return match ? match[1] : undefined;
}

const attempt = (timestamp, isCorrect = true) => ({
  isCorrect,
  timestamp,
  durationMin: 0.05,
});

function assignment(legacyGroup, historicalCategoryLabel = '日本語') {
  const match = historicalIdentityMapping.pairAssignments.find(
    (candidate) =>
      candidate.historicalCategoryLabel === historicalCategoryLabel &&
      candidate.pairReference.pair.group === legacyGroup
  );
  assert(match, `missing mapping for ${historicalCategoryLabel}/${legacyGroup}`);
  return match;
}

function projectionFor(rows) {
  return projectPairProgressToContrasts(
    Object.fromEntries(
      rows.map(([legacyPairProgressKey, attempts]) => [
        legacyPairProgressKey,
        { attempts },
      ])
    )
  );
}

const inspect = (projection) =>
  inspectContrastKnowledge({
    projection,
    contrastRegistry,
    languageId: 'lang.japanese',
    evaluationTimestamp: 10_000,
    minimumAttributedAttemptCount: 1,
  });

/* ─── the hazard the source contracts below exist to prevent ─────────────── */

runTest('narrowing a projection falsely attests completeness', () => {
  const japanese = assignment('rL');
  const complete = projectionFor([
    [japanese.legacyPairProgressKey, [attempt(1_000), attempt(2_000)]],
    ['Unknown__rL__right_light', [attempt(3_000)]],
  ]);

  assert.strictEqual(inspect(complete).diagnostics.completeness, 'unattested');
  assert.ok(
    inspect(complete).entries.every(
      (entry) => entry.knowledge.standing === 'indeterminate'
    ),
    'the complete projection must fail closed'
  );

  // What a careless consumer would do: drop the diagnostics it does not
  // consider relevant to the language it cares about.
  const narrowed = {
    ...complete,
    unmappedEntries: [],
    malformedEntries: [],
    malformedAttempts: [],
  };

  assert.strictEqual(
    inspect(narrowed).diagnostics.completeness,
    'attested',
    'narrowing must be shown to flip completeness'
  );
  assert.ok(
    inspect(narrowed).entries.some(
      (entry) => entry.knowledge.standing === 'observed'
    ),
    'narrowing must be shown to manufacture a positive standing'
  );
});

/* ─── source contracts ───────────────────────────────────────────────────── */

const callers = sourceFiles(SRC).filter(
  (sourcePath) =>
    sourcePath !== INSPECTION_PATH &&
    fs.readFileSync(sourcePath, 'utf8').includes('inspectContrastKnowledge(')
);

runTest('inspectContrastKnowledge has exactly two reviewed callers', () => {
  assert.deepStrictEqual(
    callers.sort(),
    [REPORT_PATH, SUGGESTION_PATH].sort(),
    'A new ContrastKnowledge consumer must be reviewed against the ' +
      'completeness invariant before this list changes.'
  );
});

runTest('every caller forwards the projection unnarrowed', () => {
  for (const sourcePath of callers) {
    const blocks = callArgumentBlocks(
      fs.readFileSync(sourcePath, 'utf8'),
      'inspectContrastKnowledge'
    );
    assert.ok(blocks.length > 0, sourcePath);

    for (const block of blocks) {
      assert.ok(
        !block.includes('...'),
        `${sourcePath}: must not reconstruct the projection argument`
      );
      assert.strictEqual(
        suppliedIdentifier(block, 'projection'),
        'projection',
        `${sourcePath}: projection must be forwarded as a bare identifier`
      );
    }
  }
});

runTest('every caller supplies the canonical contrast registry', () => {
  for (const sourcePath of callers) {
    const source = fs.readFileSync(sourcePath, 'utf8');

    for (const block of callArgumentBlocks(
      source,
      'inspectContrastKnowledge'
    )) {
      assert.strictEqual(
        suppliedIdentifier(block, 'contrastRegistry'),
        'contrastRegistry',
        `${sourcePath}: contrastRegistry must be a bare identifier`
      );
    }

    assert.ok(
      source.includes(
        "import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry'"
      ),
      `${sourcePath}: must import the canonical contrastRegistry singleton`
    );
    assert.ok(
      !source.includes('createContrastRegistry'),
      `${sourcePath}: must not build a substitute registry`
    );
  }
});

runTest('no module reconstructs a contrast pair progress projection', () => {
  for (const sourcePath of sourceFiles(SRC)) {
    assert.ok(
      !/\.\.\.\s*projection\b/.test(fs.readFileSync(sourcePath, 'utf8')),
      `${sourcePath}: spreading a projection can drop its diagnostics`
    );
  }
});

console.log('\nAll ContrastKnowledge completeness-contract tests passed.');
