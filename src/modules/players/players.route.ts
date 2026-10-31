
import type { FastifyInstance } from "fastify";
import { Prisma } from "../../generated/prisma/client.js";
import prisma from "../../config/database.js";
import { createPlayerSchema } from "../../schema/player.schema.js";
import {
  VALIDATION_ERROR,
} from "../../const/constant.js";
import {
    INVALID_PAGINATION_DETAILS,
  INVALID_PLAYER_DETAILS,
} from "../../const/errorMessage.js";
import z from "zod";

export async function playerRoutes(app: FastifyInstance) {
  app.post("/api/v1/players", async (request, reply) => {
    // 1. Validate the incoming request
    const parsedSchema = createPlayerSchema.safeParse(request.body);

    if (!parsedSchema.success) {
      return reply.code(400).send({
        error: {
          code: VALIDATION_ERROR,
          message: INVALID_PLAYER_DETAILS,
          details: parsedSchema.error.issues,
        },
      });
    }

    const playerData = parsedSchema.data;

    try {
      // 2. Save the player using Prisma
      const player = await prisma.player.create({
        data: {
          fullName: playerData.fullName,
          phone: playerData.phone,
          dob: new Date(`${playerData.dob}T00:00:00.000Z`),
          playingRole: playerData.playingRole,
          village: playerData.village,
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          dob: true,
          playingRole: true,
          village: true,
          registrationStatus: true,
          paymentStatus: true,
          createdAt: true,
        },
      });

      // 3. Return the created player
      return reply.code(201).send({
        message: "Player registered successfully",
        data: {
          ...player,
          dob: player.dob.toISOString().slice(0, 10),
        },
      });
    } catch (error) {
      // 4. Handle duplicate phone numbers
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return reply.code(409).send({
          error: {
            code: "DUPLICATE_PHONE",
            message: "This phone number is already registered.",
          },
        });
      }

      // 5. Log unexpected errors without exposing database details
      app.log.error({ err: error }, "Player registration failed");

      return reply.code(500).send({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to register player at this time.",
        },
      });
    }
  });

  app.get('/api/v1/players', async(request, reply) => {
    const querySchema = z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(1000).default(100)
    }).strict();
    const parsedQuery = querySchema.safeParse(request.query);
    if (!parsedQuery.success) {
        return reply.code(400).send({
            error: {
                code: VALIDATION_ERROR,
                message: INVALID_PAGINATION_DETAILS,
                details: parsedQuery.error.issues
            }
        });
    }

    const {page, limit} = parsedQuery.data;
    const skip = (page - 1) * limit;

    try {
        const [players, total] = await prisma.$transaction([
        prisma.player.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            select: {
            id: true,
            fullName: true,
            playingRole: true,
            village: true,
            registrationStatus: true,
            createdAt: true,
            },
        }),
        prisma.player.count(),
        ]);

        return reply.code(200).send({
        data: players,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        });

    } catch (error) {
        app.log.error({ err: error }, "Failed to fetch players");

        return reply.code(500).send({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to fetch players at this time.",
        },
        });
    }
  });
}
