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

const getPlaceholders = (value) =>
  [...new Set(
    [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1])
  )].sort();

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

  for (const key of allTKeys) {
    const expectedPlaceholders = getPlaceholders(englishTranslations[key]);
    const actualPlaceholders = getPlaceholders(localeObj[key]);
    if (JSON.stringify(actualPlaceholders) !== JSON.stringify(expectedPlaceholders)) {
      console.error(
        `FAIL - ${localeName}.${key} placeholders differ: expected ` +
          `[${expectedPlaceholders.join(', ')}], received [${actualPlaceholders.join(', ')}]`
      );
      failed = true;
    }
  }
}

if (failed) {
  console.error(`\nFAIL: Some locales are missing tKeys. See above.`);
  process.exit(1);
} else {
  console.log(`\nAll ${allTKeys.length} tKeys covered in all ${locales.length} locales. ✓`);
}
