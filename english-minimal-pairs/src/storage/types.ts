// types.ts
export interface PairSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  attempts: number;
  correct: number;
}

export interface PairSessionHistory {
  [pairId: string]: PairSession[]; // an array of sessions for each pair
}
