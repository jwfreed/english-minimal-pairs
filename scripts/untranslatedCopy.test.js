// Every piece of user-facing copy goes through a translation key. Literal JSX
// text, or a literal accessibility label/hint, title or placeholder, would
// show English (or nothing) to learners using another UI language.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// Developer-only screens are exempt.
const EXEMPT = [path.join('src', 'dev'), path.join('src', 'components', 'TTSDebugScreen.tsx')];

const LITERAL_COPY = [
  // JSX text containing a word, e.g. <Text>Go home</Text>
  />[^<>{}]*\p{L}{2,}[^<>{}]*<\//u,
  // String-literal props that reach the screen or assistive technology
  /\b(accessibilityLabel|accessibilityHint|title|placeholder)="[^"]*\p{L}/u,
  // String-literal titles in navigation options
  /\b(title|headerTitle|tabBarLabel):\s*['"`][^'"`]*\p{L}/u,
  // Literal string children in expressions, e.g. {'Hello'}
  /\{\s*['"][^'"]*\p{L}{2,}[^'"]*['"]\s*\}/u,
];

function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      if (EXEMPT.some((exempt) => relative.startsWith(exempt))) continue;
      if (entry.isDirectory()) walk(relative);
      else if (entry.name.endsWith('.tsx')) files.push(relative);
    }
  };
  ['src', 'app'].forEach(walk);
  return files;
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

runTest('screens and components render no literal copy', () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    fs.readFileSync(path.join(ROOT, file), 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (LITERAL_COPY.some((pattern) => pattern.test(line))) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  assert.deepStrictEqual(offenders, []);
});
