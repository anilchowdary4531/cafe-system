-- Generic OTP sessions for unified /auth endpoints (staff/owner/super_admin/customer).
-- Non-destructive: creates a new table without touching existing customer_otps.

CREATE TABLE IF NOT EXISTS "auth_otps" (
  "id" SERIAL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "otp_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_sent_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_otps_phone_actor_type_key" ON "auth_otps" ("phone", "actor_type");
CREATE INDEX IF NOT EXISTS "auth_otps_phone_actor_type_expires_at_idx" ON "auth_otps" ("phone", "actor_type", "expires_at");

