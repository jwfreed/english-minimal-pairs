import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import HomeScreen from '../../app/(tabs)/index';
import { PairProgressProvider } from '../../src/context/PairProgressContext';
import { LanguageSchemeProvider } from '../../hooks/useLanguageScheme';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-av', () => {
  const mockPlayAsync = jest.fn(() => Promise.resolve());
  const mockUnloadAsync = jest.fn(() => Promise.resolve());
  const mockLoadAsync = jest.fn(() => Promise.resolve());

  const mockSoundInstance = {
    loadAsync: mockLoadAsync,
    playAsync: mockPlayAsync,
    unloadAsync: mockUnloadAsync,
  };

  return {
    Audio: {
      Sound: jest.fn(() => mockSoundInstance),
      setAudioModeAsync: jest.fn(() => Promise.resolve()),
    },
    InterruptionModeIOS: {
      DuckOthers: 'DUCK_OTHERS_IOS',
    },
    InterruptionModeAndroid: {
      DuckOthers: 'DUCK_OTHERS_ANDROID',
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('HomeScreen - Play Audio', () => {
  it('renders the Play Audio button', async () => {
    const { getByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <HomeScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    const button = getByText('オーディオを再生');
    expect(button).toBeTruthy();
  });

  it('plays audio when the Play Audio button is pressed', async () => {
    const { getByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <HomeScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    // Interact
    await act(async () => {
      fireEvent.press(getByText('オーディオを再生'));
    });

    await waitFor(() => {
      expect(new Audio.Sound().playAsync).toHaveBeenCalled();
    });
  });

  it('updates progress in AsyncStorage after answering', async () => {
    const { getByText, getAllByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <HomeScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    // Press play
    await act(async () => {
      fireEvent.press(getByText('オーディオを再生'));
    });

    // Wait for play
    await waitFor(() => {
      expect(new Audio.Sound().playAsync).toHaveBeenCalled();
    });

    // Press an answer
    const answerButtons = getAllByText(/^[a-z]+$/i);
    await act(async () => {
      fireEvent.press(answerButtons[0]);
    });

    // Check progress saved
    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@userProgress',
        expect.any(String)
      );
    });
  });

  // -- NEW FEEDBACK OVERLAY TESTS --
  it('shows "✓" if the user picks the correct answer', async () => {
    // Force random to pick index 0 as correct
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);

    const { getByText, queryByText, getAllByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <HomeScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    // Press play
    await act(async () => {
      fireEvent.press(getByText('オーディオを再生'));
    });

    // Wait for audio
    await waitFor(() => {
      expect(new Audio.Sound().playAsync).toHaveBeenCalled();
    });

    // The correct word is presumably at index 0
    const answerButtons = getAllByText(/^[a-z]+$/i);

    // Confirm no checkmark yet
    expect(queryByText('✓')).toBeNull();

    // Press the correct button
    await act(async () => {
      fireEvent.press(answerButtons[0]);
    });

    // Expect checkmark
    expect(queryByText('✓')).toBeTruthy();
    // Reset random
    (Math.random as jest.Mock).mockRestore();
  });

  it('shows "✗" if the user picks the wrong answer', async () => {
    // Force random to pick index 0 as correct
    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);

    const { getByText, queryByText, getAllByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <HomeScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    // Press play
    await act(async () => {
      fireEvent.press(getByText('オーディオを再生'));
    });

    // Wait for audio
    await waitFor(() => {
      expect(new Audio.Sound().playAsync).toHaveBeenCalled();
    });

    // The correct word is presumably at index 0, so we press index 1
    const answerButtons = getAllByText(/^[a-z]+$/i);

    // Confirm no X yet
    expect(queryByText('✗')).toBeNull();

    // Press the wrong button
    await act(async () => {
      fireEvent.press(answerButtons[1]);
    });

    // Expect X
    expect(queryByText('✗')).toBeTruthy();
    // Reset random
    (Math.random as jest.Mock).mockRestore();
  });
});
