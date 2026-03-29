import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

export interface LatLng {
  latitude: number;
  longitude: number;
}

interface UseLocationResult {
  location: LatLng | null;
  error: string | null;
  permissionDenied: boolean;
}

const UPDATE_INTERVAL_MS = 4000; // ~4s between updates
const MIN_DISTANCE_M = 3; // minimum movement before update fires

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  const startWatching = useCallback(async (cancelled: { current: boolean }) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (!cancelled.current) {
        setPermissionDenied(true);
        setError("Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.");
      }
      return;
    }

    // Permission was granted — clear any previous denied state
    if (!cancelled.current) {
      setPermissionDenied(false);
      setError(null);
    }

    // Already watching — skip
    if (subRef.current) return;

    // Get initial location quickly
    try {
      const initial = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!cancelled.current) {
        setLocation({
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        });
      }
    } catch {
      // Non-critical — the watcher will provide the location
    }

    // Start watching
    try {
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: MIN_DISTANCE_M,
        },
        (pos) => {
          if (!cancelled.current) {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        },
      );
    } catch {
      if (!cancelled.current) {
        setPermissionDenied(true);
        setError(
          "Nie można śledzić lokalizacji. Sprawdź uprawnienia i ustawienia usług lokalizacyjnych.",
        );
      }
    }
  }, []);

  useEffect(() => {
    const cancelled = { current: false };

    startWatching(cancelled);

    // Re-check permissions when app returns to foreground (after visiting Settings)
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        startWatching(cancelled);
      }
    });

    return () => {
      cancelled.current = true;
      subscription.remove();
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [startWatching]);

  return { location, error, permissionDenied };
}
