import fastify from "fastify";
import { config } from "./config/index.js";
import prisma from "./config/database.js";
import { playerRoutes } from "./modules/players/players.route.js";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";

const app = fastify({
    logger: true
});

await app.register(cors, {
  origin: [
    "*",
    "*"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

await app.register(multipart, {
limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 1,                  // One photo per registration
    fields: 10,                // Maximum 10 text fields
  },
});
await app.register(playerRoutes);

app.get('/health', async () => {
    return {
        status: "ok",
        service: "hpl season 3 api server"
    }
});


app.get("/health/db", async (_request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ok",
      database: "connected",
    };
  } catch (error) {
    app.log.error({ err: error }, "Database health check failed");

    return reply.code(503).send({
      status: "error",
      database: "unavailable",
    });
  }
});


const start = async () => {
    try {
        await app.listen({
            port: config.port,
            host: config.host
        })
    } catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}

start();