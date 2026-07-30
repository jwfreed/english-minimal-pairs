import {
  historicalIdentityMapping,
  type HistoricalContrastAssignment,
} from '@/src/domain/compatibility/historicalIdentityMapping';
import type {
  ContrastId,
  LanguageId,
} from '@/src/domain/identity';

const languageId: LanguageId | undefined =
  historicalIdentityMapping.resolveMasteryKey('@mastery_日本語');
const contrastId: ContrastId | undefined =
  historicalIdentityMapping.resolveContrast('日本語', 'rL');

// @ts-expect-error Legacy contrast identity always requires label and group.
historicalIdentityMapping.resolveContrast('rL');

// @ts-expect-error LanguageId and ContrastId remain intentionally distinct.
const contrastFromMastery: ContrastId | undefined = languageId;

// @ts-expect-error ContrastId and LanguageId remain intentionally distinct.
const languageFromContrast: LanguageId | undefined = contrastId;

// @ts-expect-error Released mapping rows are immutable.
historicalIdentityMapping.contrastAssignments.push(
  {} as HistoricalContrastAssignment
);

void contrastFromMastery;
void languageFromContrast;
