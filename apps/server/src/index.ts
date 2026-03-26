import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import { config } from "./config";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Start HTTP server
  await app.listen({ port: config.port, host: config.host });

  // Socket.IO on top of Fastify's server
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    app.log.info(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      app.log.info(`Socket disconnected: ${socket.id}`);
    });

    // TODO: register game, location, chat, curse, cards handlers
  });

  app.log.info(`Server running on http://${config.host}:${config.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
