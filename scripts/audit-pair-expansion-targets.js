'use strict';

const path = require('path');
const fs = require('fs');
const { loadRepoData } = require('./validate-data');

const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, 'docs', 'pair-expansion-targets.md');

const TARGET_PAIRS_BY_TIER = {
  1: 3,
  2: 3,
  3: 3,
  4: 2,
  5: 2,
  6: 2,
};

const TARGET_MODEL = [
  { tier: 1, target: 3, rationale: 'Early practice; needs variety and familiar words' },
  { tier: 2, target: 3, rationale: 'Early practice; prevents memorization' },
  { tier: 3, target: 3, rationale: 'Early practice; supports contrast generalization' },
  { tier: 4, target: 2, rationale: 'Upper practice; minimum variety' },
  { tier: 5, target: 2, rationale: 'Upper practice; minimum variety' },
  { tier: 6, target: 2, rationale: 'Upper practice; minimum variety' },
];

// Expected exception shape:
// {
//   categoryKey: 'japanese',
//   groupId: 'exampleGroup',
//   tier: 6,
//   reason: 'needs_linguistic_review',
//   status: 'deferred',
//   note: 'No clean, familiar tier-6 candidates identified yet.',
// }
const TARGET_EXCEPTIONS = [];

const TIERS = Object.keys(TARGET_PAIRS_BY_TIER).map(Number).sort((a, b) => a - b);
const SEVERITY_ORDER = { HIGH: 0, MEDIUM: 1, EXCEPTION: 2, LOW: 3 };

function compareText(a, b) {
  return String(a).localeCompare(String(b));
}

function pairDisplay(pair) {
  return `${pair.word1}/${pair.word2}`;
}

