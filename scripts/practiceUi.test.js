// Source-contract coverage for the contrast-first practice hierarchy and the
// pair-selector disclosure. The project does not include a component-rendering
// test dependency, so these checks pin the accessibility and ordering contract
// without adding a new test stack for a small presentation-only refinement.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const practiceScreenSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(tabs)', 'index.tsx'),
  'utf8'
);
const pairSelectorSource = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'components',
    'practice',
    'PracticePairSelector.tsx'
  ),
  'utf8'
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

function assertInOrder(source, tokens, message) {
  let previousIndex = -1;
  for (const token of tokens) {
    const nextIndex = source.indexOf(token, previousIndex + 1);
    assert.ok(nextIndex > previousIndex, `${message}: missing or out of order: ${token}`);
    previousIndex = nextIndex;
  }
}

runTest('contrast header renders contrast, mastery, then listening instruction', () => {
  assertInOrder(
    practiceScreenSource,
    [
      'styles.contrastTitle',
      '<LevelIndicator',
      'tKeys.listenForSoundDifference',
      '<PracticePairSelector',
    ],
    'contrast-first practice hierarchy changed'
  );
});

runTest('pair selector toggle uses an accessible button role', () => {
  assert.ok(
    pairSelectorSource.includes('accessibilityRole="button"'),
    'pair selector toggle must remain an accessible button'
  );
});

runTest('only the sound contrast is exposed as the contrast heading', () => {
  assert.ok(
    practiceScreenSource.includes('<Text accessibilityRole="header" style={styles.contrastTitle}>'),
    'sound contrast text must be exposed as the heading'
  );
  assert.ok(
    !practiceScreenSource.includes('style={styles.contrastHeader} accessibilityRole="header"'),
    'level and instruction must not be grouped into the heading'
  );
});

runTest('pair selector exposes its expanded and collapsed state', () => {
  assert.ok(
    pairSelectorSource.includes('accessibilityState={{ expanded: isPickerVisible }}'),
    'pair selector must expose disclosure state to native assistive technology'
  );
  assert.ok(
    pairSelectorSource.includes('aria-expanded={isPickerVisible}'),
    'pair selector must expose disclosure state on the web'
  );
  assert.ok(
    pairSelectorSource.includes('aria-controls="practice-pair-picker"') &&
      pairSelectorSource.includes('nativeID="practice-pair-picker"'),
    'pair selector toggle must identify the controlled picker'
  );
  assert.ok(
    pairSelectorSource.includes('{isPickerVisible && ('),
    'pair picker must render only while the disclosure is expanded'
  );
});

runTest('pair selector renders the optional example-selection copy', () => {
  const copyUsages = pairSelectorSource.match(/tKeys\.chooseAnotherExample/g) || [];
  assert.strictEqual(
    copyUsages.length,
    3,
    'toggle text, toggle accessibility label, and picker label must share the example copy'
  );
});
