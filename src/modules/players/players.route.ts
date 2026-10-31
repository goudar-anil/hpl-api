
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
import {
  uploadPlayerPhoto,
  deletePlayerPhoto,
} from "./player-photo.service.js";
import z from "zod";

export async function playerRoutes(app: FastifyInstance) {

  // POST: Register player with photo
  app.post("/api/v1/players", async (request, reply) => {

    if (!request.isMultipart()) {
      return reply.code(415).send({
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Please submit player details as multipart form data.",
        },
      });
    }

    const fields: Record<string, string> = {};
    let photoBuffer: Buffer | undefined;

    try {
      // 1. Read multipart fields and photo
      for await (const part of request.parts()) {

        if (part.type === "file") {
          if (part.fieldname !== "photo") {
            return reply.code(400).send({
              error: {
                code: "INVALID_FILE_FIELD",
                message: "Please upload the image using the 'photo' field.",
              },
            });
          }

          if (photoBuffer) {
            return reply.code(400).send({
              error: {
                code: "MULTIPLE_PHOTOS",
                message: "Only one photo is allowed.",
              },
            });
          }

          photoBuffer = await part.toBuffer();

        } else {
          if (typeof part.value !== "string") {
            return reply.code(400).send({
              error: {
                code: "INVALID_FIELD",
                message: "Invalid registration field.",
              },
            });
          }

          fields[part.fieldname] = part.value;
        }
      }

      // 2. Validate player details
      const parsedSchema = createPlayerSchema.safeParse(fields);

      if (!parsedSchema.success) {
        return reply.code(400).send({
          error: {
            code: VALIDATION_ERROR,
            message: INVALID_PLAYER_DETAILS,
            details: parsedSchema.error.issues,
          },
        });
      }

      // 3. Photo is mandatory
      if (!photoBuffer) {
        return reply.code(400).send({
          error: {
            code: "PHOTO_REQUIRED",
            message: "Please upload a player photo.",
          },
        });
      }

      const playerData = parsedSchema.data;

      // 4. Upload photo to Supabase
      const uploadedPhoto = await uploadPlayerPhoto(photoBuffer);

      try {
        // 5. Save player details and photo path in PostgreSQL
        const player = await prisma.player.create({
          data: {
            fullName: playerData.fullName,
            phone: playerData.phone,
            dob: new Date(`${playerData.dob}T00:00:00.000Z`),
            playingRole: playerData.playingRole,
            village: playerData.village,
            photoPath: uploadedPhoto.photoPath,
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            dob: true,
            playingRole: true,
            village: true,
            photoPath: true,
            registrationStatus: true,
            paymentStatus: true,
            createdAt: true,
          },
        });

        // 6. Return the registered player
        return reply.code(201).send({
          message: "Player registered successfully",
          data: {
            ...player,
            dob: player.dob.toISOString().slice(0, 10),
            photoUrl: uploadedPhoto.photoUrl,
          },
        });

      } catch (dbError) {

        // 7. Remove uploaded photo if database insertion fails
        try {
          await deletePlayerPhoto(uploadedPhoto.photoPath);
        } catch (cleanupError) {
          app.log.error(
            { err: cleanupError, photoPath: uploadedPhoto.photoPath },
            "Failed to clean up uploaded player photo",
          );
        }

        throw dbError;
      }

    } catch (error) {

      // File size limit exceeded by Fastify multipart
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return reply.code(413).send({
          error: {
            code: "PHOTO_TOO_LARGE",
            message: "Photo size cannot exceed 5 MB.",
          },
        });
      }

      // Photo validation errors from upload service
      if (
        error instanceof Error &&
        [
          "EMPTY_PHOTO",
          "PHOTO_TOO_LARGE",
          "INVALID_PHOTO_TYPE",
        ].includes(error.message)
      ) {
        return reply.code(400).send({
          error: {
            code: error.message,
            message: "Please upload a valid JPEG, PNG or WebP photo under 5 MB.",
          },
        });
      }

      // Duplicate phone number
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

      app.log.error({ err: error }, "Player registration failed");

      return reply.code(500).send({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to register player at this time.",
        },
      });
    }
  });


  // GET: Fetch players with pagination
  app.get("/api/v1/players", async (request, reply) => {

    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(1000).default(100),
    }).strict();

    const parsedQuery = querySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.code(400).send({
        error: {
          code: VALIDATION_ERROR,
          message: INVALID_PAGINATION_DETAILS,
          details: parsedQuery.error.issues,
        },
      });
    }

    const { page, limit } = parsedQuery.data;
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
