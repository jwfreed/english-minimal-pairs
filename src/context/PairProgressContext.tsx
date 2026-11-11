import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import {
  appendAttempt,
  saveAttempt,
  getProgress,
  clearProgress,
  isMalformedProgressError,
  PairStats,
  PairAttempt,
} from '@/src/storage/progressStorage';

interface PairProgressContextType {
  progress: Record<string, PairStats>;
  recordAttempt: (pairId: string, isCorrect: boolean, durationMin?: number) => void;
  resetProgress: () => Promise<void>;
  isLoading: boolean;
  /**
   * Whether attempt history is durable: `saved`; `pending` — a write failed
   * and the attempts are kept for the next one; `blocked` — the stored
   * history could not be read (or is malformed) and is not written over.
   */
  persistence: 'saved' | 'pending' | 'blocked';
}

const PairProgressContext = createContext<PairProgressContextType | undefined>(undefined);

export const PairProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [persistence, setPersistence] =
    useState<PairProgressContextType['persistence']>('saved');
  const loadFailed = useRef(false);

  const loadProgress = useCallback(async () => {
    try {
      const storedProgress = await getProgress();
      loadFailed.current = false;
      setProgress(storedProgress);
    } catch (err) {
      loadFailed.current = true;
      setPersistence('blocked');
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
            // Same retention as storage, so a restart changes nothing.
            attempts: appendAttempt(prevStats.attempts, newAttempt),
          },
        };
      });

      saveAttempt(pairId, isCorrect, durationMin, newAttempt.timestamp).then(
        () => {
          setPersistence('saved');
          // Storage is readable again: show the history a failed load missed.
          if (loadFailed.current) void loadProgress();
        },
        (err) => {
          setPersistence(isMalformedProgressError(err) ? 'blocked' : 'pending');
          console.error('Failed to save attempt', err);
        }
      );
    },
    [loadProgress]
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
      persistence,
    }),
    [progress, recordAttempt, resetProgress, isLoading, persistence]
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
