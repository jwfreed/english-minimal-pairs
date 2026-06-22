'use strict';

const path = require('path');
const fs = require('fs');
const { loadRepoData } = require('./validate-data');

const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, 'docs', 'sparse-tier-inventory.md');

const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, INFO: 2, POSSIBLE_GAP: 3 };

function auditSparseTiers(categories) {
  const groupMap = new Map();

  for (const cat of categories) {
    const catName = cat.category;
    for (const pair of cat.pairs) {
      const key = `${catName}||${pair.group}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          categoryName: catName,
          groupId: pair.group,
          label: `${pair.contrastPhoneme1}/${pair.contrastPhoneme2}`,
          tierPairs: new Map(),
        });
      }
      const entry = groupMap.get(key);
      if (!entry.tierPairs.has(pair.difficulty)) {
        entry.tierPairs.set(pair.difficulty, []);
      }
      entry.tierPairs.get(pair.difficulty).push(pair);
    }
  }

  const sortedGroups = [...groupMap.values()].sort((a, b) => {
    const catCmp = a.categoryName.localeCompare(b.categoryName);
    return catCmp !== 0 ? catCmp : a.groupId.localeCompare(b.groupId);
  });

  let totalGroupTierCombos = 0;
  let healthyCount = 0;
  const sparseTierRows = [];
  const possibleGapRows = [];

  for (const group of sortedGroups) {
    const tiers = [...group.tierPairs.keys()].sort((a, b) => a - b);
    if (tiers.length === 0) continue;
    const minTier = tiers[0];
    const maxTier = tiers[tiers.length - 1];

    totalGroupTierCombos += tiers.length;

    for (const tier of tiers) {
      const pairs = [...group.tierPairs.get(tier)].sort(
        (a, b) => a.word1.localeCompare(b.word1) || a.word2.localeCompare(b.word2)
      );

      if (pairs.length >= 2) {
        healthyCount++;
      } else {
        sparseTierRows.push({
          categoryName: group.categoryName,
          groupId: group.groupId,
          label: group.label,
          tier,
          pairCount: pairs.length,
          pairs: pairs.map(p => `${p.word1}/${p.word2}`),
          severity: tier <= 3 ? 'HIGH' : 'MEDIUM',
        });
      }
    }

    for (let tier = minTier + 1; tier < maxTier; tier++) {
      if (!group.tierPairs.has(tier)) {
        possibleGapRows.push({
          categoryName: group.categoryName,
          groupId: group.groupId,
          label: group.label,
          missingTier: tier,
          existingTierRange: `${minTier}–${maxTier}`,
          severity: 'POSSIBLE_GAP',
          note: 'Absent intermediate tier; also flagged by validate-data GROUP_TIER_PRESENT.',
        });
      }
    }
  }

  sparseTierRows.sort((a, b) => {
    const sevCmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevCmp !== 0) return sevCmp;
    const catCmp = a.categoryName.localeCompare(b.categoryName);
    if (catCmp !== 0) return catCmp;
    const grpCmp = a.groupId.localeCompare(b.groupId);
    if (grpCmp !== 0) return grpCmp;
    return a.tier - b.tier;
  });

  possibleGapRows.sort((a, b) => {
    const catCmp = a.categoryName.localeCompare(b.categoryName);
    if (catCmp !== 0) return catCmp;
    const grpCmp = a.groupId.localeCompare(b.groupId);
    if (grpCmp !== 0) return grpCmp;
    return a.missingTier - b.missingTier;
  });

  const expansionMap = new Map();
  for (const row of sparseTierRows) {
    const key = `${row.categoryName}||${row.groupId}`;
    if (!expansionMap.has(key)) {
      expansionMap.set(key, {
        categoryName: row.categoryName,
        groupId: row.groupId,
        label: row.label,
        highCount: 0,
        mediumCount: 0,
        sparseTiers: [],
      });
    }
    const entry = expansionMap.get(key);
    if (row.severity === 'HIGH') entry.highCount++;
    else if (row.severity === 'MEDIUM') entry.mediumCount++;
    entry.sparseTiers.push(row.tier);
  }

  const expansionCandidates = [...expansionMap.values()].sort((a, b) => {
    const highCmp = b.highCount - a.highCount;
    if (highCmp !== 0) return highCmp;
    const medCmp = b.mediumCount - a.mediumCount;
    if (medCmp !== 0) return medCmp;
    const catCmp = a.categoryName.localeCompare(b.categoryName);
    if (catCmp !== 0) return catCmp;
    return a.groupId.localeCompare(b.groupId);
  });

  return {
    totalGroups: sortedGroups.length,
    totalGroupTierCombos,
    healthyCount,
    sparseTierCount: sparseTierRows.length,
    possibleGapCount: possibleGapRows.length,
    sparseTierRows,
    possibleGapRows,
    expansionCandidates,
  };
}

function generateMarkdownReport(_result) {
  return '';
}

module.exports = { auditSparseTiers, generateMarkdownReport, REPORT_PATH };
