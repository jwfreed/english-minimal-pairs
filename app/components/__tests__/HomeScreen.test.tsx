import React from 'react';import React from 'react';

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import HomeScreen from '../../(tabs)/index';import HomeScreen from '../../app/(tabs)/index';

import { PairProgressProvider } from '@/app/context/PairProgressContext';import { PairProgressProvider } from '@/app/context/PairProgressContext';

import { LanguageSchemeProvider } from '@/app/context/LanguageContext';import { LanguageSchemeProvider } from @/srchooks/useLanguageScheme';

import * as Speech from 'expo-speech';import { Audio } from 'expo-av';

import AsyncStorage from '@react-native-async-storage/async-storage';import AsyncStorage from '@react-native-async-storage/async-storage';

// Fix LogBox for test environment// Fix LogBox for test environment

import { LogBox } from 'react-native';import { LogBox } from 'react-native';

if (!LogBox.ignoreLogs) {if (!LogBox.ignoreLogs) {

  LogBox.ignoreLogs = jest.fn();  LogBox.ignoreLogs = jest.fn();

}}

jest.mock('react-native/Libraries/ReactNative/LogBox', () => ({jest.mock('react-native/Libraries/ReactNative/LogBox', () => ({

  ignoreLogs: jest.fn(),  ignoreLogs: jest.fn(),

}));}));



