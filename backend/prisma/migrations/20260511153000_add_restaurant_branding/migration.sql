-- Add Restaurant branding fields (non-destructive).
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "brand_color" TEXT;
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "favicon_url" TEXT;

