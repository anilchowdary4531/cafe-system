-- AlterTable: Add failed login tracking and account lockout fields to users
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_failed_login_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

-- Ensure existing users have failed_login_attempts = 0, last_failed_login_at = null, locked_until = null
UPDATE "users"
SET "failed_login_attempts" = 0
WHERE "failed_login_attempts" IS NULL;
