/**
 * Recovery of a blocked (malformed) stored record.
 *
 * Storage offers no multi-key transaction, so recovery is a short protocol in
 * which every step is safe to stop after and safe to repeat:
 *
 *   1. prepare — copy the original bytes to a backup key and read the copy
 *      back to verify it. Nothing else changes. The learner is then asked.
 *   2. apply  — only if the original still holds exactly the bytes that were
 *      backed up and the backup still matches, replace the original with its
 *      recoverable entries.
 *
 * Interrupted after step 1: the original is untouched and an extra backup
 * exists; preparing again reuses it. Interrupted during step 2: a single-key
 * write either happened or did not, and the backup holds the original either
 * way. Backups are never deleted or overwritten by the app.
 */

interface BackupStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** What a recovery would do, computed before the learner is asked. */
export interface RecoveryPlan {
  /** The exact stored bytes that were backed up. */
  raw: string;
  backupKey: string;
  /** Entries that will be kept. Zero means recovery resets this record. */
  keptCount: number;
}

export const RECOVERY_BACKUP_PREFIX = '@recoveryBackup';

/**
 * Stores an exact copy of `raw` under a key used for nothing else and verifies
 * it by reading it back. An identical existing backup is reused; a different
 * one is never overwritten (a new numbered key is used instead).
 */
export async function writeVerifiedBackup(
  storage: BackupStorage,
  key: string,
  raw: string
): Promise<string> {
  for (let n = 1; ; n += 1) {
    const backupKey = `${RECOVERY_BACKUP_PREFIX}_${n}_${key}`;
    const existing = await storage.getItem(backupKey);
    if (existing === raw) return backupKey;
    if (existing === null) {
      await storage.setItem(backupKey, raw);
      if ((await storage.getItem(backupKey)) !== raw) {
        throw new Error('Recovery backup could not be verified');
      }
      return backupKey;
    }
  }
}

/**
 * Throws unless the record still holds exactly what the plan backed up and
 * the backup still matches it. Recovery must never replace a value newer than
 * the one the learner was asked about, nor one without a verified copy.
 */
export async function assertPlanStillValid(
  storage: BackupStorage,
  key: string,
  plan: RecoveryPlan
): Promise<void> {
  if ((await storage.getItem(key)) !== plan.raw) {
    throw new Error('Stored progress changed since recovery was prepared');
  }
  if ((await storage.getItem(plan.backupKey)) !== plan.raw) {
    throw new Error('Recovery backup no longer matches the stored progress');
  }
}