function sortPairs(pairs) {
  return [...pairs].sort(
    (a, b) => compareText(a.word1, b.word1) || compareText(a.word2, b.word2)
  );
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function buildExceptionKey(categoryKey, groupId, tier) {
  return `${categoryKey}||${groupId}||${tier}`;
}

function buildGroupMap(categories) {
  const groupMap = new Map();

  for (const category of categories) {
    const categoryKey = category.category;
    const categoryLabel = category.category;
    const pairs = Array.isArray(category.pairs) ? category.pairs : [];

    for (const pair of pairs) {
      const key = `${categoryKey}||${pair.group}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          categoryKey,
          categoryLabel,
          groupId: pair.group,
          contrastLabel: `${pair.contrastPhoneme1}/${pair.contrastPhoneme2}`,
          tierPairs: new Map(),
        });
      }

      const group = groupMap.get(key);
      if (!group.tierPairs.has(pair.difficulty)) {
        group.tierPairs.set(pair.difficulty, []);
      }
      group.tierPairs.get(pair.difficulty).push(pair);
    }
  }

  return [...groupMap.values()].sort(
    (a, b) =>
      compareText(a.categoryLabel, b.categoryLabel) ||
      compareText(a.categoryKey, b.categoryKey) ||
      compareText(a.groupId, b.groupId)
  );
}

function severityForSlot(tier, missingCount, exception) {
  if (missingCount <= 0) return 'LOW';
  if (exception) return 'EXCEPTION';
  return tier <= 3 ? 'HIGH' : 'MEDIUM';
}

function buildSuggestedNextAction(entry) {
  if (entry.missingEarlyPairs > 0) {
    const earliest = entry.missingByTier.find((tier) => tier.tier <= 3 && tier.missingCount > 0);
    return `Add ${earliest.missingCount} pair${earliest.missingCount === 1 ? '' : 's'} at tier ${earliest.tier} first`;
  }

  const earliest = entry.missingByTier.find((tier) => tier.missingCount > 0);
  if (earliest) {
    return `Add ${earliest.missingCount} pair${earliest.missingCount === 1 ? '' : 's'} at tier ${earliest.tier}`;
  }

  return 'No expansion needed';
}

function auditPairExpansionTargets(categories, options = {}) {
  const targetExceptions = options.targetExceptions ?? TARGET_EXCEPTIONS;
  const exceptionMap = new Map();
  for (const exception of targetExceptions) {
    exceptionMap.set(
      buildExceptionKey(exception.categoryKey, exception.groupId, exception.tier),
      exception
    );
  }

  const groups = buildGroupMap(categories);
  const slots = [];
  const exceptions = [];
  const backlogMap = new Map();

  for (const group of groups) {
    const backlogKey = `${group.categoryKey}||${group.groupId}`;
    backlogMap.set(backlogKey, {
      priorityScore: 0,
      categoryKey: group.categoryKey,
      categoryLabel: group.categoryLabel,
      groupId: group.groupId,
      contrastLabel: group.contrastLabel,
      sparseEarlyTiers: [],
      missingEarlyPairs: 0,
      missingTotalPairs: 0,
      missingByTier: [],
    });

    for (const tier of TIERS) {
      const pairs = sortPairs(group.tierPairs.get(tier) ?? []);
      const targetCount = TARGET_PAIRS_BY_TIER[tier];
      const currentCount = pairs.length;
      const missingCount = Math.max(targetCount - currentCount, 0);
      const exception = exceptionMap.get(buildExceptionKey(group.categoryKey, group.groupId, tier));
      const severity = severityForSlot(tier, missingCount, exception);
      const slot = {
        categoryKey: group.categoryKey,
        categoryLabel: group.categoryLabel,
        groupId: group.groupId,
        contrastLabel: group.contrastLabel,
        tier,
        currentCount,
        targetCount,
        missingCount,
        severity,
        existingPairs: pairs.map(pairDisplay),
        exception,
      };
      slots.push(slot);

      if (exception) {
        exceptions.push({
          categoryKey: group.categoryKey,
          categoryLabel: group.categoryLabel,
          groupId: group.groupId,
          tier,
          reason: exception.reason,
          status: exception.status,
          note: exception.note,
        });
      }

      if (missingCount > 0) {
        const backlog = backlogMap.get(backlogKey);
        backlog.missingTotalPairs += missingCount;
        backlog.missingByTier.push({ tier, missingCount });
        if (tier <= 3 && !exception) {
          backlog.sparseEarlyTiers.push(tier);
          backlog.missingEarlyPairs += missingCount;
        }

        const weight = tier === 1 ? 5 : tier === 2 ? 4 : tier === 3 ? 3 : tier === 4 ? 2 : 1;
        if (!exception) {
          backlog.priorityScore += missingCount * weight;
        }
      }
    }
  }

  slots.sort(
    (a, b) =>
      compareText(a.categoryLabel, b.categoryLabel) ||
      compareText(a.categoryKey, b.categoryKey) ||
      compareText(a.groupId, b.groupId) ||
      a.tier - b.tier
  );

  const underfilledSlots = slots
    .filter((slot) => slot.missingCount > 0)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        compareText(a.categoryLabel, b.categoryLabel) ||
        compareText(a.categoryKey, b.categoryKey) ||
        compareText(a.groupId, b.groupId) ||
        a.tier - b.tier
    );

  exceptions.sort(
    (a, b) =>
      compareText(a.categoryLabel, b.categoryLabel) ||
      compareText(a.categoryKey, b.categoryKey) ||
      compareText(a.groupId, b.groupId) ||
      a.tier - b.tier
  );

  const priorityBacklog = [...backlogMap.values()]
    .filter((entry) => entry.missingTotalPairs > 0 && entry.priorityScore > 0)
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        compareText(a.categoryLabel, b.categoryLabel) ||
        compareText(a.categoryKey, b.categoryKey) ||
        compareText(a.groupId, b.groupId)
    )
    .map((entry, index) => ({
      priority: index + 1,
      categoryKey: entry.categoryKey,
      categoryLabel: entry.categoryLabel,
      groupId: entry.groupId,
      contrastLabel: entry.contrastLabel,
      sparseEarlyTiers: entry.sparseEarlyTiers.sort((a, b) => a - b),
      missingEarlyPairs: entry.missingEarlyPairs,
      missingTotalPairs: entry.missingTotalPairs,
      suggestedNextAction: buildSuggestedNextAction(entry),
    }));

  const totalMissingPairs = slots.reduce((sum, slot) => sum + slot.missingCount, 0);
  const existingPairCount = slots.reduce((sum, slot) => sum + slot.currentCount, 0);
  const targetPairCount = slots.reduce((sum, slot) => sum + slot.targetCount, 0);
  const filledTargetPairs = slots.reduce(
    (sum, slot) => sum + Math.min(slot.currentCount, slot.targetCount),
    0
  );

  return {
    summary: {
      totalCategories: Array.isArray(categories) ? categories.length : 0,
      totalCategoryGroups: groups.length,
      totalSlots: slots.length,
      completeSlots: slots.filter((slot) => slot.currentCount >= slot.targetCount).length,
      underfilledSlots: underfilledSlots.length,
      totalMissingPairs,
      exceptionSlots: exceptions.length,
      existingPairCount,
      targetPairCount,
      fillPercentage:
        targetPairCount > 0 ? Math.round((filledTargetPairs / targetPairCount) * 100) : 0,
    },
    targetModel: TARGET_MODEL,
    slots,
    underfilledSlots,
    priorityBacklog,
    exceptions,
  };
}

function generatePairExpansionMarkdown(result) {
  const lines = [];

  lines.push('# Pair Expansion Targets');
  lines.push('');
  lines.push('> Generated by `node scripts/audit-pair-expansion-targets.js --write`. Do not edit manually.');
  lines.push('> Re-run after any pair data change to keep target counts current.');
  lines.push('');

  lines.push('## 1. Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|---|---:|');
  lines.push(`| Total categories | ${result.summary.totalCategories} |`);
  lines.push(`| Total category × group combinations | ${result.summary.totalCategoryGroups} |`);
  lines.push(`| Total target slots | ${result.summary.totalSlots} |`);
  lines.push(`| Complete slots | ${result.summary.completeSlots} |`);
  lines.push(`| Underfilled slots | ${result.summary.underfilledSlots} |`);
  lines.push(`| Total missing pairs | ${result.summary.totalMissingPairs} |`);
  lines.push(`| Exception slots | ${result.summary.exceptionSlots} |`);
  lines.push(`| Existing pair count | ${result.summary.existingPairCount} |`);
  lines.push(`| Target pair count | ${result.summary.targetPairCount} |`);
  lines.push(`| Fill percentage | ${result.summary.fillPercentage}% |`);
  lines.push('');
  lines.push(
    'This report is a dataset coverage target matrix. It does not mark scheduler behavior as defective and does not change source pair data.'
  );
  lines.push('');

  lines.push('## 2. Target Coverage Model');
  lines.push('');
  lines.push('| Tier | Target pairs | Rationale |');
  lines.push('|---:|---:|---|');
  for (const row of result.targetModel) {
    lines.push(`| ${row.tier} | ${row.target} | ${escapeMarkdownCell(row.rationale)} |`);
  }
  lines.push('');

  lines.push('## 3. Underfilled Slots');
  lines.push('');
  lines.push('Sorted by: severity → category → group ID → tier.');
  lines.push('');
  lines.push('| Category | Group ID | Contrast label | Tier | Current | Target | Missing | Severity | Existing pairs |');
  lines.push('|---|---|---|---:|---:|---:|---:|---|---|');
  for (const slot of result.underfilledSlots) {
    lines.push(
      `| ${escapeMarkdownCell(slot.categoryLabel)} | ${escapeMarkdownCell(slot.groupId)} | ` +
        `${escapeMarkdownCell(slot.contrastLabel)} | ${slot.tier} | ${slot.currentCount} | ` +
        `${slot.targetCount} | ${slot.missingCount} | ${slot.severity} | ` +
        `${escapeMarkdownCell(slot.existingPairs.join(', '))} |`
    );
  }
  lines.push('');

  lines.push('## 4. Priority Expansion Backlog');
  lines.push('');
  lines.push('Priority uses missing pairs weighted by tier: tier 1 ×5, tier 2 ×4, tier 3 ×3, tier 4 ×2, tiers 5–6 ×1.');
  lines.push('');
  lines.push('| Priority | Category | Group ID | Sparse early tiers | Missing early pairs | Missing total pairs | Suggested next action |');
  lines.push('|---:|---|---|---|---:|---:|---|');
  for (const item of result.priorityBacklog) {
    lines.push(
      `| ${item.priority} | ${escapeMarkdownCell(item.categoryLabel)} | ${escapeMarkdownCell(item.groupId)} | ` +
        `${item.sparseEarlyTiers.join(', ')} | ${item.missingEarlyPairs} | ${item.missingTotalPairs} | ` +
        `${escapeMarkdownCell(item.suggestedNextAction)} |`
    );
  }
  lines.push('');

  lines.push('## 5. Exceptions');
  lines.push('');
  if (result.exceptions.length === 0) {
    lines.push('No exceptions are currently defined.');
  } else {
    lines.push('| Category | Group ID | Tier | Reason | Status | Note |');
    lines.push('|---|---|---:|---|---|---|');
    for (const exception of result.exceptions) {
      lines.push(
        `| ${escapeMarkdownCell(exception.categoryLabel)} | ${escapeMarkdownCell(exception.groupId)} | ` +
          `${exception.tier} | ${escapeMarkdownCell(exception.reason)} | ` +
          `${escapeMarkdownCell(exception.status)} | ${escapeMarkdownCell(exception.note)} |`
      );
    }
  }
  lines.push('');

  lines.push('## 6. Regenerating This Report');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run audit:pair-targets');
  lines.push('node scripts/audit-pair-expansion-targets.js --write');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

module.exports = {
  TARGET_PAIRS_BY_TIER,
  TARGET_EXCEPTIONS,
  auditPairExpansionTargets,
  generatePairExpansionMarkdown,
  REPORT_PATH,
};

if (require.main === module) {
  const { minimalPairs } = loadRepoData();
  const result = auditPairExpansionTargets(minimalPairs);
  const report = generatePairExpansionMarkdown(result);

  const writeMode = process.argv.includes('--write');
  if (writeMode) {
    fs.writeFileSync(REPORT_PATH, report, 'utf8');
    console.log(`Report written to ${REPORT_PATH}`);
    console.log(
      `  ${result.summary.totalMissingPairs} missing pairs across ${result.summary.underfilledSlots} underfilled slots.`
    );
  } else {
    process.stdout.write(report);
  }
}
