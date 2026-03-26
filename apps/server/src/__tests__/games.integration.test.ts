import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app";
import { pool } from "../db/client";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

beforeEach(async () => {
  // Clean up test data (players first due to FK)
  await pool.query("DELETE FROM players");
  await pool.query("DELETE FROM stops");
  await pool.query("DELETE FROM games");
});

describe("POST /games", () => {
  it("creates a game with default params", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/games",
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(body.status).toBe("waiting");
    expect(body.hideTimeMinutes).toBe(30);
    expect(body.geofenceRadiusM).toBe(200);
    expect(body.gameRadiusM).toBe(3000);
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
  });

  it("creates a game with custom params", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/games",
      payload: { hideTimeMinutes: 60, geofenceRadiusM: 300, gameRadiusM: 5000 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.hideTimeMinutes).toBe(60);
    expect(body.geofenceRadiusM).toBe(300);
    expect(body.gameRadiusM).toBe(5000);
  });

  it("rejects invalid params (hideTimeMinutes too low)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/games",
      payload: { hideTimeMinutes: 1 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("hideTimeMinutes");
  });

  it("generates unique codes", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: "POST", url: "/games", payload: {} });
      codes.add(res.json().code);
    }
    expect(codes.size).toBe(5);
  });
});

describe("POST /games/:code/join", () => {
  let gameCode: string;

  beforeEach(async () => {
    const res = await app.inject({ method: "POST", url: "/games", payload: {} });
    gameCode = res.json().code;
  });

  it("joins a player to a game", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Zosia", role: "hider" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe("Zosia");
    expect(body.role).toBe("hider");
    expect(body.gameId).toBeDefined();
    expect(body.id).toBeDefined();
  });

  it("allows multiple players with different names", async () => {
    await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Zosia", role: "hider" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Kacper", role: "seeker" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("Kacper");
  });

  it("rejects duplicate name in same game", async () => {
    await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Zosia", role: "hider" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Zosia", role: "seeker" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain("already taken");
  });

  it("handles case-insensitive game codes", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode.toLowerCase()}/join`,
      payload: { name: "Test", role: "seeker" },
    });

    expect(res.statusCode).toBe(201);
  });

  it("returns 404 for non-existent game", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/games/ZZZZZZ/join",
      payload: { name: "Test", role: "hider" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("rejects empty name", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "", role: "hider" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects invalid role", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/games/${gameCode}/join`,
      payload: { name: "Test", role: "wizard" },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /games/:code", () => {
  it("returns game with players", async () => {
    const createRes = await app.inject({ method: "POST", url: "/games", payload: {} });
    const code = createRes.json().code;

    await app.inject({
      method: "POST",
      url: `/games/${code}/join`,
      payload: { name: "Zosia", role: "hider" },
    });
    await app.inject({
      method: "POST",
      url: `/games/${code}/join`,
      payload: { name: "Kacper", role: "seeker" },
    });

    const res = await app.inject({ method: "GET", url: `/games/${code}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.code).toBe(code);
    expect(body.players).toHaveLength(2);
    expect(body.players[0].name).toBe("Zosia");
    expect(body.players[1].name).toBe("Kacper");
  });

  it("returns 404 for non-existent game", async () => {
    const res = await app.inject({ method: "GET", url: "/games/ZZZZZZ" });
    expect(res.statusCode).toBe(404);
  });

  it("returns empty players list for fresh game", async () => {
    const createRes = await app.inject({ method: "POST", url: "/games", payload: {} });
    const code = createRes.json().code;

    const res = await app.inject({ method: "GET", url: `/games/${code}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().players).toHaveLength(0);
  });
});
