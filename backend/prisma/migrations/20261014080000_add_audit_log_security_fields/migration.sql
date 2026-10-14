-- AlterTable: Add security audit logging fields to audit_logs
ALTER TABLE "audit_logs"
ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
ADD COLUMN IF NOT EXISTS "user_agent" TEXT,
ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT 'INFO',
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'SUCCESS';

-- Add index on (restaurant_id, action)
CREATE INDEX IF NOT EXISTS "audit_logs_restaurant_id_action_idx" ON "audit_logs"("restaurant_id", "action");
