import {
  historicalIdentityMapping,
  type HistoricalPairAssignment,
} from '@/src/domain/compatibility/historicalIdentityMapping';
import {
  LEGACY_MAX_ATTEMPTS_PER_PAIR,
  LEGACY_PAIR_PROGRESS_STORAGE_KEY,
  type LegacyAttempt,
  type LegacyLearnerStateFixture,
  type LegacyStorageEntry,
} from './legacyLearnerStateVerification';

function attempt(timestamp: number, isCorrect = true): LegacyAttempt {
  return { isCorrect, timestamp, durationMin: 0.05 };
}

function mastery(
  categoryLabel: string,
  value: unknown
): LegacyStorageEntry {
  return {
    key: `@mastery_${categoryLabel}`,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  };
}

function placement(categoryLabel: string): LegacyStorageEntry {
  return { key: `@placementDone_${categoryLabel}`, value: '1' };
}

function progress(
  rows: readonly [string, readonly unknown[] | unknown][]
): LegacyStorageEntry {
  return {
    key: LEGACY_PAIR_PROGRESS_STORAGE_KEY,
    value: JSON.stringify(
      Object.fromEntries(
        rows.map(([key, attempts]) => [key, { attempts }])
      )
    ),
  };
}

function pair(
  categoryLabel: string,
  legacyGroup: string,
  pairOffset = 0
): HistoricalPairAssignment {
  const rows = historicalIdentityMapping.pairAssignments.filter(
    (assignment) =>
      assignment.historicalCategoryLabel === categoryLabel &&
      assignment.pairReference.pair.group === legacyGroup
  );
  const row = rows[pairOffset];
  if (!row) {
    throw new Error(
      `Missing fixture pair mapping for "${categoryLabel}" and "${legacyGroup}"`
    );
  }
  return row;
}

export const FIXTURE_PAIR_KEYS = Object.freeze({
  japaneseRL: pair('日本語', 'rL').legacyPairProgressKey,
  japaneseBV: pair('日本語', 'bV').legacyPairProgressKey,
  spanishAVsE: pair('Español', 'aVsE').legacyPairProgressKey,
  historicalSpanishAVsE: pair('idioma español', 'aVsE')
    .legacyPairProgressKey,
});

const cappedAttempts = Array.from(
  { length: LEGACY_MAX_ATTEMPTS_PER_PAIR + 5 },
  (_, index) => attempt(10_000 + index, index % 2 === 0)
);

export const LEGACY_LEARNER_STATE_FIXTURES: readonly LegacyLearnerStateFixture[] =
  Object.freeze([
    {
      name: 'fresh-learner',
      storageEntries: [],
    },
    {
      name: 'one-language-learner',
      storageEntries: [
        mastery('日本語', { rL: 2, bV: 3 }),
        progress([
          [
            FIXTURE_PAIR_KEYS.japaneseRL,
            [attempt(1), attempt(2, false)],
          ],
        ]),
        placement('日本語'),
      ],
    },
    {
      name: 'multi-language-learner',
      storageEntries: [
        mastery('日本語', { rL: 2 }),
        mastery('Español', { aVsE: 4 }),
        progress([
          [FIXTURE_PAIR_KEYS.japaneseRL, [attempt(10)]],
          [
            FIXTURE_PAIR_KEYS.spanishAVsE,
            [attempt(11), attempt(12, false)],
          ],
        ]),
        placement('日本語'),
        placement('Español'),
      ],
    },
    {
      name: 'historical-alias-only-mastery',
      storageEntries: [mastery('idioma español', { aVsE: 3 })],
    },
    {
      name: 'historical-and-current-alias-mastery',
      storageEntries: [
        mastery('idioma español', { aVsE: 4 }),
        mastery('Español', { aVsE: 4 }),
      ],
    },
    {
      name: 'conflicting-tiers-across-aliases',
      storageEntries: [
        mastery('idioma español', { aVsE: 5 }),
        mastery('Español', { aVsE: 2 }),
      ],
    },
    {
      name: 'unknown-group-recognized-label',
      storageEntries: [mastery('日本語', { notReleased: 4 })],
    },
    {
      name: 'recognized-group-unknown-label',
      storageEntries: [mastery('Unknown language', { rL: 3 })],
    },
    {
      name: 'malformed-mastery-payload',
      storageEntries: [
        mastery('日本語', '{"rL":3,"bV":"not-a-tier"}'),
        mastery('Español', '{bad json'),
      ],
    },
    {
      name: 'malformed-pair-progress-key',
      storageEntries: [
        progress([
          ['日本語_rL_right_light', [attempt(20), attempt(21, false)]],
        ]),
      ],
    },
    {
      name: 'valid-attempts-across-contrasts',
      storageEntries: [
        progress([
          [FIXTURE_PAIR_KEYS.japaneseRL, [attempt(30), attempt(31)]],
          [FIXTURE_PAIR_KEYS.japaneseBV, [attempt(32, false)]],
          [FIXTURE_PAIR_KEYS.spanishAVsE, [attempt(33)]],
        ]),
      ],
    },
    {
      name: 'capped-attempt-history',
      storageEntries: [
        progress([[FIXTURE_PAIR_KEYS.japaneseRL, cappedAttempts]]),
      ],
    },
    {
      name: 'partial-corrupt-global-pair-progress',
      storageEntries: [
        {
          key: LEGACY_PAIR_PROGRESS_STORAGE_KEY,
          value: JSON.stringify({
            [FIXTURE_PAIR_KEYS.japaneseRL]: {
              attempts: [
                attempt(40),
                { isCorrect: 'yes', timestamp: 41, durationMin: 0.05 },
              ],
            },
            'Unknown__rL__right_light': {
              attempts: [attempt(42)],
            },
            '日本語__rL__broken': {
              attempts: 'not-an-array',
            },
          }),
        },
      ],
    },
    {
      name: 'learner-reset-state',
      storageEntries: [
        {
          key: '@placementDoneLegacyMigrated',
          value: '1',
        },
      ],
    },
    {
      name: 'placement-lowered-mastery-state',
      storageEntries: [
        mastery('日本語', { rL: 2, bV: 2, sTheta: 2, aVsUh: 2, iVsI: 2 }),
        placement('日本語'),
      ],
    },
    {
      name: 'post-rollback-divergence',
      storageEntries: [
        mastery('idioma español', { aVsE: 4 }),
        mastery('Español', { aVsE: 4 }),
        progress([
          [
            FIXTURE_PAIR_KEYS.historicalSpanishAVsE,
            [attempt(50), attempt(51, false)],
          ],
          [FIXTURE_PAIR_KEYS.spanishAVsE, [attempt(52)]],
        ]),
        placement('idioma español'),
      ],
    },
  ]);

export function fixtureNamed(name: string): LegacyLearnerStateFixture {
  const fixture = LEGACY_LEARNER_STATE_FIXTURES.find(
    (candidate) => candidate.name === name
  );
  if (!fixture) throw new Error(`Unknown legacy learner fixture "${name}"`);
  return fixture;
}

export const ROLLBACK_PRACTICE_ATTEMPT = Object.freeze(attempt(53, true));
