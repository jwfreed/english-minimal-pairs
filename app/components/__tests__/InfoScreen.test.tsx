import React from 'react';
import { render } from '@testing-library/react-native';
import InfoScreen from '../../app/(tabs)/infoScreen';
import { LanguageSchemeProvider } from @/srchooks/useLanguageScheme';
import { PairProgressProvider } from '@/app/context/PairProgressContext';

describe('InfoScreen', () => {
  it('displays the first title in the default language', () => {
    const { getByText } = render(
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <InfoScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    // Check for English titleOne fallback or default content
    expect(
      expect(getByText('👂 耳を鍛えて、リスニング力を変えよう！'))
    ).toBeTruthy();
  });
});
