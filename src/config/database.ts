
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { config } from "./index.js";

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
});

const prisma = new PrismaClient({ adapter });

export default prisma;
