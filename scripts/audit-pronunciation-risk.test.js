const assert = require('assert');
const {
  auditPronunciationRisk,
  generateMarkdownReport,
  SEVERITY_ORDER,
} = require('./audit-pronunciation-risk');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────

function makePair(word1, word2, ipa1, ipa2, extra = {}) {
  return {
    word1,
    word2,
    ipa1,
    ipa2,
    difficulty: 1,
    group: 'g1',
    position: 'initial',
    contrastPhoneme1: 'x',
    contrastPhoneme2: 'y',
    ...extra,
  };
}

function makeCategory(category, pairs) {
  return { category, pairs };
}

function findingsOfCheck(result, check) {
  return result.findings.filter((f) => f.check === check);
}

// ── Empty / malformed input ─────────────────────────────────────────────────

runTest('empty dataset produces zero findings and does not crash', () => {
  const result = auditPronunciationRisk([]);
  assert.deepStrictEqual(result.findings, []);
  assert.strictEqual(result.totalPairs, 0);
});

runTest('malformed input (missing fields, null entries) is reported, not thrown', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [
      { word1: 'left', word2: 'right' }, // no IPA at all
      makePair('sun', 'son', null, '/sʌn/'),
    ]),
  ]);
  const missing = findingsOfCheck(result, 'MISSING_PRONUNCIATION_METADATA');
  assert.ok(missing.length >= 2, `expected >=2 missing-metadata findings, got ${missing.length}`);
  assert.ok(missing.every((f) => f.severity === 'error'));
});

// ── Malformed IPA ───────────────────────────────────────────────────────────

runTest('IPA without enclosing slashes is flagged as malformed (error)', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('rake', 'lake', 'reɪk', '/leɪk/')]),
  ]);
  const malformed = findingsOfCheck(result, 'MALFORMED_IPA');
  assert.strictEqual(malformed.length, 1);
  assert.strictEqual(malformed[0].severity, 'error');
  assert.ok(malformed[0].words.includes('rake'));
});

runTest('IPA using characters outside the dataset inventory is flagged for review', () => {
  // ASCII "g" instead of IPA script "ɡ" is the canonical convention drift.
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('gate', 'late', '/geɪt/', '/leɪt/')]),
  ]);
  const unexpected = findingsOfCheck(result, 'UNEXPECTED_IPA_CHARACTER');
  assert.strictEqual(unexpected.length, 1);
  assert.strictEqual(unexpected[0].severity, 'needs-review');
  assert.ok(unexpected[0].message.includes('g'));
});

// ── Duplicate pronunciations / spellings ────────────────────────────────────

runTest('identical spelling mapped to multiple IPA transcriptions is flagged', () => {
  const result = auditPronunciationRisk([
    makeCategory('A', [makePair('read', 'lead', '/riːd/', '/liːd/')]),
    makeCategory('B', [makePair('read', 'bed', '/rɛd/', '/bɛd/')]),
  ]);
  const multi = findingsOfCheck(result, 'MULTIPLE_IPA_FOR_SPELLING');
  assert.strictEqual(multi.length, 1);
  assert.strictEqual(multi[0].severity, 'needs-review');
  assert.ok(multi[0].message.includes('read'));
  assert.ok(multi[0].message.includes('/riːd/') && multi[0].message.includes('/rɛd/'));
  // Verified inconsistency, but neither transcription is asserted to be wrong:
  // the dataset must first decide accent-neutral vs single-convention IPA.
  assert.ok(
    multi[0].message.includes('convention decision'),
    'multi-IPA findings must ask for a convention decision'
  );
  assert.ok(
    !/\bwrong\b|\bincorrect\b/.test(multi[0].message),
    'multi-IPA findings must not assert either transcription is wrong'
  );
});

runTest('identical spelling appearing in multiple contrast groups is informational', () => {
  const result = auditPronunciationRisk([
    makeCategory('A', [
      makePair('right', 'light', '/raɪt/', '/laɪt/', { group: 'rL' }),
      makePair('right', 'night', '/raɪt/', '/naɪt/', { group: 'rN' }),
    ]),
  ]);
  const reused = findingsOfCheck(result, 'SPELLING_IN_MULTIPLE_GROUPS');
  assert.ok(reused.some((f) => f.message.includes('right')));
  assert.ok(reused.every((f) => f.severity === 'info'));
});

runTest('exact word pair duplicated across categories is informational', () => {
  const result = auditPronunciationRisk([
    makeCategory('A', [makePair('rake', 'lake', '/reɪk/', '/leɪk/')]),
    makeCategory('B', [makePair('rake', 'lake', '/reɪk/', '/leɪk/')]),
  ]);
  const dupes = findingsOfCheck(result, 'CROSS_CATEGORY_DUPLICATE_PAIR');
  assert.strictEqual(dupes.length, 1);
  assert.strictEqual(dupes[0].severity, 'info');
  assert.deepStrictEqual(dupes[0].words, ['rake', 'lake']);
});

// ── Heteronyms / stress / dialect ───────────────────────────────────────────

runTest('known heteronym spellings are flagged for review', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('record', 'reword', '/ˈrɛkərd/', '/riˈwɜrd/')]),
  ]);
  const het = findingsOfCheck(result, 'KNOWN_HETERONYM');
  assert.strictEqual(het.length, 1);
  assert.strictEqual(het[0].severity, 'needs-review');
  assert.ok(het[0].message.includes('record'));
});

