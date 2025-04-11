import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
  const isMounted = useRef<boolean>(true);

  useEffect(() => {
    isMounted.current = true;
    const loadProgress = async () => {
      const storedProgress = await getProgress();
      if (isMounted.current) {
        maybeAct(() => setProgress(storedProgress));
      }
    };
    loadProgress();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const recordAttempt = useCallback(
    async (pairId: string, isCorrect: boolean, durationMin: number = 0) => {
      await saveAttempt(pairId, isCorrect, durationMin);
      const updatedProgress = await getProgress();
      if (isMounted.current) {
        maybeAct(() => setProgress(updatedProgress));
      }
    },
    []
  );

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
