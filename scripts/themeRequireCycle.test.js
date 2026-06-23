const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

function readSource(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function extractImportSpecifiers(source) {
  const imports = [];
  const importPattern = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importPattern.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
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

runTest('theme context does not import useThemeColor hook', () => {
  const themeSource = readSource('src/context/theme.tsx');
  const imports = extractImportSpecifiers(themeSource);

  assert.ok(
    !imports.some((specifier) => specifier.includes('useThemeColor')),
    'src/context/theme.tsx must not import src/hooks/useThemeColor.ts'
  );
});
