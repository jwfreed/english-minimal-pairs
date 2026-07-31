export type MasteryRolloutDiagnosticEvent =
  | {
      readonly name: 'stable-read';
      readonly status:
        | 'ok'
        | 'missing'
        | 'malformed'
        | 'unsupported-version'
        | 'storage-error';
    }
  | {
      readonly name: 'legacy-fallback';
      readonly reason: 'missing-stable';
      readonly expected: true;
    }
  | {
      readonly name: 'shadow-comparison';
      readonly status: 'compared' | 'stable-missing' | 'blocked';
      readonly divergenceCount: number;
      readonly unexplainedDivergenceCount: number;
      readonly unresolvedMappingCount: number;
    }
  | {
      readonly name: 'reconciliation-conflict';
      readonly count: number;
    }
  | {
      readonly name: 'blocked-migration';
      readonly reason:
        | 'malformed-stable'
        | 'unsupported-stable-version'
        | 'malformed-legacy';
    }
  | {
      readonly name: 'compatibility-write';
      readonly status: 'complete' | 'partial' | 'failed';
      readonly legacyStatus: 'not-attempted' | 'written' | 'failed' | 'blocked';
      readonly stableStatus: 'not-attempted' | 'written' | 'failed' | 'blocked';
    }
  | {
      readonly name: 'orphan-adoption';
      readonly status: 'complete' | 'partial' | 'failed';
      readonly outcome: string;
      readonly adoptedRecords: number;
    }
  | {
      readonly name: 'storage-failure';
      readonly operation: string;
    };

export interface MasteryRolloutMetrics {
  readonly stableReadsAttempted: number;
  readonly stableReadsSuccessful: number;
  readonly legacyFallbacksUsed: number;
  readonly reconciliationConflicts: number;
  readonly blockedMigrations: number;
  readonly orphanAdoptionEvents: number;
  readonly compatibilityWrites: number;
  readonly partialWrites: number;
  readonly storageFailures: number;
  readonly shadowComparisons: number;
  readonly shadowDivergences: number;
  readonly unresolvedMappings: number;
}

export type MasteryRolloutDiagnosticSink = (
  event: MasteryRolloutDiagnosticEvent
) => void | Promise<void>;

const metrics: {
  -readonly [Key in keyof MasteryRolloutMetrics]: MasteryRolloutMetrics[Key];
} = {
  stableReadsAttempted: 0,
  stableReadsSuccessful: 0,
  legacyFallbacksUsed: 0,
  reconciliationConflicts: 0,
  blockedMigrations: 0,
  orphanAdoptionEvents: 0,
  compatibilityWrites: 0,
  partialWrites: 0,
  storageFailures: 0,
  shadowComparisons: 0,
  shadowDivergences: 0,
  unresolvedMappings: 0,
};

const defaultSink: MasteryRolloutDiagnosticSink = (event) => {
  if (__DEV__) {
    console.debug('[mastery-rollout]', event.name, event);
  }
};

let sink: MasteryRolloutDiagnosticSink = defaultSink;

function updateMetrics(event: MasteryRolloutDiagnosticEvent): void {
  switch (event.name) {
    case 'stable-read':
      metrics.stableReadsAttempted += 1;
      if (event.status === 'ok') metrics.stableReadsSuccessful += 1;
      return;
    case 'legacy-fallback':
      metrics.legacyFallbacksUsed += 1;
      return;
    case 'shadow-comparison':
      metrics.shadowComparisons += 1;
      metrics.shadowDivergences += event.divergenceCount;
      metrics.unresolvedMappings += event.unresolvedMappingCount;
      return;
    case 'reconciliation-conflict':
      metrics.reconciliationConflicts += event.count;
      return;
    case 'blocked-migration':
      metrics.blockedMigrations += 1;
      return;
    case 'compatibility-write':
      metrics.compatibilityWrites += 1;
      if (event.status === 'partial') metrics.partialWrites += 1;
      return;
    case 'orphan-adoption':
      metrics.orphanAdoptionEvents += 1;
      return;
    case 'storage-failure':
      metrics.storageFailures += 1;
  }
}

function reportDeliveryFailure(error: unknown): void {
  if (__DEV__) {
    console.warn('[mastery-rollout] Diagnostic delivery failed', error);
  }
}

/**
 * Internal diagnostics are isolated from learner behavior. A broken observer
 * can never block a mastery read, write, reset, or placement action.
 */
export function reportMasteryRolloutDiagnostic(
  event: MasteryRolloutDiagnosticEvent
): void {
  updateMetrics(event);
  try {
    const delivery = sink(event);
    if (delivery) void delivery.catch(reportDeliveryFailure);
  } catch (error) {
    reportDeliveryFailure(error);
  }
}

export function setMasteryRolloutDiagnosticSink(
  nextSink: MasteryRolloutDiagnosticSink | null
): () => void {
  const previousSink = sink;
  sink = nextSink ?? defaultSink;
  return () => {
    sink = previousSink;
  };
}

export function getMasteryRolloutMetrics(): MasteryRolloutMetrics {
  return Object.freeze({ ...metrics });
}

/** Keeps deterministic tests isolated; production code does not reset metrics. */
export function resetMasteryRolloutMetrics(): void {
  for (const key of Object.keys(metrics) as (keyof MasteryRolloutMetrics)[]) {
    metrics[key] = 0;
  }
}
