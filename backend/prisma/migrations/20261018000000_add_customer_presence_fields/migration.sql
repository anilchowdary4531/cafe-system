-- AlterTable
ALTER TABLE "customer_accounts" ADD COLUMN IF NOT EXISTS "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_accounts_is_online_idx" ON "customer_accounts"("is_online");
