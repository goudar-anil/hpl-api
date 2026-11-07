-- AlterTable
ALTER TABLE "player" ADD COLUMN     "payment_amount" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "payment_proof_path" TEXT,
ADD COLUMN     "payment_submitted_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_verified_at" TIMESTAMPTZ(6),
ALTER COLUMN "payment_status" SET DEFAULT 'NOT_SUBMITTED';

-- Allow NOT_SUBMITTED for new player registrations.
ALTER TABLE "public"."player"
DROP CONSTRAINT "player_payment_status_check";

ALTER TABLE "public"."player"
ADD CONSTRAINT "player_payment_status_check"
CHECK (
    "payment_status" IN (
        'NOT_SUBMITTED',
        'NOT_REVIEWED',
        'VERIFIED',
        'REJECTED',
        'NOT_REQUIRED'
    )
);
