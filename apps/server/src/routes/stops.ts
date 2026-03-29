import type { FastifyInstance } from "fastify";
import { query } from "../db/client";
import { fetchStopsFromOverpass, deduplicateStops } from "../services/overpass";
import type { Stop } from "@hideseek/shared";

interface StopRow {
  id: string;
  game_id: string;
  osm_id: string;
  name: string;
  lat: number;
  lng: number;
}

function toStop(row: StopRow): Stop {
  return {
    id: row.id,
    gameId: row.game_id,
    osmId: Number(row.osm_id),
    name: row.name,
    location: { lat: row.lat, lng: row.lng },
  };
}

export async function stopRoutes(app: FastifyInstance) {
  // GET /games/:code/stops — returns cached stops, or fetches from Overpass if none
  app.get<{ Params: { code: string } }>("/games/:code/stops", async (request, reply) => {
    const code = request.params.code.toUpperCase();

    // Find game
    const gameResult = await query<{
      id: string;
      status: string;
      game_radius_m: number;
      center_lat: number | null;
      center_lng: number | null;
    }>(
      `SELECT id, status, game_radius_m,
              ST_Y(center_point::geometry) as center_lat,
              ST_X(center_point::geometry) as center_lng
       FROM games WHERE code = $1`,
      [code],
    );
    if (gameResult.rowCount === 0) {
      return reply.code(404).send({ message: "Game not found" });
    }

    const game = gameResult.rows[0];

    // Check if stops are already cached
    const cached = await query<StopRow>(
      `SELECT id, game_id, osm_id, name,
              ST_Y(location::geometry) as lat,
              ST_X(location::geometry) as lng
       FROM stops WHERE game_id = $1
       ORDER BY name`,
      [game.id],
    );

    if (cached.rowCount! > 0) {
      return cached.rows.map(toStop);
    }

    // No cached stops — need center_point to fetch from Overpass
    if (game.center_lat == null || game.center_lng == null) {
      return reply.code(400).send({
        message: "Game has no center point yet. Start the game first.",
      });
    }

    // Fetch from Overpass
    const raw = await fetchStopsFromOverpass(
      game.center_lat,
      game.center_lng,
      game.game_radius_m,
      request.log,
    );

    // Deduplicate
    const deduped = deduplicateStops(raw);

    if (deduped.length === 0) {
      return [];
    }

    // Batch insert into DB (ON CONFLICT for race with prefetchStops)
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let idx = 1;
    for (const stop of deduped) {
      placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, ST_SetSRID(ST_MakePoint($${idx + 3}, $${idx + 4}), 4326)::geography)`);
      values.push(game.id, stop.osmId, stop.name, stop.lng, stop.lat);
      idx += 5;
    }

    await query(
      `INSERT INTO stops (game_id, osm_id, name, location)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (game_id, osm_id) DO NOTHING`,
      values,
    );

    // Re-read from cache to include rows inserted by prefetchStops
    const allStops = await query<StopRow>(
      `SELECT id, game_id, osm_id, name,
              ST_Y(location::geometry) as lat,
              ST_X(location::geometry) as lng
       FROM stops WHERE game_id = $1
       ORDER BY name`,
      [game.id],
    );

    request.log.info(`Cached ${allStops.rowCount} stops for game ${code}`);
    return allStops.rows.map(toStop);
  });
}
