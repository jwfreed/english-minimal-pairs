// Source-contract tests: the TTS debug screen must exercise the same
// speech-option construction as production playback (useAudio), so device
// debugging validates what users actually hear. Option *values* (voice id,
// locale, en-US fallback, rate/pitch/volume) are covered by
// audioPlayback.test.js; these tests only pin the single-source-of-truth
// wiring, in the same spirit as validate-audio-assets.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const debugScreenSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'TTSDebugScreen.tsx'),
  'utf8'
);
const useAudioSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'useAudio.ts'),
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

runTest('debug screen builds speech options via the shared audioPlayback domain builder', () => {
  assert.ok(
    debugScreenSource.includes('buildSpeechOptions'),
    'TTSDebugScreen must call buildSpeechOptions'
  );
  assert.ok(
    debugScreenSource.includes("from '@/src/domain/audioPlayback'"),
    'TTSDebugScreen must import from the audioPlayback domain module'
  );
});

runTest('debug screen and production playback import the same builder module', () => {
  assert.ok(
    useAudioSource.includes('buildSpeechOptions') &&
      useAudioSource.includes("from '@/src/domain/audioPlayback'"),
    'useAudio must keep using the shared builder'
  );
});

runTest('debug screen has exactly one Speech.speak call site fed by the shared builder', () => {
  const speakCalls = debugScreenSource.match(/Speech\.speak\(/g) || [];
  assert.strictEqual(
    speakCalls.length,
    1,
    `expected 1 Speech.speak call site, found ${speakCalls.length}`
  );
});

runTest('debug screen contains no hand-rolled speech-option literals', () => {
  assert.ok(
    !/language:\s*['"]/.test(debugScreenSource),
    'no hardcoded language literal (locale must come from the builder / PR 4 path)'
  );
  assert.ok(
    !/pitch:\s*[\d]/.test(debugScreenSource),
    'no inline pitch literal (must come from the builder)'
  );
  assert.ok(
    !/volume:\s*[\d]/.test(debugScreenSource),
    'no inline volume literal (must come from the builder)'
  );
});

runTest('debug screen selects voices through the production rotation (exclusions + priority)', () => {
  assert.ok(
    debugScreenSource.includes('useSettings') &&
      debugScreenSource.includes('getNextVoice'),
    'TTSDebugScreen must obtain voices via SettingsContext getNextVoice'
  );
  assert.ok(
    !/englishVoices\[0\]/.test(debugScreenSource),
    'no ad-hoc first-English-voice selection'
  );
});
