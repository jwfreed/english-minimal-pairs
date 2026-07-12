'use strict';

// Pronunciation-risk audit (reporting-only, never a failing gate).
//
// Flags dataset entries that deserve manual listening review because device
// TTS engines may pronounce them inconsistently or in ways that weaken the
// intended minimal-pair contrast. Analyzes repository data only — no live TTS.
//
// Severities:
//   error        — verified data defect (malformed/missing IPA)
//   high-risk    — verified from data; the contrast is likely to collapse
//   needs-review — heuristic; plausible risk, requires human judgement
//   info         — verified pattern worth knowing; usually fine by design
//
// Structural defects (empty fields, phoneme-not-in-IPA, duplicate IDs) are
// already *enforced* by validate-data.js; this audit re-reports only what it
// needs for standalone runs and otherwise focuses on pronunciation risk.

const path = require('path');
const fs = require('fs');
const { loadRepoData } = require('./validate-data');

const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, 'docs', 'pronunciation-risk-audit.md');

const SEVERITY_ORDER = { error: 0, 'high-risk': 1, 'needs-review': 2, info: 3 };
const SEVERITY_LABELS = {
  error: 'Errors',
  'high-risk': 'High-risk',
  'needs-review': 'Needs review',
  info: 'Informational',
};

// Character inventory currently used by the dataset's transcriptions, plus
// secondary stress (ˌ) which is valid IPA even though no entry uses it yet.
// Anything outside this set is convention drift (e.g. ASCII "g" for "ɡ").
const IPA_CHAR_INVENTORY = new Set(
  '/abdefhijklmnoprstuvwzæðŋɑɒɔəɛɜɡɪʃʊʌʒθˈˌː'.split('')
);

const STRESS_MARKS = /[ˈˌ]/g;
const LENGTH_MARKS = /ː/g;

// Common English heteronyms: one spelling, two established pronunciations.
// A TTS engine sees only the spelling, so it may pick the unintended reading.
// Curated review list — membership means "listen to this", not "this is wrong".
const KNOWN_HETERONYMS = new Set([
  'alternate', 'attribute', 'bass', 'bow', 'close', 'compound', 'conduct',
  'conflict', 'console', 'content', 'contest', 'contract', 'convert',
  'convict', 'desert', 'digest', 'dove', 'excuse', 'export', 'extract',
  'house', 'impact', 'import', 'incline', 'increase', 'insult', 'invalid',
  'lead', 'live', 'minute', 'moderate', 'object', 'perfect', 'permit',
  'present', 'produce', 'project', 'protest', 'read', 'rebel', 'record',
  'refuse', 'reject', 'row', 'separate', 'sow', 'subject', 'survey',
  'suspect', 'tear', 'upset', 'use', 'wind', 'wound',
]);

// Vowel contrasts that are merged in common device-voice dialects
// (cot-caught and father-bother mergers in most en-US voices).
const MERGER_PRONE_VOWEL_SETS = [new Set(['ɑ', 'ɔ']), new Set(['ɒ', 'ɔ']), new Set(['ɑ', 'ɒ'])];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeWord(word) {
  return String(word).trim().toLowerCase();
}

