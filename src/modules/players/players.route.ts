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
  getPlayerPhotoUrl,
} from "./player-photo.service.js";
import {
  uploadPaymentProof,
  deletePaymentProof,
} from "./payment-proof.service.js";
import z from "zod";

export async function playerRoutes(app: FastifyInstance) {

  // POST: Register player with photo and payment proof
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
    let paymentProofBuffer: Buffer | undefined;

    let uploadedPhoto:
      | Awaited<ReturnType<typeof uploadPlayerPhoto>>
      | undefined;

    let uploadedPaymentProof:
      | Awaited<ReturnType<typeof uploadPaymentProof>>
      | undefined;

    try {
      // 1. Read multipart fields and both images
      for await (const part of request.parts({
        limits: {
          files: 2,
          fields: 5,
          parts: 7,
        },
      })) {
        if (part.type === "file") {
          if (part.fieldname === "photo") {
            if (photoBuffer) {
              return reply.code(400).send({
                error: {
                  code: "MULTIPLE_PHOTOS",
                  message: "Only one player photo is allowed.",
                },
              });
            }

            photoBuffer = await part.toBuffer();
          } else if (part.fieldname === "paymentProof") {
            if (paymentProofBuffer) {
              return reply.code(400).send({
                error: {
                  code: "MULTIPLE_PAYMENT_PROOFS",
                  message: "Only one payment screenshot is allowed.",
                },
              });
            }

            paymentProofBuffer = await part.toBuffer();
          } else {
            return reply.code(400).send({
              error: {
                code: "INVALID_FILE_FIELD",
                message:
                  "Use 'photo' for the player photo and 'paymentProof' for the payment screenshot.",
              },
            });
          }
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

      // 3. Both images are mandatory
      if (!photoBuffer) {
        return reply.code(400).send({
          error: {
            code: "PHOTO_REQUIRED",
            message: "Please upload a player photo.",
          },
        });
      }

      if (!paymentProofBuffer) {
        return reply.code(400).send({
          error: {
            code: "PAYMENT_PROOF_REQUIRED",
            message: "Please upload your ₹50 payment screenshot.",
          },
        });
      }

      const playerData = parsedSchema.data;

      // 4. Upload player photo
      uploadedPhoto = await uploadPlayerPhoto(photoBuffer);

      // 5. Upload payment screenshot to private bucket
      uploadedPaymentProof = await uploadPaymentProof(
        // Temporary identifier is not needed here.
        // The service currently expects playerId, so see note below.
        playerData.phone,
        paymentProofBuffer,
      );

      // 6. Create player record
      const player = await prisma.player.create({
        data: {
          fullName: playerData.fullName,
          phone: playerData.phone,
          dob: new Date(`${playerData.dob}T00:00:00.000Z`),
          playingRole: playerData.playingRole,
          village: playerData.village,
          photoPath: uploadedPhoto.photoPath,
          paymentStatus: "NOT_REVIEWED",
          paymentProofPath: uploadedPaymentProof.proofPath,
          paymentSubmittedAt: new Date(),
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

      // 7. Return registered player
      return reply.code(201).send({
        message: "Player registered successfully. Payment is awaiting verification.",
        data: {
          ...player,
          dob: player.dob.toISOString().slice(0, 10),
          photoUrl: uploadedPhoto.photoUrl,
        },
      });

    } catch (error) {

      // 8. Clean up uploaded files if registration fails
      if (uploadedPaymentProof) {
        try {
          await deletePaymentProof(uploadedPaymentProof.proofPath);
        } catch (cleanupError) {
          app.log.error(
            { err: cleanupError },
            "Failed to clean up payment proof",
          );
        }
      }

      if (uploadedPhoto) {
        try {
          await deletePlayerPhoto(uploadedPhoto.photoPath);
        } catch (cleanupError) {
          app.log.error(
            { err: cleanupError },
            "Failed to clean up player photo",
          );
        }
      }

      // Multipart file size exceeded
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE"
      ) {
        return reply.code(413).send({
          error: {
            code: "FILE_TOO_LARGE",
            message: "Each image must be under 5 MB.",
          },
        });
      }

      // Image validation errors
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
            message: "Please upload a valid JPEG, PNG or WebP player photo under 5 MB.",
          },
        });
      }

      if (
        error instanceof Error &&
        [
          "EMPTY_PAYMENT_PROOF",
          "PAYMENT_PROOF_TOO_LARGE",
          "INVALID_PAYMENT_PROOF_TYPE",
        ].includes(error.message)
      ) {
        return reply.code(400).send({
          error: {
            code: error.message,
            message: "Please upload a valid JPEG, PNG or WebP payment screenshot under 5 MB.",
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
            photoPath: true,
            registrationStatus: true,
            createdAt: true,
          },
        }),
        prisma.player.count(),
      ]);

      return reply.code(200).send({
        data: players.map(({ photoPath, ...player }) => ({
          ...player,
          photoUrl: photoPath ? getPlayerPhotoUrl(photoPath) : null,
        })),
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