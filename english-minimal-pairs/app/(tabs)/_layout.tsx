import { Tabs } from 'expo-router';
import { PairProgressProvider } from '../../src/context/PairProgressContext';

export default function TabLayout() {
  return (
    <PairProgressProvider>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="results" options={{ title: 'Results' }} />
      </Tabs>
    </PairProgressProvider>
  );
}
