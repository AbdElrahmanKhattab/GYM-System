-- Resolve drift: move allow_multiple_checkins_per_day from attendance_rules to subscriptions
ALTER TABLE "attendance_rules" DROP COLUMN IF EXISTS "allow_multiple_checkins_per_day";
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "allow_multiple_checkins_per_day" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum: add self_checkin to AttendanceEntryMethod
ALTER TYPE "AttendanceEntryMethod" ADD VALUE IF NOT EXISTS 'self_checkin';

-- AlterTable: add PIN columns to members
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pin_hash" VARCHAR(255);
ALTER TABLE "members" ADD COLUMN IF NOT EXISTS "pin_set_at" TIMESTAMP(3);

-- CreateTable: member_sessions
CREATE TABLE IF NOT EXISTS "member_sessions" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "session_token" VARCHAR(64) NOT NULL,
    "device_label" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "member_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_sessions_session_token_key" ON "member_sessions"("session_token");
CREATE INDEX IF NOT EXISTS "member_sessions_member_id_idx" ON "member_sessions"("member_id");

-- AddForeignKey
ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: gym_checkin_config
CREATE TABLE IF NOT EXISTS "gym_checkin_config" (
    "id" UUID NOT NULL,
    "checkin_url" VARCHAR(500) NOT NULL,
    "qr_generated_at" TIMESTAMP(3),
    "is_self_checkin_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_user_id" UUID,

    CONSTRAINT "gym_checkin_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "gym_checkin_config" ADD CONSTRAINT "gym_checkin_config_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
