// src/context/PairProgressContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  saveAttempt,
  getProgress,
  clearProgress,
  PairStats,
  PairAttempt,
} from '@/app/storage/progressStorage';

interface PairProgressContextType {
  progress: Record<string, PairStats>;
  recordAttempt: (pairId: string, isCorrect: boolean, durationMin?: number) => void;
  resetProgress: () => Promise<void>;
  isLoading: boolean;
}

const PairProgressContext = createContext<PairProgressContextType | undefined>(undefined);

export const PairProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    try {
      const storedProgress = await getProgress();
      setProgress(storedProgress);
    } catch (err) {
      console.error('Failed to load progress', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

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

  const resetProgress = useCallback(async () => {
    try {
      await clearProgress();
      setProgress({});
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }, []);

  const value = useMemo(
    () => ({
      progress,
      recordAttempt,
      resetProgress,
      isLoading,
    }),
    [progress, recordAttempt, resetProgress, isLoading]
  );

  return (
    <PairProgressContext.Provider value={value}>
      {children}
    </PairProgressContext.Provider>
  );
};

export const usePairProgress = () => {
  const context = useContext(PairProgressContext);
  if (context === undefined) {
    throw new Error('usePairProgress must be used within a PairProgressProvider');
  }
  return context;
};

// Deprecated hooks for backward compatibility (optional, but cleaner to update consumers)
export const useProgress = () => {
  const { progress } = usePairProgress();
  return progress;
};

export const useRecordAttempt = () => {
  const { recordAttempt } = usePairProgress();
  return recordAttempt;
};
