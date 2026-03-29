import type { Server, Socket } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { query } from "../db/client";
import { startHidingTimer, getTimerState } from "../services/timer";
import { prefetchStops } from "../services/overpass";
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

    // If game is already in progress, send current timer state to the joining client
    if (game.status === "hiding" || game.status === "seeking") {
      const timerState = getTimerState(game.id);
      if (timerState) {
        socket.emit("timer:sync", timerState);
      }
    }

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
  socket.on("game:start", async (data) => {
    const sd = socket.data as SocketData;
    if (!sd?.gameId || !sd?.playerId) {
      log.warn(`Socket ${socket.id}: game:start without game or player context`);
      return;
    }

    const lat = data?.lat;
    const lng = data?.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      log.warn(`Socket ${socket.id}: game:start missing or invalid location`);
      return;
    }

    // Determine creator as first player created for this game
    const creatorResult = await query<{ id: string }>(
      "SELECT id FROM players WHERE game_id = $1 ORDER BY created_at ASC LIMIT 1",
      [sd.gameId],
    );
    if (creatorResult.rowCount === 0) {
      log.warn(`Socket ${socket.id}: game:start for game ${sd.gameId} with no players`);
      return;
    }

    const creatorId = creatorResult.rows[0].id;
    if (creatorId !== sd.playerId) {
      log.warn(
        `Socket ${socket.id}: unauthorized game:start by player ${sd.playerId} (creator is ${creatorId})`,
      );
      return;
    }

    // Atomically transition to hiding phase and set center_point
    const updateResult = await query<{ hide_time_minutes: number }>(
      `UPDATE games
       SET status = 'hiding',
           started_at = NOW(),
           center_point = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
       WHERE id = $1 AND status = 'waiting'
       RETURNING hide_time_minutes`,
      [sd.gameId, lng, lat],
    );

    if (updateResult.rowCount === 0) {
      log.warn(`Socket ${socket.id}: game:start on non-waiting or already-started game ${sd.gameId}`);
      return;
    }

    const { hide_time_minutes } = updateResult.rows[0];
    const room = `game:${sd.gameId}`;
    io.to(room).emit("game:phase_change", { status: "hiding" });
    log.info(`Game ${sd.gameId} started — phase: hiding`);

    // Start server-side countdown timer
    startHidingTimer(io, sd.gameId, hide_time_minutes, log);

    // Pre-fetch stops from Overpass so they're cached when clients request them
    prefetchStops(sd.gameId, lat, lng, log).catch((err) => {
      log.error(`Failed to pre-fetch stops for game ${sd.gameId}: ${err}`);
    });
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

    // If this is a seeker during seeking phase, broadcast their position to hiders
    if (sd.playerRole === "seeker" && status === "seeking") {
      const hidersRoom = `game:${sd.gameId}:hiders`;

      // Emit only this seeker's updated position
      io.to(hidersRoom).emit("location:seekers", {
        players: [
          {
            id: sd.playerId,
            name: sd.playerName!,
            currentLocation: { lat, lng },
          },
        ],
      });
    }
  });

  // ── game:choose_stop — hider selects a stop to hide at ──
  socket.on("game:choose_stop", async (data) => {
    const sd = socket.data as SocketData;
    if (!sd?.gameId || !sd?.playerId) {
      log.warn(`Socket ${socket.id}: game:choose_stop without game context`);
      return;
    }

    if (sd.playerRole !== "hider") {
      log.warn(`Socket ${socket.id}: game:choose_stop by non-hider`);
      return;
    }

    const stopId = data?.stopId;
    if (!stopId || typeof stopId !== "string") {
      log.warn(`Socket ${socket.id}: game:choose_stop invalid stopId`);
      return;
    }

    // Must be in hiding phase
    const gameResult = await query<{ status: string }>(
      "SELECT status FROM games WHERE id = $1",
      [sd.gameId],
    );
    if (gameResult.rows[0]?.status !== "hiding") {
      log.warn(`Socket ${socket.id}: game:choose_stop in phase "${gameResult.rows[0]?.status}"`);
      return;
    }

    // Stop must belong to this game
    const stopResult = await query<{ id: string; name: string }>(
      "SELECT id, name FROM stops WHERE id = $1 AND game_id = $2",
      [stopId, sd.gameId],
    );
    if (stopResult.rowCount === 0) {
      log.warn(`Socket ${socket.id}: game:choose_stop — stop ${stopId} not in game ${sd.gameId}`);
      return;
    }

    // Update player's chosen stop
    await query(
      "UPDATE players SET chosen_stop_id = $1 WHERE id = $2",
      [stopId, sd.playerId],
    );

    const room = `game:${sd.gameId}`;
    const stopName = stopResult.rows[0].name;

    // Notify all players in the game
    io.to(room).emit("game:stop_chosen", {
      playerId: sd.playerId,
      stopId,
      stopName,
    });

    log.info(`Player "${sd.playerName}" chose stop "${stopName}" in game ${sd.gameId}`);
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
