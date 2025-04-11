const originalError = globalThis.console.error;
globalThis.console.error = (...args) => {
  const msg = args[0];
  if (
    typeof msg === 'string' &&
    msg.includes('Animated(View) inside a test was not wrapped in act')
  ) {
    return;
  }
  originalError(...args);
};

jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-av');
