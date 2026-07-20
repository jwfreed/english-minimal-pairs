const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const projectRoot = path.join(__dirname, '..');
const { tKeys } = loadTsModule(
  path.join(projectRoot, 'src', 'constants', 'translationKeys.ts')
);
const { alternateLanguages } = loadTsModule(
  path.join(projectRoot, 'src', 'constants', 'alternateLanguages.ts')
);
const { formatTranslation } = loadTsModule(
  path.join(projectRoot, 'utils', 'formatTranslation.ts')
);
const { resolveTranslation } = loadTsModule(
  path.join(projectRoot, 'utils', 'resolveTranslation.ts')
);
const { buildContrastLabel } = loadTsModule(
  path.join(projectRoot, 'utils', 'contrastLabel.ts')
);
const { buildPracticeFeedbackCopy } = loadTsModule(
  path.join(projectRoot, 'utils', 'practiceFeedback.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const translate = (language, key) =>
  resolveTranslation(language, key, { isDevelopment: false });
const nonEnglishLanguages = Object.keys(alternateLanguages).filter(
  (language) => language !== 'English'
);

function buildLocalizedUi(language) {
  const t = (key) => translate(language, key);
  return {
    results: [
      formatTranslation(t(tKeys.practicedTime), {
        minutes: '0.7',
        unit: t(tKeys.min),
      }),
      t(tKeys.notPracticedYet),
      formatTranslation(t(tKeys.correctOfWeighted), {
        correct: 1,
        total: 1,
        accuracy: '100.0',
      }),
      formatTranslation(t(tKeys.levelProgress), { level: 1, total: 6 }),
    ],
    detail: [
      t(tKeys.practiceExamples),
      t(tKeys.availableNow),
      formatTranslation(t(tKeys.levelAt), { level: 2 }),
      t(tKeys.listening),
    ],
  };
}

runTest('Thai results and practice metadata contain no English UI labels', () => {
  const ui = buildLocalizedUi('ภาษาไทย');
  const rendered = [...ui.results, ...ui.detail].join('\n');

  for (const englishUi of [
    'Practiced',
    'Not practiced yet',
    'Level',
    'correct',
    'weighted',
    'Practice examples',
    'Available now',
    'Listening',
  ]) {
    assert.ok(
      !rendered.toLowerCase().includes(englishUi.toLowerCase()),
      `Thai UI leaked English text: ${englishUi}`
    );
  }

  assert.deepStrictEqual(ui.results, [
    'ฝึกไปแล้ว 0.7 นาที',
    'ยังไม่ได้ฝึก',
    'ถูก 1 จาก 1 ข้อ · ความแม่นยำถ่วงน้ำหนัก 100.0%',
    'ระดับ 1 จาก 6',
  ]);
  assert.deepStrictEqual(ui.detail, [
    'ตัวอย่างฝึก',
    'ใช้ได้ตอนนี้',
    'ระดับ 2',
    'กำลังเล่นเสียง…',
  ]);
});

runTest('every non-English locale resolves complete results and practice UI', () => {
  const migratedKeys = [
    tKeys.practicedTime,
    tKeys.min,
    tKeys.notPracticedYet,
    tKeys.correctOfWeighted,
    tKeys.levelProgress,
    tKeys.practiceExamples,
    tKeys.availableNow,
    tKeys.levelAt,
    tKeys.listening,
  ];

  for (const language of nonEnglishLanguages) {
    const ui = buildLocalizedUi(language);
    for (const renderedValue of [...ui.results, ...ui.detail]) {
      assert.ok(renderedValue.length > 0, `${language} rendered blank localized UI`);
      assert.ok(
        !/\{\w+\}/.test(renderedValue),
        `${language} rendered an unresolved placeholder: ${renderedValue}`
      );
    }

    for (const key of migratedKeys) {
      assert.strictEqual(
        translate(language, key),
        alternateLanguages[language][key],
        `${language} did not resolve its own translation for ${key}`
      );
    }
  }
});

runTest('English UI preserves the migrated metadata copy', () => {
  const ui = buildLocalizedUi('English');
  assert.deepStrictEqual(ui.results, [
    'Practiced 0.7 min',
    'Not practiced yet',
    '1 of 1 correct · weighted 100.0%',
    'Level 1 of 6',
  ]);
  assert.deepStrictEqual(ui.detail, [
    'Practice examples',
    'Available now',
    'Level 2',
    'Listening…',
  ]);
});

runTest('learning words, IPA, and phonemes remain English in every UI locale', () => {
  const pair = {
    word1: 'thin',
    word2: 'tin',
    ipa1: '/θɪn/',
    ipa2: '/tɪn/',
    contrastPhoneme1: 'θ',
    contrastPhoneme2: 't',
    difficulty: 1,
    group: 'thT',
    position: 'initial',
  };

  assert.strictEqual(`${pair.word1} ↔ ${pair.word2}`, 'thin ↔ tin');
  assert.strictEqual(`${pair.ipa1} · ${pair.ipa2}`, '/θɪn/ · /tɪn/');
  assert.strictEqual(buildContrastLabel(pair), '/θ/ vs /t/');

  for (const language of Object.keys(alternateLanguages)) {
    const feedback = buildPracticeFeedbackCopy({
      pair,
      feedback: 'correct',
      playedIdx: 0,
      translate: (key) => translate(language, key),
    });
    assert.ok(feedback.headline.includes('/θ/'), `${language} changed the phoneme`);
    assert.ok(feedback.headline.includes('thin'), `${language} changed the English word`);
  }
});

runTest('missing translations are loud in development and blank-safe in production', () => {
  const missingKey = 'missingRuntimeKey';

  for (const language of nonEnglishLanguages) {
    const warnings = [];
    assert.strictEqual(
      resolveTranslation(language, missingKey, {
        isDevelopment: true,
        onMissing: (message) => warnings.push(message),
      }),
      missingKey
    );
    assert.strictEqual(warnings.length, 1);
    assert.ok(warnings[0].includes(missingKey));
    assert.ok(warnings[0].includes(language));

    assert.strictEqual(
      resolveTranslation(language, missingKey, { isDevelopment: false }),
      ''
    );
  }
});

runTest('missing template values stay visible in development and safe in production', () => {
  const missingValues = [];
  assert.strictEqual(
    formatTranslation('Level {level}', {}, {
      isDevelopment: true,
      onMissingValue: (placeholder) => missingValues.push(placeholder),
    }),
    'Level {level}'
  );
  assert.deepStrictEqual(missingValues, ['level']);
  assert.strictEqual(
    formatTranslation('{level}', {}, { isDevelopment: false }),
    ''
  );
});

runTest('production components use localization keys for migrated UI states', () => {
  const contracts = [
    ['app/(tabs)/results.tsx', ['tKeys.practicedTime']],
    ['src/components/PairItem.tsx', ['tKeys.notPracticedYet', 'tKeys.correctOfWeighted']],
    ['src/components/LevelIndicator.tsx', ['tKeys.levelProgress', 'tKeys.levelCompact']],
    [
      'src/components/practice/ContrastDetailsModal.tsx',
      ['tKeys.practiceExamples', 'tKeys.availableNow', 'tKeys.levelAt'],
    ],
    ['src/components/practice/ListenControls.tsx', ['tKeys.listening']],
  ];

  for (const [relativePath, requiredKeys] of contracts) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    for (const requiredKey of requiredKeys) {
      assert.ok(source.includes(requiredKey), `${relativePath} must use ${requiredKey}`);
    }
  }

  const forbiddenSourceCopy = [
    ['app/(tabs)/results.tsx', "Practiced{' '}"],
    ['src/components/PairItem.tsx', '>Not practiced yet<'],
    ['src/components/PairItem.tsx', ' correct · weighted '],
    ['src/components/LevelIndicator.tsx', '`Level ${currentTier} of ${TOTAL_TIERS}`'],
    ['src/components/practice/ContrastDetailsModal.tsx', '>Practice examples<'],
    ['src/components/practice/ListenControls.tsx', "'Listening…'"],
  ];

  for (const [relativePath, forbiddenCopy] of forbiddenSourceCopy) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    assert.ok(
      !source.includes(forbiddenCopy),
      `${relativePath} reintroduced English UI copy: ${forbiddenCopy}`
    );
  }
});

console.log('\nAll localization regression tests passed.');
