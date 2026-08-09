import type { Pair } from '@/src/constants/minimalPairs';
import {
  MAX_MASTERY_TIER,
  type MasteryMap,
} from '@/src/domain/masteryPersistence';

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
    const tier = mastery[group] ?? 1;
    completedLevels += Math.min(tier - 1, MAX_MASTERY_TIER);
    if (tier >= MAX_MASTERY_TIER) masteredGroups++;
  }

  return {
    totalGroups,
    masteredGroups,
    totalLevels: totalGroups * MAX_MASTERY_TIER,
    completedLevels,
  };
}
