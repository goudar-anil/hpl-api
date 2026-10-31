import {z} from "zod";

export const createPlayerSchema = z.object({
    fullName: z
    .string()
    .trim()
    .min(2, "Full Name must be atleast 2 characters")
    .max(100, "Fullname cannot exceed 100 characters"),

    phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must contain 10 digits"),

    dob: z
    .iso
    .date()
    .refine((date) => date <= new Date().toISOString().slice(0, 10), {
      message: "Date of birth cannot be in the future",
    }),

    playingRole: z.enum([
        "BATSMAN",
        "BOWLER",
        "ALL_ROUNDER",
        "WICKET_KEEPER",
    ]),

    village: z
    .string()
    .trim()
    .min(2, "Village must be at least 2 characters")
    .max(100, "Village cannot exceed 100 characters"),
}).strict();

export type CreatePlayerInput = z.infer<typeof createPlayerSchema>;