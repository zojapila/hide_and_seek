import { Platform } from "react-native";

// For physical device testing: set EXPO_PUBLIC_API_URL in .env.local
// e.g. EXPO_PUBLIC_API_URL=http://172.20.10.3:3000
// Emulator fallbacks: Android=10.0.2.2, iOS simulator=localhost
const DEV_HOST = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const DEV_URL = `http://${DEV_HOST}:3000`;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? DEV_URL : "https://api.hideseek.example.com");

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
