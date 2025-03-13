# English Minimal Pairs App

This is an interactive language learning app designed to help English learners improve their phonemic awareness by practicing minimal pairs (words that differ by only one sound). The app supports learners with different first languages (L1) by providing tailored pairs for various L1 backgrounds.

## Features:
- **Interactive Practice**: Users can practice minimal pairs and receive immediate feedback on their guesses (correct/incorrect).
- **Tracking Progress**: Each user's performance is tracked, and their progress is displayed as a "batting average" for each minimal pair.
- **Support for Multiple L1s**: The app currently includes pairs for learners whose first language is Japanese, Mandarin, Thai, Spanish, Portuguese, Arabic, Russian, Korean, and Hindi/Urdu.
- **Audio Integration**: Each pair has corresponding audio files that play for the user to guess which word was spoken.

## Get Started

1. Install dependencies:

    ```bash
    npm install
    ```

2. Start the app:

    ```bash
    npx expo start
    ```

In the output, you'll find options to open the app in a:
- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

## Project Structure

- **app**: Contains the app's main screens and logic.
    - `index.tsx`: Home screen where users practice minimal pairs.
    - `results.tsx`: Displays user progress for each minimal pair.
- **constants**: Contains minimal pair data with categories and associated audio files.
    - `minimalPairs.ts`: Contains the minimal pairs data structure.
- **src/context**: Contains the `PairProgressContext` to track user progress.
- **assets/audio**: Contains all the audio files for the minimal pairs.

## Learn More

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the Community

Join our community of developers creating universal apps:

- [Expo on GitHub](https://github.com/expo/expo): View our open-source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.