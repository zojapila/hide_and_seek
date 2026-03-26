import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { gameRoutes } from "./routes/games";

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: config.corsOrigins });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // Game routes
  await app.register(gameRoutes);

  return app;
}
