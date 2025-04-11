// src/context/PairProgressContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import {
  saveAttempt,
  getProgress,
  PairStats,
} from '../storage/progressStorage';

const isTest = process.env.NODE_ENV === 'test';
const maybeAct = isTest
  ? require('react-test-renderer').act
  : (fn: () => void) => fn();

// Split context: one for progress, one for recordAttempt
const ProgressContext = createContext<Record<string, PairStats>>({});
const RecordAttemptContext = createContext<
  (pairId: string, isCorrect: boolean, durationMin?: number) => void
>(() => {});

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

  const recordAttempt = async (
    pairId: string,
    isCorrect: boolean,
    durationMin: number = 0
  ) => {
    await saveAttempt(pairId, isCorrect, durationMin);
    const updatedProgress = await getProgress();
    maybeAct(() => setProgress(updatedProgress));
  };

  return (
    <ProgressContext.Provider value={progress}>
      <RecordAttemptContext.Provider value={recordAttempt}>
        {children}
      </RecordAttemptContext.Provider>
    </ProgressContext.Provider>
  );
};

export const useProgress = () => useContext(ProgressContext);
export const useRecordAttempt = () => useContext(RecordAttemptContext);
