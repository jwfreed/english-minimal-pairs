const mockPlayAsync = jest.fn(() => Promise.resolve());
const mockUnloadAsync = jest.fn(() => Promise.resolve());
const mockLoadAsync = jest.fn(() => Promise.resolve());

const mockSoundInstance = {
  loadAsync: mockLoadAsync,
  playAsync: mockPlayAsync,
  unloadAsync: mockUnloadAsync,
};

export const Audio = {
  Sound: jest.fn(() => mockSoundInstance),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  InterruptionModeIOS: {
    DuckOthers: 'DUCK_OTHERS_IOS',
  },
  InterruptionModeAndroid: {
    DuckOthers: 'DUCK_OTHERS_ANDROID',
  },
};

export default {
  Audio,
};
