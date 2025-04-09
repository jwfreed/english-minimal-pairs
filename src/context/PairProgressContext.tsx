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

const PairProgressContext = createContext<{
  progress: Record<string, PairStats>;
  recordAttempt: (pairId: string, isCorrect: boolean) => void;
}>({
  progress: {},
  recordAttempt: () => {},
});

export const PairProgressProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});

  useEffect(() => {
    const loadProgress = async () => {
      const storedProgress = await getProgress();
      maybeAct(() => setProgress(storedProgress));
    };
    loadProgress();
  }, []);

  const recordAttempt = async (pairId: string, isCorrect: boolean) => {
    await saveAttempt(pairId, isCorrect);
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
