// src/context/PairProgressContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { saveAttempt, getProgress } from '@/src/storage/progressStorage';
import { PairStats, PairAttempt } from '@/src/storage/types';

const ProgressContext = createContext<Record<string, PairStats>>({});
const RecordAttemptContext = createContext<
  (pairId: string, isCorrect: boolean, durationMin?: number) => void
>(() => {});

export const PairProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});

  useEffect(() => {
    getProgress()
      .then(setProgress)
      .catch((err) => console.error('Failed to load progress', err));
  }, []);

  const recordAttempt = useCallback(
    (pairId: string, isCorrect: boolean, durationMin: number = 0) => {
      const newAttempt: PairAttempt = {
        isCorrect,
        timestamp: Date.now(),
        durationMin,
      };

      setProgress((prev) => {
        const prevStats = prev[pairId] || { attempts: [] };
        return {
          ...prev,
          [pairId]: {
            attempts: [...prevStats.attempts, newAttempt],
          },
        };
      });

      saveAttempt(pairId, isCorrect, durationMin).catch((err) => {
        console.error('Failed to save attempt', err);
      });
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
