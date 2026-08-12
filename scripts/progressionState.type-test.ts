import {
  initialProgressionState,
  type ContrastPracticeState,
  type PracticeStateByContrast,
} from '@/src/domain/practice/progressionState';

const baselinePracticeState: ContrastPracticeState = {
  speedTier: 0,
  fastStreak: 0,
  longStreak: 0,
};

const practiceSessionState: PracticeStateByContrast = initialProgressionState();

const masteryDoesNotBelongInPracticeState: ContrastPracticeState = {
  ...baselinePracticeState,
  // @ts-expect-error Durable mastery is a separate domain concept.
  masteryTier: 1,
};

void practiceSessionState;
void masteryDoesNotBelongInPracticeState;
