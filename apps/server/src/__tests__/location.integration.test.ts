import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { pool, query } from "../db/client";
import { gameRoutes } from "../routes/games";
import { registerGameHandlers } from "../handlers/game";

type AppClientSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

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
    httpServer.listen(0, () => {
      port = (httpServer.address() as AddressInfo).port;
      resolve();
    });
  });
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

// Helper: create a game + join a player via REST, return their socket connected to the room
async function setupPlayer(role: "hider" | "seeker", name: string, opts?: { gameCode?: string; otherClient?: AppClientSocket }) {
  let gameCode = opts?.gameCode;

  // Create game if not provided
  if (!gameCode) {
    const res = await app.inject({ method: "POST", url: "/games", payload: {} });
    gameCode = res.json().code;
  }

  // Join via REST
  const joinRes = await app.inject({
    method: "POST",
    url: `/games/${gameCode}/join`,
    payload: { name, role },
  });
  const player = joinRes.json();

  // Connect via Socket.IO
  const client = createClient();
  client.connect();

  // Wait for connection
  await new Promise<void>((resolve) => client.on("connect", resolve));

  // If there's already another client in the room, we can confirm join via their event
  let joinConfirmPromise: Promise<void> | undefined;
  if (opts?.otherClient) {
    joinConfirmPromise = new Promise<void>((resolve) => {
      (opts.otherClient as any).once("game:player_joined", () => resolve());
    });
  }

  // Emit game:join
  client.emit("game:join", { gameCode: gameCode!, playerName: name });

  if (joinConfirmPromise) {
    // Wait for the other client to confirm this player joined the room
    await joinConfirmPromise;
  } else {
    // First player — no one to confirm; wait a bit for async handler
    await new Promise((r) => setTimeout(r, 300));
  }

  return { client, player, gameCode: gameCode! };
}

describe("game:start", () => {
  it("transitions game from waiting to hiding", async () => {
    const { client: creator, gameCode } = await setupPlayer("hider", "Creator");
    const { client: joiner } = await setupPlayer("seeker", "Joiner", { gameCode, otherClient: creator });

    creator.emit("game:start", { lat: 50.0614, lng: 19.9383 });

    // Wait for the async handler to process
    await new Promise((r) => setTimeout(r, 500));

    // Verify DB was updated
    const dbResult = await query<{ status: string; started_at: string | null; center_lat: number | null }>(
      "SELECT status, started_at, ST_Y(center_point::geometry) as center_lat FROM games WHERE code = $1",
      [gameCode],
    );
    expect(dbResult.rows[0].status).toBe("hiding");
    expect(dbResult.rows[0].started_at).not.toBeNull();
    expect(dbResult.rows[0].center_lat).toBeCloseTo(50.0614, 4);

    creator.disconnect();
    joiner.disconnect();
  });

  it("does not start a game that is already hiding", async () => {
    const { client, gameCode } = await setupPlayer("hider", "Creator");

    // Manually set game to hiding
    await pool.query("UPDATE games SET status = 'hiding' WHERE code = $1", [gameCode]);

    // Try to start again — should not crash, just silently fail
    client.emit("game:start", { lat: 50.0, lng: 19.0 });
    await new Promise((r) => setTimeout(r, 200));

    const dbResult = await query<{ status: string; started_at: string | null }>(
      "SELECT status, started_at FROM games WHERE code = $1",
      [gameCode],
    );
    expect(dbResult.rows[0].status).toBe("hiding");

    client.disconnect();
  });

  it("does not allow non-creator to start the game", async () => {
    const { client: creator, gameCode } = await setupPlayer("hider", "Creator");
    const { client: joiner } = await setupPlayer("seeker", "Joiner", { gameCode, otherClient: creator });

    // Joiner (non-creator) tries to start
    joiner.emit("game:start", { lat: 50.0, lng: 19.0 });
    await new Promise((r) => setTimeout(r, 300));

    // Game should still be waiting
    const dbResult = await query<{ status: string }>(
      "SELECT status FROM games WHERE code = $1",
      [gameCode],
    );
    expect(dbResult.rows[0].status).toBe("waiting");

    creator.disconnect();
    joiner.disconnect();
  });
});

