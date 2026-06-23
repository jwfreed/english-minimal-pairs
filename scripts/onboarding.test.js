const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  ONBOARDING_SEEN_KEY,
  shouldShowOnboarding,
} = loadTsModule(path.join(__dirname, '..', 'src', 'storage', 'onboardingStorage.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// ── ONBOARDING_SEEN_KEY ──────────────────────────────────────────────────────

runTest('ONBOARDING_SEEN_KEY has expected value', () => {
  assert.strictEqual(ONBOARDING_SEEN_KEY, '@hasSeenOnboarding');
});

// ── shouldShowOnboarding ─────────────────────────────────────────────────────

runTest('null raw → show onboarding (fresh install, key absent)', () => {
  assert.strictEqual(shouldShowOnboarding(null), true);
});

runTest("'true' raw → skip onboarding (previously dismissed)", () => {
  assert.strictEqual(shouldShowOnboarding('true'), false);
});

runTest("empty string raw → skip onboarding (any non-null value skips)", () => {
  assert.strictEqual(shouldShowOnboarding(''), false);
});

runTest("arbitrary non-null string → skip onboarding", () => {
  assert.strictEqual(shouldShowOnboarding('anything'), false);
});
