-- CreateIndex
CREATE INDEX IF NOT EXISTS "payments_provider_order_id_idx" ON "payments"("provider_order_id");
CREATE INDEX IF NOT EXISTS "payments_provider_provider_order_id_idx" ON "payments"("provider", "provider_order_id");
