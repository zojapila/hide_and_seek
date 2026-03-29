import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, afterEach } from "vitest";
import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { pool } from "../db/client";
import { gameRoutes } from "../routes/games";
import { registerGameHandlers } from "../handlers/game";
import { startHidingTimer, getTimerState, stopTimer } from "../services/timer";

type AppClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

// ─── Unit tests for timer service ───────────────────────────────────────────

describe("timer service (unit)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("getTimerState returns null when no timer running", () => {
    expect(getTimerState("nonexistent-game-id")).toBeNull();
  });

  it("getTimerState returns remaining time after start", () => {
    vi.useFakeTimers();

    // Create a minimal mock io
    const emittedEvents: Array<{ event: string; data: unknown }> = [];
    const mockIo = {
      to: () => ({
        emit: (event: string, data: unknown) => emittedEvents.push({ event, data }),
      }),
    } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;

    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

    startHidingTimer(mockIo, "game-abc", 5, mockLog);

    const state = getTimerState("game-abc");
    expect(state).not.toBeNull();
    expect(state!.phase).toBe("hiding");
    expect(state!.remainingMs).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(state!.remainingMs).toBeGreaterThan(0);

    stopTimer("game-abc");
  });

  it("emits timer:sync every second", () => {
    vi.useFakeTimers();

    const emitted: Array<{ event: string; data: unknown }> = [];
    const mockIo = {
      to: () => ({ emit: (event: string, data: unknown) => emitted.push({ event, data }) }),
    } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

    startHidingTimer(mockIo, "game-unit", 1, mockLog); // 1 minute

    vi.advanceTimersByTime(3100);

    const syncEvents = emitted.filter((e) => e.event === "timer:sync");
    expect(syncEvents.length).toBeGreaterThanOrEqual(3);
    expect((syncEvents[0].data as any).phase).toBe("hiding");

    stopTimer("game-unit");
  });

  it("stopTimer clears the timer", () => {
    vi.useFakeTimers();

    const emitted: Array<unknown> = [];
    const mockIo = {
      to: () => ({ emit: (_: string, d: unknown) => emitted.push(d) }),
    } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

    startHidingTimer(mockIo, "game-stop", 5, mockLog);
    stopTimer("game-stop");

    vi.advanceTimersByTime(10_000);
    expect(emitted).toHaveLength(0);
    expect(getTimerState("game-stop")).toBeNull();
  });

  it("remainingMs decreases over time", () => {
    vi.useFakeTimers();

    const mockIo = {
      to: () => ({ emit: () => {} }),
    } as unknown as Server<ClientToServerEvents, ServerToClientEvents>;
    const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

    startHidingTimer(mockIo, "game-decay", 5, mockLog);

    const before = getTimerState("game-decay")!.remainingMs;
    vi.advanceTimersByTime(10_000);
    const after = getTimerState("game-decay")!.remainingMs;

    expect(after).toBeLessThan(before);
    stopTimer("game-decay");
  });
});

// ─── Integration tests (real timers — no socket.io interference) ─────────────

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server<ClientToServerEvents, ServerToClientEvents>;
let port: number;
let app: ReturnType<typeof Fastify>;

function clientUrl() {
  return `http://localhost:${port}`;
}

function createClient(): AppClientSocket {
  return ioClient(clientUrl(), {
    autoConnect: false,
    transports: ["websocket"],
  }) as unknown as AppClientSocket;
}

function waitFor<T>(socket: AppClientSocket, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    (socket as any).once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function connectClient(client: AppClientSocket): Promise<void> {
  return new Promise((resolve) => {
    client.connect();
    client.once("connect", resolve);
  });
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(cors, { origin: "*" });
  await app.register(gameRoutes);
  await app.ready();

  httpServer = app.server;

  ioServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" },
  });

  ioServer.on("connection", (socket) => {
    registerGameHandlers(ioServer, socket, app.log);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => resolve());
  });

  port = (httpServer.address() as AddressInfo).port;
});

afterAll(async () => {
  ioServer.close();
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  await pool.query("DELETE FROM players");
  await pool.query("DELETE FROM stops");
  await pool.query("DELETE FROM games");
});

afterEach(() => {
  // Clean up any running timers from integration tests
  // (game IDs are different each test due to DB cleanup)
});

async function setupGame() {
  const gameRes = await app.inject({ method: "POST", url: "/games", payload: { hideTimeMinutes: 5 } });
  const game = gameRes.json() as { id: string; code: string };

  await app.inject({
    method: "POST",
    url: `/games/${game.code}/join`,
    payload: { name: "Creator", role: "hider" },
  });

  const client = createClient();
  await connectClient(client);

  await new Promise<void>((resolve) => {
    client.emit("game:join", { gameCode: game.code, playerName: "Creator" });
    setTimeout(resolve, 300);
  });

  return { game, client };
}

describe("timer integration: game:start", () => {
  it("emits timer:sync after game:start", async () => {
    const { game, client } = await setupGame();

    client.emit("game:start", { lat: 50.0614, lng: 19.9383 });

    const sync = await waitFor<{ phase: string; remainingMs: number }>(client, "timer:sync", 3000);

    expect(sync.phase).toBe("hiding");
    expect(sync.remainingMs).toBeGreaterThan(0);
    expect(sync.remainingMs).toBeLessThanOrEqual(5 * 60 * 1000);

    stopTimer(game.id);
    client.disconnect();
  });

  it("reconnecting client gets timer:sync on game:join", async () => {
    const { game, client } = await setupGame();

    client.emit("game:start", { lat: 50.0614, lng: 19.9383 });
    await waitFor(client, "timer:sync", 3000);

    // Second player joins mid-game
    await app.inject({
      method: "POST",
      url: `/games/${game.code}/join`,
      payload: { name: "Late", role: "seeker" },
    });

    const client2 = createClient();
    await connectClient(client2);

    const syncPromise = waitFor<{ phase: string; remainingMs: number }>(client2, "timer:sync", 2000);
    client2.emit("game:join", { gameCode: game.code, playerName: "Late" });
    const sync = await syncPromise;

    expect(sync.phase).toBe("hiding");
    expect(sync.remainingMs).toBeGreaterThan(0);

    stopTimer(game.id);
    client.disconnect();
    client2.disconnect();
  });
});

