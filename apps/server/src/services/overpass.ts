import type { FastifyBaseLogger } from "fastify";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface RawStop {
  osmId: number;
  name: string;
  lat: number;
  lng: number;
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_TIMEOUT = 25; // seconds

/**
 * Fetch public-transport stops within `radiusM` metres of (lat, lng)
 * from the Overpass API.
 */
export async function fetchStopsFromOverpass(
  lat: number,
  lng: number,
  radiusM: number,
  log: FastifyBaseLogger,
): Promise<RawStop[]> {
  // Query:  bus_stop + tram_stop + public_transport stop_position within radius
  const query = `
[out:json][timeout:${OVERPASS_TIMEOUT}];
(
  node["highway"="bus_stop"](around:${radiusM},${lat},${lng});
  node["railway"="tram_stop"](around:${radiusM},${lat},${lng});
  node["public_transport"="stop_position"](around:${radiusM},${lat},${lng});
  node["public_transport"="platform"](around:${radiusM},${lat},${lng});
);
out center;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    log.error(`Overpass API error: ${res.status} ${res.statusText}`);
    throw new Error(`Overpass API returned ${res.status}`);
  }

  const json = (await res.json()) as { elements: OverpassElement[] };

  const stops: RawStop[] = [];
  for (const el of json.elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    const name = el.tags?.name;
    if (elLat == null || elLng == null || !name) continue;

    stops.push({ osmId: el.id, name, lat: elLat, lng: elLng });
  }

  log.info(`Overpass returned ${json.elements.length} elements → ${stops.length} named stops`);
  return stops;
}

/**
 * Deduplicate stops with the same name that are within `thresholdM` metres
 * of each other by averaging their coordinates into a single central point.
 */
/** Strip trailing platform suffixes: " 01", " 02", " (01)", " [A]" etc. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+\(?[0-9]+[a-z]?\)?$/i, "")  // "Teatr Słowackiego 01" → "teatr słowackiego"
    .replace(/[\s_-]+[a-z]$/i, "")                // "Rondo Mogilskie A" → "rondo mogilskie"
    .trim();
}

export function deduplicateStops(stops: RawStop[], thresholdM = 300): RawStop[] {
  const groups: Map<string, RawStop[]> = new Map();

  for (const stop of stops) {
    const key = normalizeName(stop.name);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, [stop]);
      continue;
    }

    // Check if this stop is close to any existing member of the group
    const isNearby = group.some((g) => haversineM(g.lat, g.lng, stop.lat, stop.lng) < thresholdM);
    if (isNearby) {
      group.push(stop);
    } else {
      // Same name but far away — treat as separate cluster
      // Use a unique key to split
      groups.set(`${key}__${stop.osmId}`, [stop]);
    }
  }

  const result: RawStop[] = [];
  for (const members of groups.values()) {
    const avgLat = members.reduce((s, m) => s + m.lat, 0) / members.length;
    const avgLng = members.reduce((s, m) => s + m.lng, 0) / members.length;
    // Use the shortest name as the canonical name (base name without platform suffix)
    const canonical = members.reduce((a, b) => (a.name.length <= b.name.length ? a : b));
    result.push({
      osmId: members[0].osmId,
      name: canonical.name,
      lat: avgLat,
      lng: avgLng,
    });
  }

  return result;
}

/** Haversine distance in metres between two lat/lng points. */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
