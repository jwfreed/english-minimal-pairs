import React from 'react';
import { render } from '@testing-library/react-native';
import TimePracticedBar from '../../components/TimePracticedBar';

jest.mock('@/hooks/useLanguageScheme', () => ({
  useLanguageScheme: () => ({
    t: (key: string) => {
      if (key === 'timePracticed') return 'Time Practiced';
      if (key === 'min') return 'min';
      return key;
    },
  }),
}));

describe('TimePracticedBar', () => {
  it('renders with default goal and expected text', () => {
    const { getByText } = render(<TimePracticedBar minutes={15} />);
    expect(getByText('Time Practiced: 15 / 60 min')).toBeTruthy();
  });

  it('renders correct bar width for full progress', () => {
    const { getByTestId } = render(<TimePracticedBar minutes={60} goal={60} />);
    const barFill = getByTestId('progress-bar-fill');
    const style = Array.isArray(barFill.props.style)
      ? barFill.props.style.find((s: any) => s?.width)
      : barFill.props.style;
    expect(style?.width).toBe('100%');
  });

  it('caps progress at 100%', () => {
    const { getByTestId } = render(
      <TimePracticedBar minutes={120} goal={60} />
    );
    const barFill = getByTestId('progress-bar-fill');
    const style = Array.isArray(barFill.props.style)
      ? barFill.props.style.find((s: any) => s?.width)
      : barFill.props.style;
    expect(style?.width).toBe('100%');
  });

  it('renders correctly with 0 minutes', () => {
    const { getByText, getByTestId } = render(
      <TimePracticedBar minutes={0} goal={60} />
    );
    expect(getByText('Time Practiced: 0 / 60 min')).toBeTruthy();
    const barFill = getByTestId('progress-bar-fill');
    const style = Array.isArray(barFill.props.style)
      ? barFill.props.style.find((s: any) => s?.width)
      : barFill.props.style;
    expect(style?.width).toBe('0%');
  });
});
