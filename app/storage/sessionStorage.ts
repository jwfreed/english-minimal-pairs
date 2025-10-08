import AsyncStorage from '@react-native-async-storage/async-storage';
import { PairSession, PairSessionHistory } from './types';

const SESSION_HISTORY_KEY = '@pairsSessionHistory';
// This key is used to store the session history in AsyncStorage.
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Initialize cachedHistory as an empty object
let cachedHistory: PairSessionHistory = {};

async function getSessionHistory(): Promise<PairSessionHistory> {
  // Optionally, you could check if the object is empty to load only once.
  // For example, using Object.keys(cachedHistory).length === 0 might be enough.
  try {
    const data = await AsyncStorage.getItem(SESSION_HISTORY_KEY);
    cachedHistory = data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading session history', error);
    // Leave cachedHistory as {}
  }
  return cachedHistory;
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      if (cachedHistory !== null) {
        await AsyncStorage.setItem(
          SESSION_HISTORY_KEY,
          JSON.stringify(cachedHistory)
        );
      }
    } catch (error) {
      console.error('Error saving session history', error);
    }
  }, 500);
}

export async function addPairSession(pairId: string, session: PairSession) {
  const history = await getSessionHistory();
  if (!history[pairId]) {
    history[pairId] = [];
  }
  history[pairId].push(session);
  scheduleSave();
}

export async function getPairSessions(pairId: string): Promise<PairSession[]> {
  const history = await getSessionHistory();
  return history[pairId] || [];
}

export async function clearSessionHistory() {
  cachedHistory = {};
  try {
    await AsyncStorage.removeItem(SESSION_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing session history', error);
  }
}
