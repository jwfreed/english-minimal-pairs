// __mocks__/expo-speech.ts
export const speak = jest.fn();
export const stop = jest.fn(() => Promise.resolve());
export const isSpeakingAsync = jest.fn(() => Promise.resolve(false));

export default {
  speak,
  stop,
  isSpeakingAsync,
};
