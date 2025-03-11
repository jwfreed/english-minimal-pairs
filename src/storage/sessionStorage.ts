// src/storage/sessionStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PairSession, PairSessionHistory } from './types';

const SESSION_HISTORY_KEY = '@pairsSessionHistory';

export async function loadSessionHistory(): Promise<PairSessionHistory> {
  try {
    const data = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading session history', error);
    return {};
  }
}

export async function saveSessionHistory(history: PairSessionHistory) {
  try {
    await AsyncStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving session history', error);
  }
}

/**
 * Appends a new session to the history for the given pair.
 */
export async function addPairSession(pairId: string, session: PairSession) {
  const history = await loadSessionHistory();
  const sessions = history[pairId] || [];
  sessions.push(session);
  history[pairId] = sessions;
  await saveSessionHistory(history);
}

/**
 * Get all sessions for a specific pair.
 */
export async function getPairSessions(pairId: string): Promise<PairSession[]> {
  const history = await loadSessionHistory();
  return history[pairId] || [];
}
