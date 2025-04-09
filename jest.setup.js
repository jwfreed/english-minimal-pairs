// Mock AsyncStorage globally
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-av');

// Cache the original console.error
const originalConsoleError = console.error;

// Silence animated act(...) warnings from React Native
jest.spyOn(console, 'error').mockImplementation((message, ...args) => {
  if (
    typeof message === 'string' &&
    message.includes('Animated(View) inside a test was not wrapped in act')
  ) {
    return;
  }
  originalConsoleError(message, ...args);
});
