// Every text style renders in Public Sans. Each weight is a separately loaded
// family, so a style that sets fontWeight (or a size) without the matching
// face silently falls back to the system font. `font(weight)` sets both.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Developer-only screens are exempt.
const EXEMPT = [path.join('src', 'dev'), path.join('src', 'components', 'TTSDebugScreen.tsx')];

function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      if (EXEMPT.some((exempt) => relative.startsWith(exempt))) continue;
      if (entry.isDirectory()) walk(relative);
      else if (/\.tsx?$/.test(entry.name)) files.push(relative);
    }
  };
  ['src', 'app'].forEach(walk);
  return files.filter((file) => file !== path.join('src', 'constants', 'typography.ts'));
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const sources = sourceFiles().map((file) => [
  file,
  fs.readFileSync(path.join(ROOT, file), 'utf8'),
]);

runTest('no style sets a weight or face except through font()', () => {
  const offenders = sources
    .filter(([, source]) => /\b(fontWeight|fontFamily)\s*:/.test(source))
    .map(([file]) => file);
  assert.deepStrictEqual(offenders, []);
});

runTest('every named text style spreads font()', () => {
  const offenders = [];
  for (const [file, source] of sources) {
    for (const match of source.matchAll(/(\w+)\s*:\s*\{([^{}]*)\}/g)) {
      const body = match[2];
      if (/\bfontSize\s*:/.test(body) && !/\.\.\.(font|baseFont)\(/.test(body)) {
        offenders.push(`${file}: ${match[1]}`);
      }
    }
  }
  assert.deepStrictEqual(offenders, []);
});
