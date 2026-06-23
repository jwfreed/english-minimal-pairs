import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';

interface PracticeTargetValue {
  /** Group the user asked to practice next, or null when none is pending. */
  targetGroup: string | null;
  /** Request that the Practice screen jump to this group. */
  requestPractice: (group: string) => void;
  /** Read and clear the pending target in one step. */
  consumeTarget: () => string | null;
}

const PracticeTargetContext = createContext<PracticeTargetValue | undefined>(
  undefined
);

export const PracticeTargetProvider = ({ children }: { children: ReactNode }) => {
  const [targetGroup, setTargetGroup] = useState<string | null>(null);
  // Mirror state in a ref so consumeTarget reads the latest value even when
  // called outside React's render cycle.
  const targetRef = useRef<string | null>(null);

  const requestPractice = useCallback((group: string) => {
    targetRef.current = group;
    setTargetGroup(group);
  }, []);

  const consumeTarget = useCallback(() => {
    const current = targetRef.current;
    targetRef.current = null;
    setTargetGroup(null);
    return current;
  }, []);

  return (
    <PracticeTargetContext.Provider
      value={{ targetGroup, requestPractice, consumeTarget }}
    >
      {children}
    </PracticeTargetContext.Provider>
  );
};

export const usePracticeTarget = () => {
  const ctx = useContext(PracticeTargetContext);
  if (!ctx)
    throw new Error(
      'usePracticeTarget must be used within a PracticeTargetProvider'
    );
  return ctx;
};
