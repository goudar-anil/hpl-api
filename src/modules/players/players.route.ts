import { FastifyInstance } from "fastify";
import { createPlayerSchema } from "../../schema/player.schema.js";
import z from "zod";
import { VALIDATION_ERROR } from "../../const/constant.js";
import { INVALID_PLAYER_DETAILS } from "../../const/errorMessage.js";


export async function playerRoutes(app: FastifyInstance) {
    app.post('/api/v1/players', async (request, response) => {
        const parsedSchema = createPlayerSchema.safeParse(request.body);
        if (!parsedSchema.success) {
            return response.code(400).send({
                error: {
                    code: VALIDATION_ERROR,
                    message: INVALID_PLAYER_DETAILS,
                    details: z.treeifyError(parsedSchema.error)
                }
            })
        }
    });
}