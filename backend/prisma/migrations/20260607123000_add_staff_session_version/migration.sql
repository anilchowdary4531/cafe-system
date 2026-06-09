-- Track the latest active staff session so a new login invalidates old devices.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;
