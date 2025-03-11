import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PairStats = {
  attempts: number;
  correct: number;
};

type PairProgressMap = {
  [pairId: string]: PairStats;
};

type PairProgressContextValue = {
  progress: PairProgressMap;
  recordAttempt: (pairId: string, isCorrect: boolean) => void;
};

const STORAGE_KEY = '@pairProgress';

const PairProgressContext = createContext<PairProgressContextValue | undefined>(
  undefined
);

export function PairProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [progress, setProgress] = useState<PairProgressMap>({});

  // Load saved progress from AsyncStorage on mount
  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setProgress(JSON.parse(data));
      }
    } catch (err) {
      console.error('Error loading pair progress:', err);
    }
  }

  // Save progress to AsyncStorage
  async function saveProgress(updated: PairProgressMap) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving pair progress:', err);
    }
  }

  // Called when user guesses a pair
  function recordAttempt(pairId: string, isCorrect: boolean) {
    setProgress((prev) => {
      const prevStats = prev[pairId] || { attempts: 0, correct: 0 };
      const newStats: PairStats = {
        attempts: prevStats.attempts + 1,
        correct: prevStats.correct + (isCorrect ? 1 : 0),
      };
      const updated = { ...prev, [pairId]: newStats };
      saveProgress(updated);
      return updated;
    });
  }

  return (
    <PairProgressContext.Provider value={{ progress, recordAttempt }}>
      {children}
    </PairProgressContext.Provider>
  );
}

export function usePairProgress() {
  const context = useContext(PairProgressContext);
  if (!context) {
    throw new Error(
      'usePairProgress must be used within a PairProgressProvider'
    );
  }
  return context;
}
