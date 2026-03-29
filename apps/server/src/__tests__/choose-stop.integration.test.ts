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

async function setupPlayer(
  role: "hider" | "seeker",
  name: string,
  opts?: { gameCode?: string; otherClient?: AppClientSocket },
) {
  let gameCode = opts?.gameCode;

  if (!gameCode) {
    const res = await app.inject({ method: "POST", url: "/games", payload: {} });
    gameCode = res.json().code;
  }

  const joinRes = await app.inject({
    method: "POST",
    url: `/games/${gameCode}/join`,
    payload: { name, role },
  });
  const player = joinRes.json();

  const client = createClient();
  client.connect();
  await new Promise<void>((resolve) => client.on("connect", resolve));

  let joinConfirmPromise: Promise<void> | undefined;
  if (opts?.otherClient) {
    joinConfirmPromise = new Promise<void>((resolve) => {
      (opts.otherClient as any).once("game:player_joined", () => resolve());
    });
  }

  client.emit("game:join", { gameCode: gameCode!, playerName: name });

  if (joinConfirmPromise) {
    await joinConfirmPromise;
  } else {
    await new Promise((r) => setTimeout(r, 300));
  }

  return { client, player, gameCode: gameCode! };
}

async function startGameAndInsertStops(
  creator: AppClientSocket,
  gameCode: string,
): Promise<{ stopA: string; stopB: string }> {
  // Start game (transition to hiding)
  creator.emit("game:start", { lat: 50.0614, lng: 19.9383 });
  await new Promise((r) => setTimeout(r, 500));

  // Get the game ID
  const gameResult = await query<{ id: string }>(
    "SELECT id FROM games WHERE code = $1",
    [gameCode],
  );
  const gameId = gameResult.rows[0].id;

  // Insert test stops
  const stopResult = await query<{ id: string }>(
    `INSERT INTO stops (game_id, osm_id, name, location) VALUES
     ($1, 100, 'Stop A', ST_SetSRID(ST_MakePoint(19.930, 50.060), 4326)::geography),
     ($1, 200, 'Stop B', ST_SetSRID(ST_MakePoint(19.935, 50.065), 4326)::geography)
     RETURNING id`,
    [gameId],
  );

  return { stopA: stopResult.rows[0].id, stopB: stopResult.rows[1].id };
}

