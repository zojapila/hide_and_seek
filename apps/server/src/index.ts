import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { config } from "./config";
import { testConnection, pool } from "./db/client";
import { gameRoutes } from "./routes/games";
import { registerGameHandlers } from "./handlers/game";

async function main() {
  const app = Fastify({ logger: true });

  // Verify DB connection before starting
  try {
    await testConnection();
    app.log.info("Database connection verified");
  } catch (err) {
    app.log.error("Failed to connect to database");
    throw err;
  }

  await app.register(cors, { origin: config.corsOrigins });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Game routes
  await app.register(gameRoutes);

  // Start HTTP server
  await app.listen({ port: config.port, host: config.host });

  // Socket.IO on top of Fastify's server
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: config.corsOrigins },
  });

  io.on("connection", (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);

    // Register handlers
    registerGameHandlers(io, socket, app.log);
  });

  // Graceful shutdown
  const shutdown = async () => {
    app.log.info("Shutting down...");
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  app.log.info(`Server running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
