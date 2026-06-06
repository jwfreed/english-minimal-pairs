const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  PLACEMENT_DONE_KEY,
  PLACEMENT_LEGACY_MIGRATION_KEY,
  buildPlacementStorageKey,
  serializePlacementDone,
  parsePlacementDone,
  shouldShowPlacementTestForCategory,
} = loadTsModule(path.join(__dirname, '..', 'app', 'domain', 'masteryPersistence.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// ── buildPlacementStorageKey ──────────────────────────────────────────────────

runTest('buildPlacementStorageKey generates per-category key', () => {
  assert.strictEqual(buildPlacementStorageKey('日本語'), '@placementDone_日本語');
  assert.strictEqual(buildPlacementStorageKey('Español'), '@placementDone_Español');
  assert.strictEqual(buildPlacementStorageKey('Mandarin'), '@placementDone_Mandarin');
});

runTest('buildPlacementStorageKey is distinct from global legacy key', () => {
  const catKey = buildPlacementStorageKey('日本語');
  assert.notStrictEqual(catKey, PLACEMENT_DONE_KEY);
});

runTest('buildPlacementStorageKey is deterministic', () => {
  assert.strictEqual(buildPlacementStorageKey('Thai'), buildPlacementStorageKey('Thai'));
});

// ── PLACEMENT_LEGACY_MIGRATION_KEY ────────────────────────────────────────────

runTest('PLACEMENT_LEGACY_MIGRATION_KEY is exported with correct value', () => {
  assert.strictEqual(PLACEMENT_LEGACY_MIGRATION_KEY, '@placementDoneLegacyMigrated');
});

runTest('PLACEMENT_LEGACY_MIGRATION_KEY is distinct from PLACEMENT_DONE_KEY and per-category keys', () => {
  assert.notStrictEqual(PLACEMENT_LEGACY_MIGRATION_KEY, PLACEMENT_DONE_KEY);
  assert.notStrictEqual(PLACEMENT_LEGACY_MIGRATION_KEY, buildPlacementStorageKey('Japanese'));
});

// ── shouldShowPlacementTestForCategory (1-arg, per-category key only) ─────────

runTest('no per-category key → show placement (fresh install)', () => {
  assert.strictEqual(shouldShowPlacementTestForCategory(null), true);
});

runTest('per-category key present → skip placement', () => {
  assert.strictEqual(shouldShowPlacementTestForCategory(serializePlacementDone()), false);
});

runTest('per-category key present with any non-null value → skip placement', () => {
  assert.strictEqual(shouldShowPlacementTestForCategory('1'), false);
  assert.strictEqual(shouldShowPlacementTestForCategory('garbage'), false);
  assert.strictEqual(shouldShowPlacementTestForCategory('{bad json}'), false);
});

runTest('no per-category key → show placement regardless of what legacy key holds', () => {
  // The per-category helper does not check the legacy key.
  // Migration logic (in component) handles seeding the per-category key once.
  // After migration, the legacy key has no role in this pure helper.
  assert.strictEqual(shouldShowPlacementTestForCategory(null), true);
});

// ── Independent per-category keys ────────────────────────────────────────────

runTest('different categories have independent keys', () => {
  assert.notStrictEqual(buildPlacementStorageKey('Japanese'), buildPlacementStorageKey('Mandarin'));

  // Category A placed, category B not placed
  assert.strictEqual(shouldShowPlacementTestForCategory(serializePlacementDone()), false);
  assert.strictEqual(shouldShowPlacementTestForCategory(null), true);
});

runTest('retake resets current category — other category remains placed', () => {
  // After retake of category A: its raw = null → show placement
  assert.strictEqual(shouldShowPlacementTestForCategory(null), true);
  // Category B untouched: still has its key → skip placement
  assert.strictEqual(shouldShowPlacementTestForCategory(serializePlacementDone()), false);
});
