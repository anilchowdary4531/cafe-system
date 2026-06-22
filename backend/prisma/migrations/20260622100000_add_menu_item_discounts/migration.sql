ALTER TABLE "menu_items"
ADD COLUMN IF NOT EXISTS "original_price" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "menu_items"
SET "original_price" = "price"
WHERE "original_price" IS NULL;
