import fastify from "fastify";
import { config } from "./config/index.js";
import sqlClient from "./config/database.js";

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
    const result = await sqlClient`SELECT 1 AS connected`;

    return {
      status: "ok",
      database: result[0].connected === 1
        ? "connected"
        : "unknown",
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