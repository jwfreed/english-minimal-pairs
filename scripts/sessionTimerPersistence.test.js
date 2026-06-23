const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  SESSION_TIMER_CUMULATIVE_STORAGE_KEY,
  SESSION_TIMER_STORAGE_KEY,
  getDefaultCumulativeTimerSeconds,
  getDefaultSessionTimerSeconds,
  parseStoredCumulativeTimerSeconds,
  parseStoredSessionTimerSeconds,
  serializeCumulativeTimerSeconds,
  serializeSessionTimerSeconds,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'sessionTimerPersistence.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const today = '2026-05-16';

runTest('session timer storage keys are explicit', () => {
  assert.strictEqual(SESSION_TIMER_STORAGE_KEY, '@sessionTimer');
  assert.strictEqual(SESSION_TIMER_CUMULATIVE_STORAGE_KEY, '@sessionTimerCumulative');
});

runTest('session timer defaults are zero seconds', () => {
  assert.strictEqual(getDefaultSessionTimerSeconds(), 0);
  assert.strictEqual(getDefaultCumulativeTimerSeconds(), 0);
});

runTest('parseStoredSessionTimerSeconds returns default for missing or empty values', () => {
  assert.strictEqual(parseStoredSessionTimerSeconds(null, today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds('', today), 0);
});

runTest('parseStoredSessionTimerSeconds returns default for malformed or stale values', () => {
  assert.strictEqual(parseStoredSessionTimerSeconds('{bad json', today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds('"not a timer object"', today), 0);
  assert.strictEqual(
    parseStoredSessionTimerSeconds(JSON.stringify({ date: '2026-05-15', seconds: 90 }), today),
    0
  );
});

runTest('parseStoredSessionTimerSeconds accepts valid integer seconds for today', () => {
  assert.strictEqual(
    parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: 90 }), today),
    90
  );
});

runTest('parseStoredSessionTimerSeconds rejects unsafe numeric boundaries', () => {
  assert.strictEqual(parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: -1 }), today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: 1.5 }), today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: null }), today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: 'NaN' }), today), 0);
  assert.strictEqual(parseStoredSessionTimerSeconds(JSON.stringify({ date: today, seconds: 'Infinity' }), today), 0);
});

runTest('parseStoredCumulativeTimerSeconds returns default for missing or malformed values', () => {
  assert.strictEqual(parseStoredCumulativeTimerSeconds(null), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds(''), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('{bad json'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('"not seconds"'), 0);
});

runTest('parseStoredCumulativeTimerSeconds accepts valid integer seconds', () => {
  assert.strictEqual(parseStoredCumulativeTimerSeconds('120'), 120);
});

runTest('parseStoredCumulativeTimerSeconds rejects unsafe numeric boundaries', () => {
  assert.strictEqual(parseStoredCumulativeTimerSeconds('-1'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('1.5'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('NaN'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('Infinity'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('"NaN"'), 0);
  assert.strictEqual(parseStoredCumulativeTimerSeconds('"Infinity"'), 0);
});

runTest('valid session timer values round-trip through serialize and parse', () => {
  const stored = serializeSessionTimerSeconds(today, 300);

  assert.strictEqual(parseStoredSessionTimerSeconds(stored, today), 300);
});

runTest('valid cumulative timer values round-trip through serialize and parse', () => {
  const stored = serializeCumulativeTimerSeconds(900);

  assert.strictEqual(parseStoredCumulativeTimerSeconds(stored), 900);
});
