import { useEffect, useState, useRef } from "react";
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!cancelled) {
          setPermissionDenied(true);
          setError("Brak dostępu do lokalizacji. Włącz uprawnienia w ustawieniach.");
        }
        return;
      }

      // Get initial location quickly
      try {
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setLocation({
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
          });
        }
      } catch {
        // Non-critical — the watcher will provide the location
      }

      // Start watching
      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: UPDATE_INTERVAL_MS,
          distanceInterval: MIN_DISTANCE_M,
        },
        (pos) => {
          if (!cancelled) {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
        },
      );
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
    };
  }, []);

  return { location, error, permissionDenied };
}
