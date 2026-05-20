-- Add Restaurant UPI ID (non-destructive).
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "upi_id" TEXT;

