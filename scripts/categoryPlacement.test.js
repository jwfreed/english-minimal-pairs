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
  resolvePlacementStateForCategory,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'masteryPersistence.ts'));

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
  // Migration logic in the entry-state hook seeds the per-category key once.
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

// ── resolvePlacementStateForCategory (migration decision) ─────────────────────

const DONE = serializePlacementDone(); // '1'

runTest('fresh install: no keys → show placement, no migration actions', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: null, sentinelRaw: null });
  assert.strictEqual(d.shouldShowPlacement, true);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});

runTest('normal placed category: per-category key present → skip placement, no migration', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: DONE, legacyRaw: null, sentinelRaw: null });
  assert.strictEqual(d.shouldShowPlacement, false);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});

runTest('per-category key wins regardless of legacy and sentinel state', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: DONE, legacyRaw: DONE, sentinelRaw: DONE });
  assert.strictEqual(d.shouldShowPlacement, false);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});

runTest('first legacy upgrade: legacy present, no per-category key, no sentinel → seed and write sentinel', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: DONE, sentinelRaw: null });
  assert.strictEqual(d.shouldShowPlacement, false);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, true);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, true);
});

runTest('later category switch after migration: sentinel present → show placement, no re-seed', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: DONE, sentinelRaw: DONE });
  assert.strictEqual(d.shouldShowPlacement, true);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});

runTest('legacy key ignored once sentinel exists — legacy value must not suppress placement', () => {
  // Regardless of what legacyRaw holds, sentinel blocks any further migration.
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: DONE, sentinelRaw: DONE });
  assert.strictEqual(d.shouldShowPlacement, true);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
});

runTest('retake protection: after retake, sentinel prevents legacy key from re-seeding category', () => {
  // User retook placement (per-category key removed + sentinel written).
  // On next Practice-screen load: catRaw=null, legacyRaw=DONE, sentinelRaw=DONE.
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: DONE, sentinelRaw: DONE });
  assert.strictEqual(d.shouldShowPlacement, true);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});

runTest('no blind global grant: Category B after migration shows placement', () => {
  // Category A was seeded from legacy key (migration ran). Sentinel is now set.
  // Category B has never been placed → its categoryRaw is null.
  // Legacy key still exists but sentinel blocks it.
  const categoryBDecision = resolvePlacementStateForCategory({
    categoryRaw: null,   // Category B has no per-category key
    legacyRaw: DONE,     // legacy key still in storage
    sentinelRaw: DONE,   // migration already ran for Category A
  });
  assert.strictEqual(categoryBDecision.shouldShowPlacement, true);
  assert.strictEqual(categoryBDecision.shouldSeedCurrentCategoryFromLegacy, false);
});

runTest('no sentinel and no legacy: fresh category on fresh install → show placement', () => {
  const d = resolvePlacementStateForCategory({ categoryRaw: null, legacyRaw: null, sentinelRaw: null });
  assert.strictEqual(d.shouldShowPlacement, true);
  assert.strictEqual(d.shouldSeedCurrentCategoryFromLegacy, false);
  assert.strictEqual(d.shouldWriteLegacyMigrationSentinel, false);
});
