import type { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents, GameStatus } from "@hideseek/shared";
import { query } from "../db/client";
import type { FastifyBaseLogger } from "fastify";

interface TimerEntry {
  intervalId: ReturnType<typeof setInterval>;
  endsAt: number; // epoch ms
  phase: "hiding" | "seeking";
}

const activeTimers = new Map<string, TimerEntry>();

/**
 * Start the hiding-phase countdown for a game.
 * Emits `timer:sync` every second to the game room.
 * When time runs out, transitions the game to `seeking`.
 */
export function startHidingTimer(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gameId: string,
  hideTimeMinutes: number,
  log: FastifyBaseLogger,
): void {
  stopTimer(gameId); // safety: clear any existing timer

  const totalMs = hideTimeMinutes * 60 * 1000;
  const endsAt = Date.now() + totalMs;
  const room = `game:${gameId}`;

  const intervalId = setInterval(async () => {
    const remainingMs = Math.max(0, endsAt - Date.now());

    if (remainingMs <= 0) {
      stopTimer(gameId);
      try {
        await transitionToSeeking(io, gameId, log);
      } catch (err) {
        log.error(`Timer: failed to transition game ${gameId} to seeking: ${err}`);
      }
      return;
    }

    io.to(room).emit("timer:sync", { phase: "hiding", remainingMs });
  }, 1000);

  activeTimers.set(gameId, { intervalId, endsAt, phase: "hiding" });
  log.info(`Timer started for game ${gameId} — ${hideTimeMinutes} min hiding phase`);
}

/**
 * Returns current timer state for a game (for reconnecting clients).
 * Returns null if no timer is running.
 */
export function getTimerState(gameId: string): { phase: GameStatus; remainingMs: number } | null {
  const entry = activeTimers.get(gameId);
  if (!entry) return null;
  const remainingMs = Math.max(0, entry.endsAt - Date.now());
  return { phase: entry.phase, remainingMs };
}

export function stopTimer(gameId: string): void {
  const entry = activeTimers.get(gameId);
  if (entry) {
    clearInterval(entry.intervalId);
    activeTimers.delete(gameId);
  }
}

async function transitionToSeeking(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gameId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  // Auto-assign stops for hiders who didn't choose
  await autoAssignStops(io, gameId, log);

  const result = await query(
    `UPDATE games
     SET status = 'seeking', seeking_started_at = NOW()
     WHERE id = $1 AND status = 'hiding'`,
    [gameId],
  );

  if (result.rowCount === 0) {
    log.warn(`Timer: could not transition game ${gameId} to seeking (already done?)`);
    return;
  }

  const room = `game:${gameId}`;
  io.to(room).emit("game:phase_change", { status: "seeking" });
  io.to(room).emit("timer:sync", { phase: "seeking", remainingMs: 0 });
  log.info(`Game ${gameId} transitioned to seeking phase`);
}

/**
 * For each hider without a chosen stop, pick the closest stop
 * to their current location and assign it.
 */
async function autoAssignStops(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  gameId: string,
  log: FastifyBaseLogger,
): Promise<void> {
  // Get geofence radius from game config
  const gameResult = await query<{ geofence_radius_m: number }>(
    "SELECT geofence_radius_m FROM games WHERE id = $1",
    [gameId],
  );
  const geofenceRadiusM = gameResult.rows[0]?.geofence_radius_m ?? 200;

  // Find hiders who haven't chosen a stop
  const unchosenResult = await query<{ id: string; name: string; current_location: string | null }>(
    `SELECT id, name, ST_AsGeoJSON(current_location)::text AS current_location
     FROM players
     WHERE game_id = $1 AND role = 'hider' AND chosen_stop_id IS NULL`,
    [gameId],
  );

  if (unchosenResult.rowCount === 0) return;

  const room = `game:${gameId}`;

  for (const hider of unchosenResult.rows) {
    let stopId: string | null = null;
    let stopName: string | null = null;
    let stopLat: number | null = null;
    let stopLng: number | null = null;

    if (hider.current_location) {
      // Find nearest stop by distance
      const geo = JSON.parse(hider.current_location);
      const lng = geo.coordinates[0];
      const lat = geo.coordinates[1];

      const nearestResult = await query<{ id: string; name: string; lat: number; lng: number }>(
        `SELECT id, name,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lng
         FROM stops
         WHERE game_id = $1
         ORDER BY location <-> ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
         LIMIT 1`,
        [gameId, lng, lat],
      );

      if (nearestResult.rowCount! > 0) {
        const s = nearestResult.rows[0];
        stopId = s.id;
        stopName = s.name;
        stopLat = s.lat;
        stopLng = s.lng;
      }
    }

    if (!stopId) {
      // Fallback: pick a random stop in the game
      const randomResult = await query<{ id: string; name: string; lat: number; lng: number }>(
        `SELECT id, name,
                ST_Y(location::geometry) as lat,
                ST_X(location::geometry) as lng
         FROM stops WHERE game_id = $1 ORDER BY RANDOM() LIMIT 1`,
        [gameId],
      );
      if (randomResult.rowCount! > 0) {
        const s = randomResult.rows[0];
        stopId = s.id;
        stopName = s.name;
        stopLat = s.lat;
        stopLng = s.lng;
      }
    }

    if (stopId && stopName && stopLat != null && stopLng != null) {
      // Generate geofence polygon
      await query(
        `UPDATE stops SET geofence = ST_Buffer(location, $1)
         WHERE id = $2 AND geofence IS NULL`,
        [geofenceRadiusM, stopId],
      );

      await query("UPDATE players SET chosen_stop_id = $1 WHERE id = $2", [stopId, hider.id]);
      io.to(room).emit("game:stop_chosen", {
        playerId: hider.id,
        stopId,
        stopName,
        geofence: {
          center: { lat: stopLat, lng: stopLng },
          radiusM: geofenceRadiusM,
        },
      });
      log.info(`Auto-assigned stop "${stopName}" to hider "${hider.name}" in game ${gameId} (geofence ${geofenceRadiusM}m)`);
    }
  }
}
