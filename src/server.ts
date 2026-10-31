import fastify from "fastify";
import { config } from "./config/index.js";
import prisma from "./config/database.js";

const app = fastify({
    logger: true
});

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