# Soundwise English

![Multilingual](https://img.shields.io/badge/language-14%20Languages-blueviolet?style=for-the-badge&logo=translate)
![Offline First](https://img.shields.io/badge/Offline-First-ff9900?style=for-the-badge&logo=cloudflare)
![AsyncStorage](https://img.shields.io/badge/Storage-AsyncStorage-007acc?style=for-the-badge&logo=databricks)
![Expo](https://img.shields.io/badge/Built%20with-Expo-000020?style=for-the-badge&logo=expo)
![Mobile](https://img.shields.io/badge/Mobile-Friendly-28a745?style=for-the-badge&logo=android)
![React Native](https://img.shields.io/badge/Framework-React%20Native-61dafb?style=for-the-badge&logo=react)
[![codecov](https://codecov.io/gh/jwfreed/english-minimal-pairs/graph/badge.svg?token=79B3H4KJ4Z)](https://codecov.io/gh/jwfreed/english-minimal-pairs)

Soundwise English is an Expo React Native app for English learners practicing minimal pairs: words that differ by one sound. It adapts practice by learner language, records progress locally, and uses device text-to-speech for audio prompts.

## Features

- **Interactive Practice**: Users can practice minimal pairs and receive immediate feedback on their guesses (correct/incorrect).
- **Progress Tracking**: Attempts, accuracy, and active practice time are persisted with AsyncStorage on device.
- **Adaptive Progression**: Streak and response-time rules advance pair difficulty and mastery tiers.
- **Support for Multiple L1s**: The app includes tailored pair sets for supported learner language backgrounds.
- **TTS Audio**: Expo Speech plays English words, with voice rotation and an iOS silent-mode audio-session workaround.

## Get Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run project checks:

   ```bash
   npm run check
   ```

3. Start the app:

   ```bash
   npm run start
   ```

In the output, you'll find options to open the app in a:

- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Project Structure

- **app/(tabs)**: Main practice, results, and settings screens.
- **src/context**: Language, category, settings, theme, and progress providers.
- **src/storage**: AsyncStorage persistence for practice analytics.
- **src/learning**: Pure learning-rule helpers used by the practice UI.
- **src/hooks**: Audio, haptics, contrast-pair selection, and theme hooks.
- **src/constants/minimalPairs**: Minimal-pair data grouped by learner language.
- **assets/audio**: Silent audio asset used by the iOS TTS workaround.

## Learn More

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the Community

Join our community of developers creating universal apps:

- [Expo on GitHub](https://github.com/expo/expo): View our open-source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
