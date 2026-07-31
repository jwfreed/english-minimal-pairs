import type { LanguageId } from '@/src/domain/identity';
import { defineLanguageId } from '@/src/domain/identity';
import { reportMasteryRolloutDiagnostic } from '@/src/analytics/masteryRolloutDiagnostics';
import {
  CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
  CONTRAST_MASTERY_SCHEMA_VERSION,
  serializeContrastMasteryDocument,
  serializeContrastMasteryMigrationState,
  validateContrastMasteryDocument,
  validateContrastMasteryMigrationState,
  type ContrastMasteryDocument,
  type ContrastMasteryMigrationState,
} from '@/src/domain/contrastMasteryPersistence';

export const CONTRAST_MASTERY_STORAGE_KEY_PREFIX = '@masteryByContrast_';
export const CONTRAST_MASTERY_MIGRATION_KEY_PREFIX =
  '@masteryByContrastMigration_';

export interface MasteryKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  /**
   * setItem replaces one key with one complete string value. Stable mastery
   * atomicity relies on this whole-value storage boundary; records are never
   * persisted individually by this adapter.
   */
  setItem(key: string, value: string): Promise<void>;
}

export type MasteryStorageReadResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'missing' }
  | {
      readonly status: 'malformed';
      readonly raw: string;
      readonly error: unknown;
    }
  | {
      readonly status: 'unsupported-version';
      readonly version: unknown;
      readonly raw: string;
    }
  | { readonly status: 'storage-error'; readonly error: unknown };

export type MasteryStorageWriteResult =
  | { readonly status: 'written' }
  | { readonly status: 'storage-error'; readonly error: unknown };

export function buildContrastMasteryStorageKey(languageId: LanguageId): string {
  return `${CONTRAST_MASTERY_STORAGE_KEY_PREFIX}${defineLanguageId(languageId)}`;
}

export function buildContrastMasteryMigrationKey(
  languageId: LanguageId
): string {
  return `${CONTRAST_MASTERY_MIGRATION_KEY_PREFIX}${defineLanguageId(languageId)}`;
}

function parsedSchemaVersion(raw: string): unknown {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return (parsed as { schemaVersion?: unknown }).schemaVersion;
    }
  } catch {
    // The caller will report malformed.
  }
  return undefined;
}

async function readValidated<T>(
  storage: MasteryKeyValueStorage,
  key: string,
  supportedVersion: number,
  validate: (value: unknown) => T
): Promise<MasteryStorageReadResult<T>> {
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch (error) {
    return { status: 'storage-error', error };
  }
  if (raw === null) return { status: 'missing' };

  const version = parsedSchemaVersion(raw);
  if (version !== undefined && version !== supportedVersion) {
    return { status: 'unsupported-version', version, raw };
  }
  try {
    return { status: 'ok', value: validate(JSON.parse(raw)) };
  } catch (error) {
    return { status: 'malformed', raw, error };
  }
}

export async function readContrastMastery(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<MasteryStorageReadResult<ContrastMasteryDocument>> {
  const result = await readValidated(
    storage,
    buildContrastMasteryStorageKey(languageId),
    CONTRAST_MASTERY_SCHEMA_VERSION,
    validateContrastMasteryDocument
  );
  reportMasteryRolloutDiagnostic({
    name: 'stable-read',
    status: result.status,
  });
  if (result.status === 'storage-error') {
    reportMasteryRolloutDiagnostic({
      name: 'storage-failure',
      operation: 'read-stable',
    });
  }
  return result;
}

export async function writeContrastMastery(
  storage: MasteryKeyValueStorage,
  document: ContrastMasteryDocument
): Promise<MasteryStorageWriteResult> {
  try {
    const serializedDocument = serializeContrastMasteryDocument(document);
    await storage.setItem(
      buildContrastMasteryStorageKey(document.languageId),
      serializedDocument
    );
    return { status: 'written' };
  } catch (error) {
    reportMasteryRolloutDiagnostic({
      name: 'storage-failure',
      operation: 'write-stable',
    });
    return { status: 'storage-error', error };
  }
}

export async function readContrastMasteryMigrationState(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<MasteryStorageReadResult<ContrastMasteryMigrationState>> {
  const result = await readValidated(
    storage,
    buildContrastMasteryMigrationKey(languageId),
    CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
    validateContrastMasteryMigrationState
  );
  if (result.status === 'storage-error') {
    reportMasteryRolloutDiagnostic({
      name: 'storage-failure',
      operation: 'read-migration-state',
    });
  }
  return result;
}

export async function writeContrastMasteryMigrationState(
  storage: MasteryKeyValueStorage,
  state: ContrastMasteryMigrationState
): Promise<MasteryStorageWriteResult> {
  try {
    await storage.setItem(
      buildContrastMasteryMigrationKey(state.languageId),
      serializeContrastMasteryMigrationState(state)
    );
    return { status: 'written' };
  } catch (error) {
    reportMasteryRolloutDiagnostic({
      name: 'storage-failure',
      operation: 'write-migration-state',
    });
    return { status: 'storage-error', error };
  }
}
