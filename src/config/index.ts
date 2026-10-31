import "dotenv/config";

function requiredEnv(name: string) : string {
    const value = process.env[name]?.trim();
    if(!value) {
        throw new Error(`Missing environment variabel: ${name}`);
    }
    return value;
}

function getPort(): number {
  const value = process.env.PORT?.trim() || "3000";
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return port;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: getPort(),
  host: process.env.HOST || "127.0.0.1",
  databaseUrl: requiredEnv("DATABASE_URL"),
} as const;
