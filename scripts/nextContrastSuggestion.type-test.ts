import type {
  ContrastPracticeSuggestion,
} from '@/src/domain/practice/nextContrastSuggestion';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;
type ActionableSuggestion = Exclude<ContrastPracticeSuggestion, null>;

type _KindsAreExhaustive = Expect<
  Equal<
    ActionableSuggestion['kind'],
    'continue-current' | 'try-unobserved'
  >
>;
type _ActionableFieldsAreMinimal = Expect<
  Equal<keyof ActionableSuggestion, 'kind' | 'contrastId'>
>;

declare const suggestion: ContrastPracticeSuggestion;

if (suggestion) {
  switch (suggestion.kind) {
    case 'continue-current':
    case 'try-unobserved':
      void suggestion.contrastId;
      break;
    default: {
      const exhaustive: never = suggestion;
      void exhaustive;
    }
  }
}
