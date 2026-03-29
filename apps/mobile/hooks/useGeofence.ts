import { useMemo } from "react";
import { useGameStore } from "../stores/gameStore";

/** Haversine distance in metres between two lat/lng points. */
function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeofenceWarning = "none" | "approaching" | "critical" | "outside";

const APPROACHING_THRESHOLD_M = 30;
const CRITICAL_THRESHOLD_M = 10;

interface GeofenceState {
  /** Distance from player to geofence edge. Positive = inside, negative = outside. */
  distanceToEdge: number | null;
  warning: GeofenceWarning;
}

export function useGeofence(): GeofenceState {
  const myLocation = useGameStore((s) => s.myLocation);
  const geofenceCenter = useGameStore((s) => s.geofenceCenter);
  const geofenceRadiusM = useGameStore((s) => s.geofenceRadiusM);

  return useMemo(() => {
    if (!myLocation || !geofenceCenter || !geofenceRadiusM) {
      return { distanceToEdge: null, warning: "none" as GeofenceWarning };
    }

    const distToCenter = haversineM(
      myLocation.latitude,
      myLocation.longitude,
      geofenceCenter.lat,
      geofenceCenter.lng,
    );

    // Positive = inside, negative = outside
    const distanceToEdge = geofenceRadiusM - distToCenter;

    let warning: GeofenceWarning = "none";
    if (distanceToEdge < 0) {
      warning = "outside";
    } else if (distanceToEdge < CRITICAL_THRESHOLD_M) {
      warning = "critical";
    } else if (distanceToEdge < APPROACHING_THRESHOLD_M) {
      warning = "approaching";
    }

    return { distanceToEdge, warning };
  }, [myLocation, geofenceCenter, geofenceRadiusM]);
}
