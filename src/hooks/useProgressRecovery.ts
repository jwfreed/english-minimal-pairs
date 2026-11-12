import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { tKeys } from '@/src/constants/translationKeys';
import { useLanguage } from '@/src/context/LanguageContext';
import type { RecoveryPlan } from '@/src/storage/recoveryBackup';

/** One stored record (this category's mastery, or attempt history). */
export interface RecoverableStore {
  blocked: boolean;
  /** Backs up the malformed record; null when it is not malformed. */
  prepare: () => Promise<RecoveryPlan | null>;
  /** Replaces the record with its recoverable entries. */
  apply: (plan: RecoveryPlan) => Promise<void>;
}

export type RecoveryOutcome = 'recovered' | 'cancelled' | 'failed';

/**
 * Explicit recovery of blocked progress (protocol in recoveryBackup.ts).
 * Every blocked store is backed up and verified before the learner is asked;
 * nothing is replaced without confirmation. `failed` covers a store that
 * cannot be read, a backup that could not be made or verified, and a
 * replacement that was rejected — including when another store was
 * recovered, so a partial result is never reported as done. A store whose
 * `prepare` resolves null needed no replacement and was unblocked by it.
 */
export async function recoverBlockedProgress(
  stores: readonly RecoverableStore[],
  confirm: (resetsEverything: boolean) => Promise<boolean>
): Promise<RecoveryOutcome> {
  const planned: { store: RecoverableStore; plan: RecoveryPlan }[] = [];
  try {
    for (const store of stores) {
      if (!store.blocked) continue;
      const plan = await store.prepare();
      if (plan) planned.push({ store, plan });
    }
  } catch {
    return 'failed';
  }
  if (planned.length === 0) return 'recovered';

  const resetsEverything = planned.every(({ plan }) => plan.keptCount === 0);
  if (!(await confirm(resetsEverything))) return 'cancelled';

  let failed = false;
  for (const { store, plan } of planned) {
    try {
      await store.apply(plan);
    } catch {
      failed = true;
    }
  }
  return failed ? 'failed' : 'recovered';
}

/** The recovery flow with its confirmation and result dialogs. */
export function useProgressRecovery(stores: readonly RecoverableStore[]) {
  const { translate } = useLanguage();
  // Held while storage work is in progress, not while the dialog is open: a
  // dialog the platform never answers must not disable recovery for good.
  const running = useRef(false);

  return useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const title = translate(tKeys.recoverProgress);
      const outcome = await recoverBlockedProgress(
        stores,
        (resetsEverything) =>
          new Promise<boolean>((resolve) => {
            running.current = false;
            const answer = (confirmed: boolean) => {
              running.current = confirmed;
              resolve(confirmed);
            };
            Alert.alert(
              title,
              translate(
                resetsEverything
                  ? tKeys.recoverConfirmReset
                  : tKeys.recoverConfirmKeep
              ),
              [
                {
                  text: translate(tKeys.cancel),
                  style: 'cancel',
                  onPress: () => answer(false),
                },
                {
                  text: title,
                  style: 'destructive',
                  onPress: () => answer(true),
                },
              ],
              { cancelable: true, onDismiss: () => answer(false) }
            );
          })
      );
      if (outcome !== 'cancelled') {
        Alert.alert(
          title,
          translate(
            outcome === 'recovered' ? tKeys.recoverDone : tKeys.recoverFailed
          )
        );
      }
    } finally {
      running.current = false;
    }
  }, [stores, translate]);
}
