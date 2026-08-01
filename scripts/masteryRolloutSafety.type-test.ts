import type {
  SafetyAssessment,
  SafetyRecommendation,
} from '@/src/domain/masteryRolloutSafety';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;
type FunctionPropertyNames<Value> = {
  [Key in keyof Value]: Extract<Value[Key], (...args: never[]) => unknown> extends never
    ? never
    : Key;
}[keyof Value];

type _RecommendationHasExactlyThreeMembers = Expect<
  Equal<
    SafetyRecommendation,
    'ready' | 'blocked' | 'insufficient-evidence'
  >
>;
type _AssessmentHasNoFunctionProperties = Expect<
  Equal<FunctionPropertyNames<SafetyAssessment>, never>
>;
