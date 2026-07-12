const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  IOS_TTS_UNAVAILABLE_MESSAGE,
  buildSpeechOptions,
  getPlaybackWord,
  requireIosVoicesForPlayback,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'audioPlayback.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const pair = {
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

runTest('getPlaybackWord returns the requested minimal-pair word', () => {
  assert.strictEqual(getPlaybackWord(pair, 0), 'right');
  assert.strictEqual(getPlaybackWord(pair, 1), 'light');
});

runTest('getPlaybackWord rejects missing selected pair before TTS calls', () => {
  assert.throws(
    () => getPlaybackWord(undefined, 0),
    /No pair selected/
  );
});

runTest('requireIosVoicesForPlayback rejects iOS playback when no TTS voices exist', () => {
  assert.throws(
    () => requireIosVoicesForPlayback('ios', []),
    new RegExp(IOS_TTS_UNAVAILABLE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
});

runTest('requireIosVoicesForPlayback allows Android without a local voice list', () => {
  assert.doesNotThrow(() => requireIosVoicesForPlayback('android', []));
});

runTest('buildSpeechOptions preserves the app speech defaults and selected voice', () => {
  const voice = {
    identifier: 'voice-1',
    name: 'Sample Voice',
    language: 'en-US',
  };
  const options = buildSpeechOptions({
    rate: 0.85,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-US');
  assert.strictEqual(options.pitch, 1.0);
  assert.strictEqual(options.rate, 0.85);
  assert.strictEqual(options.volume, 1.0);
  assert.strictEqual(options.voice, 'voice-1');
  assert.strictEqual(typeof options.onDone, 'function');
  assert.strictEqual(typeof options.onStopped, 'function');
  assert.strictEqual(typeof options.onError, 'function');
});

runTest('buildSpeechOptions omits voice and falls back to en-US when using the system default', () => {
  const options = buildSpeechOptions({
    rate: 1,
    voice: null,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'voice'), false);
  assert.strictEqual(options.language, 'en-US');
});

runTest('buildSpeechOptions uses a selected en-GB voice\'s own language, not a hardcoded en-US', () => {
  const voice = {
    identifier: 'voice-gb',
    name: 'Daniel',
    language: 'en-GB',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-GB');
  assert.strictEqual(options.voice, 'voice-gb');
});

runTest('buildSpeechOptions preserves a selected non-US English voice\'s own locale (en-AU)', () => {
  const voice = {
    identifier: 'voice-au',
    name: 'Karen',
    language: 'en-AU',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-AU');
  assert.strictEqual(options.voice, 'voice-au');
});

runTest('buildSpeechOptions falls back to en-US when the selected voice has a blank language', () => {
  const voice = {
    identifier: 'voice-blank',
    name: 'Mystery',
    language: '',
  };
  const options = buildSpeechOptions({
    rate: 1,
    voice,
    onDone: () => {},
    onStopped: () => {},
    onError: () => {},
  });

  assert.strictEqual(options.language, 'en-US');
  assert.strictEqual(options.voice, 'voice-blank');
});
