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
  getProgressPersistence,
  PairStats,
  PairAttempt,
} from '@/src/storage/progressStorage';

interface PairProgressContextType {
  progress: Record<string, PairStats>;
  recordAttempt: (pairId: string, isCorrect: boolean, durationMin?: number) => void;
  resetProgress: () => Promise<void>;
  isLoading: boolean;
  /** Whether attempt history is durable; see `getProgressPersistence`. */
  persistence: 'saved' | 'pending' | 'blocked';
  /** True when blocked or a write has failed and awaits retry. */
  saveNeedsAttention: boolean;
}

const PairProgressContext = createContext<PairProgressContextType | undefined>(undefined);

export const PairProgressProvider = ({ children }: { children: ReactNode }) => {
  const [progress, setProgress] = useState<Record<string, PairStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  // Mirrors the storage module's own state after every event; no single
  // write's outcome sets it, so an older success cannot hide newer unsaved work.
  const [saveState, setSaveState] = useState(getProgressPersistence);
  const syncSaveState = useCallback(() => {
    const next = getProgressPersistence();
    setSaveState((current) =>
      current.persistence === next.persistence &&
      current.needsAttention === next.needsAttention
        ? current
        : next
    );
  }, []);
  const loadFailed = useRef(false);
  // Bumped by a reset: a load issued before it must not put history back.
  const resetGeneration = useRef(0);

  const loadProgress = useCallback(async () => {
    const generation = resetGeneration.current;
    try {
      const storedProgress = await getProgress();
      loadFailed.current = false;
      if (generation === resetGeneration.current) setProgress(storedProgress);
    } catch (err) {
      loadFailed.current = true;
      console.error('Failed to load progress', err);
    } finally {
      syncSaveState();
      setIsLoading(false);
    }
  }, [syncSaveState]);

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
          syncSaveState();
          // Storage is readable again: show the history a failed load missed.
          if (loadFailed.current) void loadProgress();
        },
        (err) => {
          syncSaveState();
          console.error('Failed to save attempt', err);
        }
      );
      // The attempt is unsaved from this moment, not only once a write fails.
      syncSaveState();
    },
    [loadProgress, syncSaveState]
  );

  const resetProgress = useCallback(async () => {
    // Memory is cleared at the call, like storage's unsaved attempts, so an
    // attempt recorded while the removal is still queued is kept.
    resetGeneration.current += 1;
    setProgress({});
    const cleared = clearProgress();
    syncSaveState();
    try {
      await cleared;
    } catch (error) {
      // The reset stays pending in storage and is retried with the next write.
      console.error('Failed to reset progress:', error);
    }
    syncSaveState();
  }, [syncSaveState]);

  const value = useMemo(
    () => ({
      progress,
      recordAttempt,
      resetProgress,
      isLoading,
      persistence: saveState.persistence,
      saveNeedsAttention: saveState.needsAttention,
    }),
    [progress, recordAttempt, resetProgress, isLoading, saveState]
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
