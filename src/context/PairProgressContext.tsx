// src/context/PairProgressContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  saveAttempt,
  getProgress,
  PairStats,
} from '../storage/progressStorage';

// Only use act in test environment to avoid dev/prod performance penalty
const isTest = process.env.NODE_ENV === 'test';
const maybeAct = isTest
  ? require('react-test-renderer').act
  : (fn: () => void) => fn();

/**
 * The shape of our PairProgress context,
 * now with recordAttempt supporting an optional `durationMin` param
 */
const PairProgressContext = createContext<{
  progress: Record<string, PairStats>;
  recordAttempt: (
    pairId: string,
    isCorrect: boolean,
    durationMin?: number
  ) => Promise<void>;
}>({
  progress: {},
  recordAttempt: async () => {}, // default empty
});

export const PairProgressProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});

  // Load progress from storage on mount
  useEffect(() => {
    const loadProgress = async () => {
      const storedProgress = await getProgress();
      maybeAct(() => setProgress(storedProgress));
    };
    loadProgress();
  }, []);

  /**
   * recordAttempt - saves a new attempt with optional time spent
   */
  const recordAttempt = async (
    pairId: string,
    isCorrect: boolean,
    durationMin = 0
  ): Promise<void> => {
    // pass all three arguments
    await saveAttempt(pairId, isCorrect, durationMin);
    const updatedProgress = await getProgress();
    maybeAct(() => setProgress(updatedProgress));
  };

  return (
    <PairProgressContext.Provider value={{ progress, recordAttempt }}>
      {children}
    </PairProgressContext.Provider>
  );
};

export const usePairProgress = () => useContext(PairProgressContext);

export { PairProgressContext };
