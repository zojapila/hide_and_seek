import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { query } from "../db/client";
import type { FastifyBaseLogger } from "fastify";

interface PlayerRow {
  id: string;
  game_id: string;
  name: string;
  role: string;
  chosen_stop_id: string | null;
}

interface SocketData {
  gameId?: string;
  playerId?: string;
  playerName?: string;
  playerRole?: "hider" | "seeker";
}

// Rate-limit map: playerId → last emit timestamp
const locationRateLimit = new Map<string, number>();
const LOCATION_MIN_INTERVAL_MS = 2_000;

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  log: FastifyBaseLogger,
) {
  socket.on("game:join", async (data) => {
    if (!data?.gameCode || !data?.playerName) {
      log.warn(`Socket ${socket.id}: invalid game:join payload`);
      return;
    }

    const code = data.gameCode.toUpperCase();

    // Find game
    const gameResult = await query<{ id: string; status: string }>(
      "SELECT id, status FROM games WHERE code = $1",
      [code],
    );
    if (gameResult.rowCount === 0) {
      log.warn(`Socket ${socket.id} tried to join non-existent game: ${code}`);
      return;
    }

    const game = gameResult.rows[0];

    // Find player by name in this game
    const playerResult = await query<PlayerRow>(
      "SELECT * FROM players WHERE game_id = $1 AND name = $2",
      [game.id, data.playerName],
    );
    if (playerResult.rowCount === 0) {
      log.warn(`Socket ${socket.id}: player "${data.playerName}" not found in game ${code}`);
      return;
    }

    const playerRow = playerResult.rows[0];
    const room = `game:${game.id}`;

    // Join the main room + role-specific room
    const roleRoom = `game:${game.id}:${playerRow.role}s`;
    await socket.join(room);
    await socket.join(roleRoom);

    // Store player info on socket for later use
    socket.data = {
      gameId: game.id,
      playerId: playerRow.id,
      playerName: playerRow.name,
      playerRole: playerRow.role as "hider" | "seeker",
    };

    log.info(`Player "${playerRow.name}" (${playerRow.role}) joined room ${room}`);

    // Notify other players in the room
    socket.to(room).emit("game:player_joined", {
      player: {
        id: playerRow.id,
        gameId: playerRow.game_id,
        name: playerRow.name,
        role: playerRow.role as "hider" | "seeker",
        currentLocation: null,
        chosenStopId: playerRow.chosen_stop_id,
      },
    });
  });

  // ── game:start — creator starts the game ──
  socket.on("game:start", async () => {
    const sd = socket.data as SocketData;
    if (!sd?.gameId) {
      log.warn(`Socket ${socket.id}: game:start without game context`);
      return;
    }

    // Verify the game is still waiting
    const gameResult = await query<{ id: string; status: string }>(
      "SELECT id, status FROM games WHERE id = $1",
      [sd.gameId],
    );
    if (gameResult.rowCount === 0 || gameResult.rows[0].status !== "waiting") {
      log.warn(`Socket ${socket.id}: game:start on non-waiting game`);
      return;
    }

    // Transition to hiding phase
    await query(
      "UPDATE games SET status = 'hiding', started_at = NOW() WHERE id = $1",
      [sd.gameId],
    );

    const room = `game:${sd.gameId}`;
    io.to(room).emit("game:phase_change", { status: "hiding" });
    log.info(`Game ${sd.gameId} started — phase: hiding`);
  });

  // ── location:update — player sends their GPS position ──
  socket.on("location:update", async (data) => {
    const sd = socket.data as SocketData;
    if (!sd?.gameId || !sd?.playerId) {
      log.warn(`Socket ${socket.id}: location:update without game context`);
      return;
    }

    const lat = data?.lat;
    const lng = data?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") {
      log.warn(`Socket ${socket.id}: location:update invalid types lat=${typeof lat} lng=${typeof lng}`);
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      log.warn(`Socket ${socket.id}: location:update NaN/Inf lat=${lat} lng=${lng}`);
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      log.warn(`Socket ${socket.id}: location:update out of bounds lat=${lat} lng=${lng}`);
      return;
    }

    // Rate limit: drop if too frequent
    const now = Date.now();
    const last = locationRateLimit.get(sd.playerId) ?? 0;
    if (now - last < LOCATION_MIN_INTERVAL_MS) return;
    locationRateLimit.set(sd.playerId, now);

    // Phase check: only accept during hiding or seeking
    const gameResult = await query<{ status: string }>(
      "SELECT status FROM games WHERE id = $1",
      [sd.gameId],
    );
    const status = gameResult.rows[0]?.status;
    if (status !== "hiding" && status !== "seeking") {
      log.warn(`Socket ${socket.id}: location:update in phase "${status}"`);
      return;
    }

    // Update DB
    await query(
      `UPDATE players
       SET current_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           location_updated_at = NOW()
       WHERE id = $3`,
      [lng, lat, sd.playerId],
    );

    // If this is a seeker, broadcast their position to hiders in the room
    if (sd.playerRole === "seeker") {
      // Gather all seekers' latest locations for this game
      const seekers = await query<{
        id: string;
        name: string;
        lat: number;
        lng: number;
      }>(
        `SELECT id, name,
                ST_Y(current_location::geometry) as lat,
                ST_X(current_location::geometry) as lng
         FROM players
         WHERE game_id = $1 AND role = 'seeker' AND current_location IS NOT NULL`,
        [sd.gameId],
      );

      const hidersRoom = `game:${sd.gameId}:hiders`;

      // Emit seeker positions only to hiders
      io.to(hidersRoom).emit("location:seekers", {
        players: seekers.rows.map((r) => ({
          id: r.id,
          name: r.name,
          currentLocation: { lat: r.lat, lng: r.lng },
        })),
      });
    }
  });

  socket.on("disconnect", () => {
    const sd = socket.data as SocketData;
    if (sd?.playerId) {
      locationRateLimit.delete(sd.playerId);
    }
    if (sd?.gameId) {
      socket.to(`game:${sd.gameId}`).emit("game:player_left", { playerId: sd.playerId! });
      log.info(`Player "${sd.playerName}" left room game:${sd.gameId}`);
    }
  });
}
