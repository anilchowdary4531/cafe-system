-- AlterTable: Add temporary password lifecycle fields to users
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "temporary_password_expires_at" TIMESTAMP(3);

-- Ensure existing users have must_change_password = false and temporary_password_expires_at = null
UPDATE "users"
SET "must_change_password" = false
WHERE "must_change_password" IS NULL;
