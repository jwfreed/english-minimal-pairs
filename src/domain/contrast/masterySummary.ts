import type { Pair } from '@/src/constants/minimalPairs';
import {
  FINAL_PRACTICE_TIER,
  completedTiersOf,
  isMasteredLevel,
} from '@/src/domain/masteryLevel';
import type { MasteryMap } from '@/src/domain/masteryPersistence';

export interface MasterySummary {
  totalGroups: number;
  masteredGroups: number;
  totalLevels: number;
  completedLevels: number;
}

interface BuildMasterySummaryInput {
  pairs: readonly Pair[];
  mastery: Readonly<MasteryMap>;
}

export function buildMasterySummary({
  pairs,
  mastery,
}: BuildMasterySummaryInput): MasterySummary {
  const groups = new Set<string>();
  pairs.forEach((pair) => groups.add(pair.group));
  const totalGroups = groups.size;
  let masteredGroups = 0;
  let completedLevels = 0;

  for (const group of groups) {
    completedLevels += completedTiersOf(mastery[group]);
    if (isMasteredLevel(mastery[group])) masteredGroups++;
  }

  return {
    totalGroups,
    masteredGroups,
    totalLevels: totalGroups * FINAL_PRACTICE_TIER,
    completedLevels,
  };
}
