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

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  log: FastifyBaseLogger,
) {
  socket.on("game:join", async (data) => {
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

    // Join the Socket.IO room
    await socket.join(room);

    // Store player info on socket for later use
    socket.data = { gameId: game.id, playerId: playerRow.id, playerName: playerRow.name };

    log.info(`Player "${playerRow.name}" joined room ${room}`);

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

  socket.on("disconnect", () => {
    const data = socket.data as { gameId?: string; playerId?: string; playerName?: string } | undefined;
    if (data?.gameId) {
      socket.to(`game:${data.gameId}`).emit("game:player_left", { playerId: data.playerId! });
      log.info(`Player "${data.playerName}" left room game:${data.gameId}`);
    }
  });
}
