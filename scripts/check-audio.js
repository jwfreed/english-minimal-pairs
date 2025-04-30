// scripts/check-audio.js
/* ------------------------------------------------------------------
 *  Audio‑sanity checker (generic)
 *  ---------------------------------------------------------------
 *  Pass the language slug (e.g. `chinese`, `japanese`) and the script
 *  will compare the <lang>.ts requires to what actually lives in
 *  assets/audio.
 *
 *    node scripts/check-audio.js            # defaults to 'chinese'
 *    node scripts/check-audio.js japanese   # checks japanese.ts
 * ----------------------------------------------------------------*/

const fs = require('fs');
const path = require('path');

// 📂 1. catalogue files on disk ------------------------------------------------
const AUDIO_DIR = path.join(__dirname, '../assets/audio');
const diskFiles = new Set(
  fs.readdirSync(AUDIO_DIR).filter((f) => /\.(mp3|wav|m4a)$/i.test(f))
);

// 📝 2. derive expected list from the <lang>.ts source --------------------------
const lang = (process.argv[2] || 'chinese').replace(/\.ts$/, '');
const TS_PATH = path.join(__dirname, `../constants/minimalPairs/${lang}.ts`);

if (!fs.existsSync(TS_PATH)) {
  console.error(`❌  Language file not found: ${TS_PATH}`);
  process.exit(1);
}

const source = fs.readFileSync(TS_PATH, 'utf8');

//   pull every filename inside   require('…/audio/<name>.mp3')
const RE = /require\([^)]*\/([\w-]+)\.(?:mp3|wav|m4a)'?\)/g;
const expected = [...source.matchAll(RE)].map((m) => m[1]);

const expectedSet = new Set(expected);

// 🕵️‍ 3. compare ---------------------------------------------------------------
const missing = [...expectedSet].filter((w) => !diskFiles.has(`${w}.mp3`));
const extra = [...diskFiles].filter(
  (f) => !expectedSet.has(f.replace(/\.(?:mp3|wav|m4a)$/i, ''))
);

// 🖨️ 4. report -----------------------------------------------------------------
console.log('— Existing files —');
[...diskFiles].sort().forEach((f) => console.log('  ✓', f));

console.log('\n— Missing files —');
missing.forEach((w) => console.log('  ✗', `${w}.mp3`));

console.log('\n— Unreferenced files —');
extra.forEach((f) => console.log('  ?', f));
