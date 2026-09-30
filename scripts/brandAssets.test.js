// Native brand colors in app.json must follow the Ember palette in Colors.ts:
// the splash sits on the app's own background in each theme, and the Android
// adaptive icon's background is the icon tile's graphite. The iOS icon must
// be opaque (App Store submission rejects an alpha channel).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const { Colors } = loadTsModule(path.join(ROOT, 'src', 'constants', 'Colors.ts'));
const { expo } = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

/** PNG IHDR color type: 2 = RGB, 6 = RGBA (alpha). */
function pngColorType(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath))[25];
}

const same = (a, b) => a.toUpperCase() === b.toUpperCase();

runTest('splash backgrounds match the app background in each theme', () => {
  const [, splash] = expo.plugins.find((plugin) => plugin[0] === 'expo-splash-screen');
  assert.ok(same(splash.backgroundColor, Colors.light.background));
  assert.ok(same(splash.dark.backgroundColor, Colors.dark.background));
});

runTest('adaptive icon background is the icon tile graphite', () => {
  assert.ok(same(expo.android.adaptiveIcon.backgroundColor, Colors.light.text));
});

runTest('the iOS icon is opaque', () => {
  assert.strictEqual(pngColorType(expo.icon), 2);
});