describe("location:update", () => {
  it("updates player location in the DB", async () => {
    const { client, player, gameCode } = await setupPlayer("seeker", "TestPlayer");

    // Set game to seeking phase
    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    client.emit("location:update", { lat: 50.0614, lng: 19.9383 });
    await new Promise((r) => setTimeout(r, 200));

    const result = await query<{ lat: number; lng: number }>(
      `SELECT ST_Y(current_location::geometry) as lat,
              ST_X(current_location::geometry) as lng
       FROM players WHERE id = $1`,
      [player.id],
    );
    expect(result.rows[0].lat).toBeCloseTo(50.0614, 4);
    expect(result.rows[0].lng).toBeCloseTo(19.9383, 4);

    client.disconnect();
  });

  it("broadcasts seeker locations to hiders", async () => {
    const { gameCode, client: hiderClient } = await setupPlayer("hider", "Hider");
    const { client: seekerClient } = await setupPlayer("seeker", "Seeker", { gameCode, otherClient: hiderClient });

    // Set game to seeking phase
    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    const locationPromise = waitFor<{
      players: { id: string; name: string; currentLocation: { lat: number; lng: number } }[];
    }>(hiderClient, "location:seekers");

    seekerClient.emit("location:update", { lat: 50.0614, lng: 19.9383 });

    const data = await locationPromise;
    expect(data.players).toHaveLength(1);
    expect(data.players[0].name).toBe("Seeker");
    expect(data.players[0].currentLocation.lat).toBeCloseTo(50.0614, 4);
    expect(data.players[0].currentLocation.lng).toBeCloseTo(19.9383, 4);

    hiderClient.disconnect();
    seekerClient.disconnect();
  });

  it("rejects invalid coordinates", async () => {
    const { client, player, gameCode } = await setupPlayer("seeker", "BadCoords");

    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    // Send invalid lat
    client.emit("location:update", { lat: 999, lng: 19 });
    await new Promise((r) => setTimeout(r, 200));

    const result = await query<{ current_location: string | null }>(
      "SELECT current_location FROM players WHERE id = $1",
      [player.id],
    );
    expect(result.rows[0].current_location).toBeNull();

    client.disconnect();
  });

  it("rejects NaN coordinates", async () => {
    const { client, player, gameCode } = await setupPlayer("seeker", "NaNCoords");

    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    client.emit("location:update", { lat: NaN, lng: 19 });
    await new Promise((r) => setTimeout(r, 200));

    const result = await query<{ current_location: string | null }>(
      "SELECT current_location FROM players WHERE id = $1",
      [player.id],
    );
    expect(result.rows[0].current_location).toBeNull();

    client.disconnect();
  });

  it("does not broadcast when hider sends location", async () => {
    const { gameCode, client: hiderClient } = await setupPlayer("hider", "HiderSender");
    const { client: seekerClient } = await setupPlayer("seeker", "SeekerWatcher", { gameCode, otherClient: hiderClient });

    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    let received = false;
    seekerClient.on("location:seekers", () => {
      received = true;
    });

    hiderClient.emit("location:update", { lat: 50.0614, lng: 19.9383 });
    await new Promise((r) => setTimeout(r, 300));

    expect(received).toBe(false);

    hiderClient.disconnect();
    seekerClient.disconnect();
  });

  it("does not broadcast seeker location during hiding phase", async () => {
    const { gameCode, client: hiderClient } = await setupPlayer("hider", "HiderWatch");
    const { client: seekerClient } = await setupPlayer("seeker", "SeekerHiding", { gameCode, otherClient: hiderClient });

    // Set game to hiding (not seeking)
    await pool.query("UPDATE games SET status = 'hiding' WHERE code = $1", [gameCode]);

    let received = false;
    hiderClient.on("location:seekers", () => {
      received = true;
    });

    seekerClient.emit("location:update", { lat: 50.0614, lng: 19.9383 });
    await new Promise((r) => setTimeout(r, 300));

    expect(received).toBe(false);

    hiderClient.disconnect();
    seekerClient.disconnect();
  });

  it("rejects location update in waiting phase", async () => {
    const { client, player, gameCode } = await setupPlayer("seeker", "WaitingPlayer");

    // Game is still in waiting phase (default after creation)
    client.emit("location:update", { lat: 50.0614, lng: 19.9383 });
    await new Promise((r) => setTimeout(r, 300));

    const result = await query<{ current_location: string | null }>(
      "SELECT current_location FROM players WHERE id = $1",
      [player.id],
    );
    expect(result.rows[0].current_location).toBeNull();

    client.disconnect();
  });

  it("rate-limits rapid location updates", async () => {
    const { client, player, gameCode } = await setupPlayer("seeker", "RateLimitPlayer");
    await pool.query("UPDATE games SET status = 'seeking' WHERE code = $1", [gameCode]);

    // First update should go through
    client.emit("location:update", { lat: 50.0, lng: 19.0 });
    await new Promise((r) => setTimeout(r, 200));

    // Second update immediately — should be rate-limited
    client.emit("location:update", { lat: 51.0, lng: 20.0 });
    await new Promise((r) => setTimeout(r, 200));

    const result = await query<{ lat: number; lng: number }>(
      `SELECT ST_Y(current_location::geometry) as lat,
              ST_X(current_location::geometry) as lng
       FROM players WHERE id = $1`,
      [player.id],
    );
    // Should still be the first coordinates (second was dropped)
    expect(result.rows[0].lat).toBeCloseTo(50.0, 4);
    expect(result.rows[0].lng).toBeCloseTo(19.0, 4);

    client.disconnect();
  });
});
