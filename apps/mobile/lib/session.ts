import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "hideseek_session";

export interface Session {
  gameCode: string;
  playerId: string;
  playerName: string;
  playerRole: "hider" | "seeker";
}

export async function saveSession(session: Session): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as Session;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
