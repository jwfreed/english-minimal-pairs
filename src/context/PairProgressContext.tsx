import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { saveAttempt, getProgress } from '../storage/progressStorage';
import { PairStats, PairAttempt } from '../storage/types';

// Contexts for read-only progress and recording new attempts
const ProgressContext = createContext<Record<string, PairStats>>({});
const RecordAttemptContext = createContext<
  (pairId: string, isCorrect: boolean, durationMin?: number) => void
>(() => {});

export const PairProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});

  // Load existing progress on mount
  useEffect(() => {
    getProgress()
      .then((stored) => setProgress(stored))
      .catch((err) => console.error('Failed to load progress', err));
  }, []);

  // Optimistic update: immediately update UI, then persist in background
  const recordAttempt = useCallback(
    (pairId: string, isCorrect: boolean, durationMin: number = 0) => {
      const newAttempt: PairAttempt = {
        isCorrect,
        timestamp: Date.now(),
        durationMin,
      };

      // 1️⃣ Synchronous state update for instant UI feedback
      setProgress((prev) => {
        const prevStats = prev[pairId] || { attempts: [] };
        return {
          ...prev,
          [pairId]: {
            attempts: [...prevStats.attempts, newAttempt],
          },
        };
      });

      // 2️⃣ Persist to AsyncStorage (fire-and-forget)
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

// Hooks for consuming context values
export const useProgress = () => useContext(ProgressContext);
export const useRecordAttempt = () => useContext(RecordAttemptContext);
