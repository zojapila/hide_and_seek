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
