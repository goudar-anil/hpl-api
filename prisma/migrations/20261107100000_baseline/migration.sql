-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."player" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "dob" DATE NOT NULL,
    "playing_role" VARCHAR(20) NOT NULL,
    "village" VARCHAR(100) NOT NULL,
    "registration_status" VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'NOT_REVIEWED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photo_path" TEXT,

    CONSTRAINT "player_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_phone_key" ON "public"."player"("phone" ASC);

-- Preserve custom constraints from the existing Supabase database.
ALTER TABLE "public"."player"
ADD CONSTRAINT "player_dob_check"
CHECK ("dob" <= CURRENT_DATE);

ALTER TABLE "public"."player"
ADD CONSTRAINT "player_playing_role_check"
CHECK ("playing_role" IN ('BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'));

ALTER TABLE "public"."player"
ADD CONSTRAINT "player_registration_status_check"
CHECK ("registration_status" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));

ALTER TABLE "public"."player"
ADD CONSTRAINT "player_payment_status_check"
CHECK ("payment_status" IN ('NOT_REVIEWED', 'VERIFIED', 'REJECTED', 'NOT_REQUIRED'));
