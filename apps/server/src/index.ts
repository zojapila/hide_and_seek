import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { config } from "./config";
import { testConnection, pool } from "./db/client";

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

  // Start HTTP server
  await app.listen({ port: config.port, host: config.host });

  // Socket.IO on top of Fastify's server
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: config.corsOrigins },
  });

  io.on("connection", (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });

    // TODO: register game, location, chat, curse, cards handlers
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
