// src/hooks/useColorScheme.ts
import { useColorScheme as _useColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  const systemScheme = _useColorScheme();
  return systemScheme === 'dark' ? 'dark' : 'light';
}
