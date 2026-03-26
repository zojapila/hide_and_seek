import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "@hideseek/shared";
import "dotenv/config";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Start HTTP server
  await app.listen({ port: PORT, host: HOST });

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

  app.log.info(`Server running on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
