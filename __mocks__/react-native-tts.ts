// __mocks__/react-native-tts.ts
const mockTts = {
  speak: jest.fn(() => Promise.resolve('utteranceId')),
  stop: jest.fn(() => Promise.resolve()),
  voices: jest.fn(() => Promise.resolve([
    {
      id: 'com.apple.voice.compact.en-US.Samantha',
      name: 'Samantha',
      language: 'en-US',
      quality: 300,
      latency: 300,
      networkConnectionRequired: false,
      notInstalled: false,
    },
    {
      id: 'com.apple.voice.compact.en-GB.Daniel',
      name: 'Daniel',
      language: 'en-GB',
      quality: 300,
      latency: 300,
      networkConnectionRequired: false,
      notInstalled: false,
    }
  ])),
  setDefaultLanguage: jest.fn(() => Promise.resolve()),
  setDefaultVoice: jest.fn(() => Promise.resolve()),
  setDefaultRate: jest.fn(() => Promise.resolve()),
  setDefaultPitch: jest.fn(() => Promise.resolve()),
  setDucking: jest.fn(() => Promise.resolve()),
  setIgnoreSilentSwitch: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  removeAllListeners: jest.fn(),
};

export default mockTts;
