import type { FastifyInstance } from "fastify";
import { query } from "../db/client";
import { generateUniqueCode } from "../utils/code";
import type { Game, Player, PlayerRole } from "@hideseek/shared";

// ── Row → domain mappers ──

interface GameRow {
  id: string;
  code: string;
  status: string;
  hide_time_minutes: number;
  geofence_radius_m: number;
  game_radius_m: number;
  started_at: string | null;
  seeking_started_at: string | null;
  finished_at: string | null;
  center_lat: number | null;
  center_lng: number | null;
  created_at: string;
}

interface PlayerRow {
  id: string;
  game_id: string;
  name: string;
  role: PlayerRole;
  current_location: string | null;
  chosen_stop_id: string | null;
  location_updated_at: string | null;
  created_at: string;
}

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    code: row.code,
    status: row.status as Game["status"],
    hideTimeMinutes: row.hide_time_minutes,
    geofenceRadiusM: row.geofence_radius_m,
    gameRadiusM: row.game_radius_m,
    startedAt: row.started_at,
    seekingStartedAt: row.seeking_started_at,
    finishedAt: row.finished_at,
    centerPoint:
      row.center_lat != null && row.center_lng != null
        ? { lat: row.center_lat, lng: row.center_lng }
        : null,
    createdAt: row.created_at,
  };
}

function toPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    gameId: row.game_id,
    name: row.name,
    role: row.role,
    currentLocation: null,
    chosenStopId: row.chosen_stop_id,
  };
}

// ── Validation ──

const VALID_ROLES: PlayerRole[] = ["hider", "seeker"];

function validateCreateGame(body: unknown): {
  hideTimeMinutes: number;
  geofenceRadiusM: number;
  gameRadiusM: number;
} {
  const b = body as Record<string, unknown>;
  const hideTimeMinutes = Number(b.hideTimeMinutes ?? 30);
  const geofenceRadiusM = Number(b.geofenceRadiusM ?? 200);
  const gameRadiusM = Number(b.gameRadiusM ?? 3000);

  if (hideTimeMinutes < 5 || hideTimeMinutes > 120) {
    throw { statusCode: 400, message: "hideTimeMinutes must be between 5 and 120" };
  }
  if (geofenceRadiusM < 50 || geofenceRadiusM > 1000) {
    throw { statusCode: 400, message: "geofenceRadiusM must be between 50 and 1000" };
  }
  if (gameRadiusM < 500 || gameRadiusM > 10000) {
    throw { statusCode: 400, message: "gameRadiusM must be between 500 and 10000" };
  }
  return { hideTimeMinutes, geofenceRadiusM, gameRadiusM };
}

function validateJoin(body: unknown): { name: string; role: PlayerRole } {
  const b = body as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const role = String(b.role ?? "") as PlayerRole;

  if (name.length < 1 || name.length > 50) {
    throw { statusCode: 400, message: "name must be between 1 and 50 characters" };
  }
  if (!VALID_ROLES.includes(role)) {
    throw { statusCode: 400, message: "role must be 'hider' or 'seeker'" };
  }
  return { name, role };
}

// ── Routes ──

export async function gameRoutes(app: FastifyInstance) {
  // POST /games — create a new game
  app.post("/games", async (request, reply) => {
    const params = validateCreateGame(request.body);
    const code = await generateUniqueCode();

    const result = await query<GameRow>(
      `INSERT INTO games (code, hide_time_minutes, geofence_radius_m, game_radius_m)
       VALUES ($1, $2, $3, $4)
       RETURNING *, ST_Y(center_point::geometry) as center_lat, ST_X(center_point::geometry) as center_lng`,
      [code, params.hideTimeMinutes, params.geofenceRadiusM, params.gameRadiusM],
    );

    return reply.code(201).send(toGame(result.rows[0]));
  });

  // POST /games/:code/join — join a game
  app.post<{ Params: { code: string } }>("/games/:code/join", async (request, reply) => {
    const code = request.params.code.toUpperCase();
    const { name, role } = validateJoin(request.body);

    // Find game
    const gameResult = await query<GameRow>(
      `SELECT *, ST_Y(center_point::geometry) as center_lat, ST_X(center_point::geometry) as center_lng
       FROM games WHERE code = $1`,
      [code],
    );
    if (gameResult.rowCount === 0) {
      return reply.code(404).send({ message: "Game not found" });
    }

    const game = gameResult.rows[0];
    if (game.status !== "waiting") {
      return reply.code(400).send({ message: "Game has already started" });
    }

    // Check duplicate name in this game
    const dup = await query("SELECT 1 FROM players WHERE game_id = $1 AND name = $2", [game.id, name]);
    if (dup.rowCount! > 0) {
      return reply.code(409).send({ message: "Name already taken in this game" });
    }

    const result = await query<PlayerRow>(
      `INSERT INTO players (game_id, name, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [game.id, name, role],
    );

    return reply.code(201).send(toPlayer(result.rows[0]));
  });

  // GET /games/:code — game state with players
  app.get<{ Params: { code: string } }>("/games/:code", async (request, reply) => {
    const code = request.params.code.toUpperCase();

    const gameResult = await query<GameRow>(
      `SELECT *, ST_Y(center_point::geometry) as center_lat, ST_X(center_point::geometry) as center_lng
       FROM games WHERE code = $1`,
      [code],
    );
    if (gameResult.rowCount === 0) {
      return reply.code(404).send({ message: "Game not found" });
    }

    const playersResult = await query<PlayerRow>(
      "SELECT * FROM players WHERE game_id = $1 ORDER BY created_at",
      [gameResult.rows[0].id],
    );

    return {
      ...toGame(gameResult.rows[0]),
      players: playersResult.rows.map(toPlayer),
    };
  });
}