jest.mock('expo-speech', () => ({jest.mock('expo-av', () => {

  speak: jest.fn(),  const mockPlayAsync = jest.fn(() => Promise.resolve());

  stop: jest.fn(() => Promise.resolve()),  const mockUnloadAsync = jest.fn(() => Promise.resolve());

}));  const mockLoadAsync = jest.fn(() => Promise.resolve());



jest.mock('@react-native-async-storage/async-storage', () =>  const mockSoundInstance = {

  require('@react-native-async-storage/async-storage/jest/async-storage-mock')    loadAsync: mockLoadAsync,

);    playAsync: mockPlayAsync,

    unloadAsync: mockUnloadAsync,

describe('HomeScreen - Play Audio', () => {  };

  it('renders the Play Audio button', async () => {

    const { getByText } = render(  return {

      <PairProgressProvider>    Audio: {

        <LanguageSchemeProvider>      Sound: jest.fn(() => mockSoundInstance),

          <HomeScreen />      setAudioModeAsync: jest.fn(() => Promise.resolve()),

        </LanguageSchemeProvider>    },

      </PairProgressProvider>    InterruptionModeIOS: {

    );      DuckOthers: 'DUCK_OTHERS_IOS',

    },

    const button = getByText('オーディオを再生');    InterruptionModeAndroid: {

    expect(button).toBeTruthy();      DuckOthers: 'DUCK_OTHERS_ANDROID',

  });    },

  };

  it('plays audio when the Play Audio button is pressed', async () => {});

    const { getByText } = render(

      <PairProgressProvider>jest.mock('@react-native-async-storage/async-storage', () =>

        <LanguageSchemeProvider>  require('@react-native-async-storage/async-storage/jest/async-storage-mock')

          <HomeScreen />);

        </LanguageSchemeProvider>

      </PairProgressProvider>describe('HomeScreen - Play Audio', () => {

    );  it('renders the Play Audio button', async () => {

    const { getByText } = render(

    // Interact      <PairProgressProvider>

    await act(async () => {        <LanguageSchemeProvider>

      fireEvent.press(getByText('オーディオを再生'));          <HomeScreen />

    });        </LanguageSchemeProvider>

      </PairProgressProvider>

    await waitFor(() => {    );

      expect(Speech.speak).toHaveBeenCalled();

    });    const button = getByText('オーディオを再生');

  });    expect(button).toBeTruthy();

  });

  it('updates progress in AsyncStorage after answering', async () => {

    const { getByText, getAllByText } = render(  it('plays audio when the Play Audio button is pressed', async () => {

      <PairProgressProvider>    const { getByText } = render(

        <LanguageSchemeProvider>      <PairProgressProvider>

          <HomeScreen />        <LanguageSchemeProvider>

        </LanguageSchemeProvider>          <HomeScreen />

      </PairProgressProvider>        </LanguageSchemeProvider>

    );      </PairProgressProvider>

    );

    // Press play

    await act(async () => {    // Interact

      fireEvent.press(getByText('オーディオを再生'));    await act(async () => {

    });      fireEvent.press(getByText('オーディオを再生'));

    });

    // Wait for play

    await waitFor(() => {    await waitFor(() => {

      expect(Speech.speak).toHaveBeenCalled();      expect(new Audio.Sound().playAsync).toHaveBeenCalled();

    });    });

  });

    // Press an answer

    const answerButtons = getAllByText(/^[a-z]+$/i);  it('updates progress in AsyncStorage after answering', async () => {

    await act(async () => {    const { getByText, getAllByText } = render(

      fireEvent.press(answerButtons[0]);      <PairProgressProvider>

    });        <LanguageSchemeProvider>

          <HomeScreen />

    // Check progress saved        </LanguageSchemeProvider>

    await waitFor(() => {      </PairProgressProvider>

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(    );

        '@userProgress',

        expect.any(String)    // Press play

      );    await act(async () => {

    });      fireEvent.press(getByText('オーディオを再生'));

  });    });



  // -- NEW FEEDBACK OVERLAY TESTS --    // Wait for play

  it('shows "✓" if the user picks the correct answer', async () => {    await waitFor(() => {

    // Force random to pick index 0 as correct      expect(new Audio.Sound().playAsync).toHaveBeenCalled();

    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);    });



    const { getByText, queryByText, getAllByText } = render(    // Press an answer

      <PairProgressProvider>    const answerButtons = getAllByText(/^[a-z]+$/i);

        <LanguageSchemeProvider>    await act(async () => {

          <HomeScreen />      fireEvent.press(answerButtons[0]);

        </LanguageSchemeProvider>    });

      </PairProgressProvider>

    );    // Check progress saved

    await waitFor(() => {

    // Press play      expect(AsyncStorage.setItem).toHaveBeenCalledWith(

    await act(async () => {        '@userProgress',

      fireEvent.press(getByText('オーディオを再生'));        expect.any(String)

    });      );

    });

    // Wait for audio  });

    await waitFor(() => {

      expect(Speech.speak).toHaveBeenCalled();  // -- NEW FEEDBACK OVERLAY TESTS --

    });  it('shows "✓" if the user picks the correct answer', async () => {

    // Force random to pick index 0 as correct

    // The correct word is presumably at index 0    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);

    const answerButtons = getAllByText(/^[a-z]+$/i);

    const { getByText, queryByText, getAllByText } = render(

    // Confirm no checkmark yet      <PairProgressProvider>

    expect(queryByText('✓')).toBeNull();        <LanguageSchemeProvider>

          <HomeScreen />

    // Press the correct button        </LanguageSchemeProvider>

    await act(async () => {      </PairProgressProvider>

      fireEvent.press(answerButtons[0]);    );

    });

    // Press play

    // Expect checkmark    await act(async () => {

    expect(queryByText('✓')).toBeTruthy();      fireEvent.press(getByText('オーディオを再生'));

    // Reset random    });

    (Math.random as jest.Mock).mockRestore();

  });    // Wait for audio

    await waitFor(() => {

  it('shows "✗" if the user picks the wrong answer', async () => {      expect(new Audio.Sound().playAsync).toHaveBeenCalled();

    // Force random to pick index 0 as correct    });

    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);

    // The correct word is presumably at index 0

    const { getByText, queryByText, getAllByText } = render(    const answerButtons = getAllByText(/^[a-z]+$/i);

      <PairProgressProvider>

        <LanguageSchemeProvider>    // Confirm no checkmark yet

          <HomeScreen />    expect(queryByText('✓')).toBeNull();

        </LanguageSchemeProvider>

      </PairProgressProvider>    // Press the correct button

    );    await act(async () => {

      fireEvent.press(answerButtons[0]);

    // Press play    });

    await act(async () => {

      fireEvent.press(getByText('オーディオを再生'));    // Expect checkmark

    });    expect(queryByText('✓')).toBeTruthy();

    // Reset random

    // Wait for audio    (Math.random as jest.Mock).mockRestore();

    await waitFor(() => {  });

      expect(Speech.speak).toHaveBeenCalled();

    });  it('shows "✗" if the user picks the wrong answer', async () => {

    // Force random to pick index 0 as correct

    // The correct word is presumably at index 0, so we press index 1    jest.spyOn(Math, 'random').mockReturnValueOnce(0.2);

    const answerButtons = getAllByText(/^[a-z]+$/i);

    const { getByText, queryByText, getAllByText } = render(

    // Confirm no X yet      <PairProgressProvider>

    expect(queryByText('✗')).toBeNull();        <LanguageSchemeProvider>

          <HomeScreen />

    // Press the wrong button        </LanguageSchemeProvider>

    await act(async () => {      </PairProgressProvider>

      fireEvent.press(answerButtons[1]);    );

    });

    // Press play

    // Expect X    await act(async () => {

    expect(queryByText('✗')).toBeTruthy();      fireEvent.press(getByText('オーディオを再生'));

    // Reset random    });

    (Math.random as jest.Mock).mockRestore();

  });    // Wait for audio

});    await waitFor(() => {

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