function stripSlashes(ipa) {
  return ipa.replace(/^\//, '').replace(/\/$/, '');
}

function pairWords(pair) {
  return [pair?.word1, pair?.word2].map((w) => (isNonEmptyString(w) ? w : '(missing)'));
}

function makeFinding(check, severity, categoryName, pair, message) {
  return {
    check,
    severity,
    categoryName,
    group: pair?.group,
    tier: pair?.difficulty,
    words: pairWords(pair),
    message,
  };
}

/** Checks that look at one (word, ipa) slot of one pair. */
function auditWordSlot(findings, categoryName, pair, word, ipa, slot) {
  if (!isNonEmptyString(ipa)) {
    findings.push(
      makeFinding(
        'MISSING_PRONUNCIATION_METADATA',
        'error',
        categoryName,
        pair,
        `${slot} is missing or empty for "${isNonEmptyString(word) ? word : slot}".`
      )
    );
    return;
  }
  if (!/^\/[^/]+\/$/.test(ipa)) {
    findings.push(
      makeFinding(
        'MALFORMED_IPA',
        'error',
        categoryName,
        pair,
        `${slot} "${ipa}" is not a slash-delimited transcription (/.../).`
      )
    );
    return;
  }
  const unexpected = [...new Set(stripSlashes(ipa).split(''))].filter(
    (ch) => !IPA_CHAR_INVENTORY.has(ch)
  );
  if (unexpected.length > 0) {
    findings.push(
      makeFinding(
        'UNEXPECTED_IPA_CHARACTER',
        'needs-review',
        categoryName,
        pair,
        `${slot} "${ipa}" uses character(s) outside the dataset inventory: ` +
          `${unexpected.map((ch) => `"${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`).join(', ')}. ` +
          'May be convention drift (e.g. ASCII "g" instead of IPA "ɡ").'
      )
    );
  }
}

/** Checks that compare the two words of one pair. */
function auditPairContrast(findings, categoryName, pair) {
  const { ipa1, ipa2 } = pair;
  if (!isNonEmptyString(ipa1) || !isNonEmptyString(ipa2)) return;

  if (ipa1 === ipa2) {
    findings.push(
      makeFinding(
        'IDENTICAL_PAIR_IPA',
        'high-risk',
        categoryName,
        pair,
        `Both words share the transcription ${ipa1}; as written there is no audible contrast for TTS to produce.`
      )
    );
    return; // narrower same-pair checks below would only repeat this
  }

  const noStress1 = ipa1.replace(STRESS_MARKS, '');
  const noStress2 = ipa2.replace(STRESS_MARKS, '');
  if (noStress1 === noStress2) {
    findings.push(
      makeFinding(
        'STRESS_ONLY_CONTRAST',
        'high-risk',
        categoryName,
        pair,
        `${ipa1} vs ${ipa2} differ only in stress placement; device voices realize stress inconsistently, especially on isolated words.`
      )
    );
  }

  const noLength1 = ipa1.replace(LENGTH_MARKS, '');
  const noLength2 = ipa2.replace(LENGTH_MARKS, '');
  if (noLength1 === noLength2 && ipa1 !== ipa2) {
    findings.push(
      makeFinding(
        'LENGTH_ONLY_CONTRAST',
        'high-risk',
        categoryName,
        pair,
        `${ipa1} vs ${ipa2} differ only in vowel length (ː); many voices neutralize pure length distinctions.`
      )
    );
  }

  const contrast = new Set(
    [pair.contrastPhoneme1, pair.contrastPhoneme2].filter(isNonEmptyString)
  );
  if (
    contrast.size === 2 &&
    MERGER_PRONE_VOWEL_SETS.some(
      (set) => [...contrast].every((phoneme) => set.has(phoneme))
    )
  ) {
    findings.push(
      makeFinding(
        'MERGER_PRONE_VOWEL_CONTRAST',
        'needs-review',
        categoryName,
        pair,
        `Contrast ${pair.contrastPhoneme1}/${pair.contrastPhoneme2} is merged in common device dialects (cot-caught / father-bother); en-US voices may pronounce both words identically.`
      )
    );
  }

  if (
    (pair.contrastPhoneme1 === 'r' || pair.contrastPhoneme2 === 'r') &&
    (pair.position === 'medial' || pair.position === 'final')
  ) {
    findings.push(
      makeFinding(
        'NON_INITIAL_R_CONTRAST',
        'info',
        categoryName,
        pair,
        `/r/ contrast in ${pair.position} position: non-rhotic voices (en-GB, en-AU) weaken or drop postvocalic /r/.`
      )
    );
  }

  for (const word of [pair.word1, pair.word2]) {
    if (isNonEmptyString(word) && KNOWN_HETERONYMS.has(normalizeWord(word))) {
      findings.push(
        makeFinding(
          'KNOWN_HETERONYM',
          'needs-review',
          categoryName,
          pair,
          `"${word}" is a common English heteronym; a TTS engine sees only the spelling and may choose a reading other than the intended one.`
        )
      );
    }
  }
}

/** Checks that span the whole dataset (spelling reuse, IPA disagreement). */
function auditCrossDataset(findings, categories) {
  const spellingToIpas = new Map(); // word -> Map(ipa -> [locator])
  const spellingToGroups = new Map(); // word -> Set("category/group")
  const wordPairLocations = new Map(); // "w1|w2" -> [categoryName]
  const pairByKey = new Map();

  for (const category of categories) {
    const categoryName = category?.category ?? '(unnamed)';
    const pairs = Array.isArray(category?.pairs) ? category.pairs : [];
    for (const pair of pairs) {
      const slots = [
        [pair?.word1, pair?.ipa1],
        [pair?.word2, pair?.ipa2],
      ];
      for (const [word, ipa] of slots) {
        if (!isNonEmptyString(word) || !isNonEmptyString(ipa)) continue;
        const key = normalizeWord(word);
        if (!spellingToIpas.has(key)) spellingToIpas.set(key, new Map());
        const ipaMap = spellingToIpas.get(key);
        if (!ipaMap.has(ipa)) ipaMap.set(ipa, []);
        ipaMap.get(ipa).push({ categoryName, pair });

        if (isNonEmptyString(pair?.group)) {
          if (!spellingToGroups.has(key)) spellingToGroups.set(key, new Set());
          spellingToGroups.get(key).add(`${categoryName} / ${pair.group}`);
        }
      }

      if (isNonEmptyString(pair?.word1) && isNonEmptyString(pair?.word2)) {
        const pairKey = `${normalizeWord(pair.word1)} ${normalizeWord(pair.word2)}`;
        if (!wordPairLocations.has(pairKey)) wordPairLocations.set(pairKey, []);
        wordPairLocations.get(pairKey).push(categoryName);
        if (!pairByKey.has(pairKey)) pairByKey.set(pairKey, { categoryName, pair });
      }
    }
  }

  const sortedSpellings = [...spellingToIpas.keys()].sort((a, b) => a.localeCompare(b));
  for (const word of sortedSpellings) {
    const ipaMap = spellingToIpas.get(word);
    if (ipaMap.size > 1) {
      const ipas = [...ipaMap.keys()].sort((a, b) => a.localeCompare(b));
      const locators = ipas.map((ipa) => {
        const { categoryName, pair } = ipaMap.get(ipa)[0];
        return `${ipa} (${categoryName} / ${pair.group})`;
      });
      const anyUse = ipaMap.get(ipas[0])[0];
      findings.push(
        makeFinding(
          'MULTIPLE_IPA_FOR_SPELLING',
          'needs-review',
          anyUse.categoryName,
          anyUse.pair,
          `"${word}" is transcribed ${ipaMap.size} different ways: ${locators.join('; ')}. ` +
            'Verified cross-dataset IPA inconsistency requiring a convention decision ' +
            '(intentionally accent-neutral vs single IPA convention); neither transcription is asserted to be the defective one.'
        )
      );
    }
  }

  const sortedGroupReuse = [...spellingToGroups.keys()].sort((a, b) => a.localeCompare(b));
  for (const word of sortedGroupReuse) {
    const groups = spellingToGroups.get(word);
    if (groups.size > 1) {
      const anyUse = spellingToIpas.get(word).values().next().value[0];
      findings.push(
        makeFinding(
          'SPELLING_IN_MULTIPLE_GROUPS',
          'info',
          anyUse.categoryName,
          anyUse.pair,
          `"${word}" appears in ${groups.size} contrast groups: ${[...groups].sort().join(', ')}. ` +
            'One device pronunciation must serve every contrast that uses it.'
        )
      );
    }
  }

  const sortedPairKeys = [...wordPairLocations.keys()].sort((a, b) => a.localeCompare(b));
  for (const pairKey of sortedPairKeys) {
    const locations = wordPairLocations.get(pairKey);
    if (locations.length > 1) {
      const { categoryName, pair } = pairByKey.get(pairKey);
      findings.push(
        makeFinding(
          'CROSS_CATEGORY_DUPLICATE_PAIR',
          'info',
          categoryName,
          pair,
          `Pair appears in ${locations.length} categories (${[...locations].sort().join(', ')}); expected by design, but transcriptions must stay in sync across copies.`
        )
      );
    }
  }
}

function compareFindings(a, b) {
  const severityCmp = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (severityCmp !== 0) return severityCmp;
  const checkCmp = a.check.localeCompare(b.check);
  if (checkCmp !== 0) return checkCmp;
  const categoryCmp = a.categoryName.localeCompare(b.categoryName);
  if (categoryCmp !== 0) return categoryCmp;
  const groupCmp = String(a.group).localeCompare(String(b.group));
  if (groupCmp !== 0) return groupCmp;
  return a.words.join('/').localeCompare(b.words.join('/'));
}

function auditPronunciationRisk(categories) {
  const input = Array.isArray(categories) ? categories : [];
  const findings = [];
  let totalPairs = 0;

  for (const category of input) {
    const categoryName = category?.category ?? '(unnamed)';
    const pairs = Array.isArray(category?.pairs) ? category.pairs : [];
    for (const pair of pairs) {
      totalPairs++;
      auditWordSlot(findings, categoryName, pair, pair?.word1, pair?.ipa1, 'ipa1');
      auditWordSlot(findings, categoryName, pair, pair?.word2, pair?.ipa2, 'ipa2');
      auditPairContrast(findings, categoryName, pair);
    }
  }

  auditCrossDataset(findings, input);
  findings.sort(compareFindings);

  const countsBySeverity = {};
  for (const severity of Object.keys(SEVERITY_ORDER)) countsBySeverity[severity] = 0;
  for (const finding of findings) countsBySeverity[finding.severity]++;

  return { totalPairs, findings, countsBySeverity };
}

function generateMarkdownReport(result) {
  const lines = [];
  lines.push('# Pronunciation-Risk Audit');
  lines.push('');
  lines.push('> Generated by `node scripts/audit-pronunciation-risk.js --write`. Do not edit manually.');
  lines.push('> Reporting-only: findings are review candidates, not asserted defects.');
  lines.push('> Re-run after any data change to keep findings current.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Severity | Meaning | Count |');
  lines.push('|---|---|---:|');
  const meanings = {
    error: 'Verified data defect',
    'high-risk': 'Contrast likely to collapse under device TTS',
    'needs-review': 'Heuristic flag; needs human listening review',
    info: 'Verified pattern; usually fine by design',
  };
  for (const severity of Object.keys(SEVERITY_ORDER)) {
    lines.push(
      `| ${SEVERITY_LABELS[severity]} | ${meanings[severity]} | ${result.countsBySeverity[severity]} |`
    );
  }
  lines.push('');
  lines.push(`Audited ${result.totalPairs} pairs; ${result.findings.length} findings.`);
  lines.push('');

  // The informational section is by far the largest; summarize it up front so
  // reviewers see the actionable sections without scrolling past it.
  const infoRows = result.findings.filter((f) => f.severity === 'info');
  lines.push('### Informational at a glance');
  lines.push('');
  if (infoRows.length === 0) {
    lines.push('No informational findings.');
  } else {
    const infoCounts = new Map();
    for (const f of infoRows) infoCounts.set(f.check, (infoCounts.get(f.check) ?? 0) + 1);
    lines.push('| Check | Count |');
    lines.push('|---|---:|');
    for (const check of [...infoCounts.keys()].sort((a, b) => a.localeCompare(b))) {
      lines.push(`| ${check} | ${infoCounts.get(check)} |`);
    }
    lines.push('');
    lines.push('Full informational table at the end of this report.');
  }
  lines.push('');

  const emitSection = (severity, titleSuffix = '') => {
    const rows = result.findings.filter((f) => f.severity === severity);
    lines.push(`## ${SEVERITY_LABELS[severity]} (${rows.length}${titleSuffix})`);
    lines.push('');
    if (rows.length === 0) {
      lines.push('None.');
      lines.push('');
      return;
    }
    lines.push('| Check | Category | Group | Tier | Words | Why flagged |');
    lines.push('|---|---|---|---:|---|---|');
    for (const f of rows) {
      lines.push(
        `| ${f.check} | ${f.categoryName} | ${f.group ?? ''} | ${f.tier ?? ''} | ${f.words.join(' / ')} | ${f.message} |`
      );
    }
    lines.push('');
  };

  emitSection('error');
  emitSection('high-risk');
  emitSection('needs-review');

  lines.push('## Review workflow');
  lines.push('');
  lines.push('- Use TTSDebugScreen (test 5) to listen to flagged pairs across the voice rotation.');
  lines.push('- High-risk findings should be listened to on at least one physical iOS and one Android device.');
  lines.push('- A flag is a reason to listen, not proof of a defect; clear items by noting the review outcome in the data PR.');
  lines.push('');

  emitSection('info', ', expanded');

  return lines.join('\n');
}

module.exports = {
  auditPronunciationRisk,
  generateMarkdownReport,
  SEVERITY_ORDER,
  REPORT_PATH,
};

// ── CLI entry ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  const { minimalPairs } = loadRepoData();
  const result = auditPronunciationRisk(minimalPairs);

  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2));
  } else if (process.argv.includes('--write')) {
    fs.writeFileSync(REPORT_PATH, generateMarkdownReport(result), 'utf8');
    console.log(`Report written to ${REPORT_PATH}`);
    console.log(
      `  ${result.findings.length} findings across ${result.totalPairs} pairs ` +
        `(errors: ${result.countsBySeverity.error}, high-risk: ${result.countsBySeverity['high-risk']}, ` +
        `needs-review: ${result.countsBySeverity['needs-review']}, info: ${result.countsBySeverity.info}).`
    );
  } else {
    process.stdout.write(generateMarkdownReport(result));
  }
}
