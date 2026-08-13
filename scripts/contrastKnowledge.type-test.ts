import type {
  ContrastKnowledge,
  DeriveContrastKnowledgeInput,
} from '@/src/domain/contrast/contrastKnowledge';
import type { ContrastKnowledgeInspection } from '@/src/domain/contrast/contrastKnowledgeInspection';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;
type AllKeys<Value> = Value extends unknown ? keyof Value : never;

type ForbiddenKnowledgeFields =
  | 'tier'
  | 'speedTier'
  | 'fastStreak'
  | 'longStreak'
  | 'ability'
  | 'abilityScore'
  | 'confidenceScore'
  | 'accuracy'
  | 'priority'
  | 'score'
  | 'dueAt'
  | 'dueDate'
  | 'interval'
  | 'retention'
  | 'retentionEstimate'
  | 'reasons';

type _StandingHasExactlyFourMembers = Expect<
  Equal<
    ContrastKnowledge['standing'],
    'indeterminate' | 'unobserved' | 'insufficient' | 'observed'
  >
>;
type _KnowledgeHasNoProtectedFields = Expect<
  Equal<Extract<AllKeys<ContrastKnowledge>, ForbiddenKnowledgeFields>, never>
>;
type _InspectionHasNoCrossContrastSummary = Expect<
  Equal<
    Extract<
      AllKeys<ContrastKnowledgeInspection>,
      'ability' | 'abilityScore' | 'score' | 'summary'
    >,
    never
  >
>;
type _IndeterminateHasNoRecency = Expect<
  Equal<
    Extract<
      AllKeys<Extract<ContrastKnowledge, { standing: 'indeterminate' }>>,
      'recency'
    >,
    never
  >
>;
type _UnobservedHasNoRecency = Expect<
  Equal<
    Extract<
      AllKeys<Extract<ContrastKnowledge, { standing: 'unobserved' }>>,
      'recency'
    >,
    never
  >
>;

// @ts-expect-error Sufficiency policy has no domain default.
const missingCallerMinimum: DeriveContrastKnowledgeInput = {
  attributedAttempts: [],
  completeness: 'attested',
  evaluationTimestamp: 0,
};

void missingCallerMinimum;
