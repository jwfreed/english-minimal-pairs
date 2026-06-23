const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { tKeys } = loadTsModule(
  path.join(__dirname, '..', 'src', 'constants', 'translationKeys.ts')
);

const { englishTranslations, alternateLanguages } = loadTsModule(
  path.join(__dirname, '..', 'src', 'constants', 'alternateLanguages.ts')
);

const allTKeys = Object.values(tKeys);
const locales = Object.entries(alternateLanguages);

let failed = false;

// Check englishTranslations separately (it's the source of truth)
const missingFromEnglish = allTKeys.filter((key) => !(key in englishTranslations));
if (missingFromEnglish.length > 0) {
  console.error(`FAIL - englishTranslations is missing ${missingFromEnglish.length} key(s):`);
  missingFromEnglish.forEach((key) => console.error(`  - ${key}`));
  failed = true;
} else {
  console.log(`ok - englishTranslations covers all ${allTKeys.length} tKeys`);
}

// Check every locale in alternateLanguages
for (const [localeName, localeObj] of locales) {
  const missingKeys = allTKeys.filter((key) => !(key in localeObj));
  if (missingKeys.length > 0) {
    console.error(`FAIL - ${localeName} is missing ${missingKeys.length} key(s):`);
    missingKeys.forEach((key) => console.error(`  - ${key}`));
    failed = true;
  } else {
    console.log(`ok - ${localeName} covers all ${allTKeys.length} tKeys`);
  }
}

if (failed) {
  console.error(`\nFAIL: Some locales are missing tKeys. See above.`);
  process.exit(1);
} else {
  console.log(`\nAll ${allTKeys.length} tKeys covered in all ${locales.length} locales. ✓`);
}
