import "dotenv/config";

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`Environment variable ${name} is required in production`);
  }
  return value || "";
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl:
    process.env.DATABASE_URL ||
    (isProduction
      ? requireEnv("DATABASE_URL")
      : "postgresql://hideseek:hideseek@localhost:5432/hideseek"),
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || ["*"],
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || (isProduction ? requireEnv("MINIO_ENDPOINT") : "localhost"),
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY || (isProduction ? requireEnv("MINIO_ACCESS_KEY") : "minioadmin"),
    secretKey: process.env.MINIO_SECRET_KEY || (isProduction ? requireEnv("MINIO_SECRET_KEY") : "minioadmin"),
    bucket: process.env.MINIO_BUCKET || "hideseek-uploads",
  },
} as const;
