import { Platform } from "react-native";

// Android emulator uses 10.0.2.2, iOS simulator / device uses localhost
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
export const API_URL = __DEV__ ? `http://${DEV_HOST}:3000` : "https://api.hideseek.example.com";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? `Request failed: ${res.status}`);
  }

  return data as T;
}