runTest('contrast that differs only by stress placement is high-risk', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('permit', 'permit2', '/ˈpermit/', '/perˈmit/')]),
  ]);
  const stress = findingsOfCheck(result, 'STRESS_ONLY_CONTRAST');
  assert.strictEqual(stress.length, 1);
  assert.strictEqual(stress[0].severity, 'high-risk');
});

runTest('contrast that differs only by vowel length is high-risk', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('beed', 'bid', '/biːd/', '/bid/')]),
  ]);
  const length = findingsOfCheck(result, 'LENGTH_ONLY_CONTRAST');
  assert.strictEqual(length.length, 1);
  assert.strictEqual(length[0].severity, 'high-risk');
});

runTest('identical IPA for both words of a pair is high-risk', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('sun', 'son', '/sʌn/', '/sʌn/')]),
  ]);
  const identical = findingsOfCheck(result, 'IDENTICAL_PAIR_IPA');
  assert.strictEqual(identical.length, 1);
  assert.strictEqual(identical[0].severity, 'high-risk');
});

runTest('merger-prone vowel contrasts (cot-caught family) are flagged for review', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [
      makePair('cot', 'caught', '/kɑt/', '/kɔt/', {
        contrastPhoneme1: 'ɑ',
        contrastPhoneme2: 'ɔ',
      }),
    ]),
  ]);
  const merger = findingsOfCheck(result, 'MERGER_PRONE_VOWEL_CONTRAST');
  assert.strictEqual(merger.length, 1);
  assert.strictEqual(merger[0].severity, 'needs-review');
});

runTest('non-initial /r/ contrasts are flagged as dialect-sensitive (non-rhotic voices)', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [
      makePair('fear', 'feel', '/fɪr/', '/fɪl/', {
        contrastPhoneme1: 'r',
        contrastPhoneme2: 'l',
        position: 'final',
      }),
    ]),
  ]);
  const rhotic = findingsOfCheck(result, 'NON_INITIAL_R_CONTRAST');
  assert.strictEqual(rhotic.length, 1);
  assert.strictEqual(rhotic[0].severity, 'info');
});

// ── Categorization and determinism ──────────────────────────────────────────

runTest('findings are ordered by severity (errors, high-risk, needs-review, info)', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [
      makePair('fear', 'feel', '/fɪr/', '/fɪl/', {
        contrastPhoneme1: 'r',
        contrastPhoneme2: 'l',
        position: 'final',
      }),
      makePair('sun', 'son', '/sʌn/', '/sʌn/'),
      makePair('rake', 'lake', 'reɪk', '/leɪk/'),
    ]),
  ]);
  const ranks = result.findings.map((f) => SEVERITY_ORDER[f.severity]);
  const sorted = [...ranks].sort((a, b) => a - b);
  assert.deepStrictEqual(ranks, sorted, 'findings must be pre-sorted by severity');
});

runTest('output is deterministic regardless of input order', () => {
  const pairA = makePair('sun', 'son', '/sʌn/', '/sʌn/');
  const pairB = makePair('beed', 'bid', '/biːd/', '/bid/', { group: 'g2' });
  const forward = auditPronunciationRisk([makeCategory('Test', [pairA, pairB])]);
  const backward = auditPronunciationRisk([makeCategory('Test', [pairB, pairA])]);
  assert.deepStrictEqual(forward.findings, backward.findings);
});

runTest('markdown report leads with actionable sections and defers the informational table', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [
      makePair('rake', 'lake', 'reɪk', '/leɪk/'), // error (malformed)
      makePair('sun', 'son', '/sʌn/', '/sʌn/'), // high-risk (identical IPA)
      makePair('record', 'reword', '/ˈrɛkərd/', '/riˈwɜrd/'), // needs-review (heteronym)
      makePair('fear', 'feel', '/fɪr/', '/fɪl/', {
        contrastPhoneme1: 'r',
        contrastPhoneme2: 'l',
        position: 'final',
      }), // info (non-initial r)
    ]),
  ]);
  const report = generateMarkdownReport(result);

  const glanceIdx = report.indexOf('Informational at a glance');
  const errorsIdx = report.indexOf('## Errors');
  const highIdx = report.indexOf('## High-risk');
  const needsIdx = report.indexOf('## Needs review');
  const infoTableIdx = report.indexOf('## Informational (');

  assert.ok(glanceIdx !== -1, 'report must summarize informational findings near the top');
  assert.ok(errorsIdx !== -1 && highIdx !== -1 && needsIdx !== -1 && infoTableIdx !== -1);
  assert.ok(glanceIdx < errorsIdx, 'informational summary must precede the Errors section');
  assert.ok(errorsIdx < highIdx && highIdx < needsIdx, 'actionable sections lead in severity order');
  assert.ok(needsIdx < infoTableIdx, 'expanded informational table must come after Needs review');
});

runTest('every finding carries locator metadata (category, group, words)', () => {
  const result = auditPronunciationRisk([
    makeCategory('Test', [makePair('sun', 'son', '/sʌn/', '/sʌn/')]),
  ]);
  assert.ok(result.findings.length > 0);
  for (const finding of result.findings) {
    assert.ok(finding.categoryName, 'finding must name its category');
    assert.ok(finding.check, 'finding must name its check');
    assert.ok(finding.severity, 'finding must carry a severity');
    assert.ok(Array.isArray(finding.words), 'finding must carry the words involved');
    assert.ok(finding.message, 'finding must explain why it was flagged');
  }
});