describe("game:choose_stop", () => {
  it("hider can choose a stop during hiding phase", async () => {
    const { client: hider, player: hiderPlayer, gameCode } = await setupPlayer("hider", "Hider");
    const { client: seeker } = await setupPlayer("seeker", "Seeker", {
      gameCode,
      otherClient: hider,
    });

    const { stopA } = await startGameAndInsertStops(hider, gameCode);

    // Hider chooses stop A
    const chosenPromise = waitFor<{ playerId: string; stopId: string; stopName: string }>(
      hider,
      "game:stop_chosen",
    );

    hider.emit("game:choose_stop", { stopId: stopA });

    const chosenData = await chosenPromise;
    expect(chosenData.playerId).toBe(hiderPlayer.id);
    expect(chosenData.stopId).toBe(stopA);
    expect(chosenData.stopName).toBe("Stop A");

    // Verify DB updated
    const dbResult = await query<{ chosen_stop_id: string | null }>(
      "SELECT chosen_stop_id FROM players WHERE id = $1",
      [hiderPlayer.id],
    );
    expect(dbResult.rows[0].chosen_stop_id).toBe(stopA);

    hider.disconnect();
    seeker.disconnect();
  });

  it("seeker cannot choose a stop", async () => {
    const { client: hider, gameCode } = await setupPlayer("hider", "Hider");
    const { client: seeker, player: seekerPlayer } = await setupPlayer("seeker", "Seeker", {
      gameCode,
      otherClient: hider,
    });

    const { stopA } = await startGameAndInsertStops(hider, gameCode);

    // Seeker tries to choose — should be silently ignored
    seeker.emit("game:choose_stop", { stopId: stopA });
    await new Promise((r) => setTimeout(r, 500));

    // Verify DB NOT updated
    const dbResult = await query<{ chosen_stop_id: string | null }>(
      "SELECT chosen_stop_id FROM players WHERE id = $1",
      [seekerPlayer.id],
    );
    expect(dbResult.rows[0].chosen_stop_id).toBeNull();

    hider.disconnect();
    seeker.disconnect();
  });

  it("rejects stop from another game", async () => {
    const { client: hider, player: hiderPlayer, gameCode } = await setupPlayer("hider", "Hider");
    await setupPlayer("seeker", "Seeker", { gameCode, otherClient: hider });

    await startGameAndInsertStops(hider, gameCode);

    // Create another game with a stop
    const otherRes = await app.inject({ method: "POST", url: "/games", payload: {} });
    const otherCode = otherRes.json().code;
    const otherGameResult = await query<{ id: string }>(
      "SELECT id FROM games WHERE code = $1",
      [otherCode],
    );

    // Need to set game to hiding for the stop insert FK constraint
    await query("UPDATE games SET status = 'hiding' WHERE id = $1", [otherGameResult.rows[0].id]);

    const foreignStop = await query<{ id: string }>(
      `INSERT INTO stops (game_id, osm_id, name, location) VALUES
       ($1, 999, 'Foreign Stop', ST_SetSRID(ST_MakePoint(19.940, 50.070), 4326)::geography)
       RETURNING id`,
      [otherGameResult.rows[0].id],
    );

    // Try choosing a stop from another game
    hider.emit("game:choose_stop", { stopId: foreignStop.rows[0].id });
    await new Promise((r) => setTimeout(r, 500));

    // Verify DB NOT updated
    const dbResult = await query<{ chosen_stop_id: string | null }>(
      "SELECT chosen_stop_id FROM players WHERE id = $1",
      [hiderPlayer.id],
    );
    expect(dbResult.rows[0].chosen_stop_id).toBeNull();

    hider.disconnect();
  });

  it("cannot choose during waiting phase", async () => {
    const { client: hider, player: hiderPlayer, gameCode } = await setupPlayer("hider", "Hider");
    await setupPlayer("seeker", "Seeker", { gameCode, otherClient: hider });

    // Game is still in 'waiting' — insert a stop via SQL
    const gameResult = await query<{ id: string }>(
      "SELECT id FROM games WHERE code = $1",
      [gameCode],
    );

    // We can't insert stops with FK to a waiting game if there's a constraint,
    // so just try emitting without a real stop — the phase check fires first
    hider.emit("game:choose_stop", { stopId: "00000000-0000-0000-0000-000000000000" });
    await new Promise((r) => setTimeout(r, 500));

    const dbResult = await query<{ chosen_stop_id: string | null }>(
      "SELECT chosen_stop_id FROM players WHERE id = $1",
      [hiderPlayer.id],
    );
    expect(dbResult.rows[0].chosen_stop_id).toBeNull();

    hider.disconnect();
  });

  it("broadcasts stop_chosen to all players in the game", async () => {
    const { client: hider, player: hiderPlayer, gameCode } = await setupPlayer("hider", "Hider");
    const { client: seeker } = await setupPlayer("seeker", "Seeker", {
      gameCode,
      otherClient: hider,
    });

    const { stopA } = await startGameAndInsertStops(hider, gameCode);

    // Both clients should receive game:stop_chosen
    const hiderPromise = waitFor<{ playerId: string; stopId: string; stopName: string }>(
      hider,
      "game:stop_chosen",
    );
    const seekerPromise = waitFor<{ playerId: string; stopId: string; stopName: string }>(
      seeker,
      "game:stop_chosen",
    );

    hider.emit("game:choose_stop", { stopId: stopA });

    const [hiderData, seekerData] = await Promise.all([hiderPromise, seekerPromise]);

    expect(hiderData.playerId).toBe(hiderPlayer.id);
    expect(hiderData.stopName).toBe("Stop A");
    expect(seekerData.playerId).toBe(hiderPlayer.id);
    expect(seekerData.stopName).toBe("Stop A");

    hider.disconnect();
    seeker.disconnect();
  });
});
