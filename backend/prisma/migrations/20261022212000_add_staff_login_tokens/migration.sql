-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_login_tokens" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'STAFF_LOGIN',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "staff_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_login_tokens_token_hash_key" ON "staff_login_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "staff_login_tokens_token_hash_idx" ON "staff_login_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "staff_login_tokens_staff_id_idx" ON "staff_login_tokens"("staff_id");
CREATE INDEX IF NOT EXISTS "staff_login_tokens_restaurant_id_idx" ON "staff_login_tokens"("restaurant_id");
CREATE INDEX IF NOT EXISTS "staff_login_tokens_expires_at_idx" ON "staff_login_tokens"("expires_at");

-- Safe Foreign Key Setup
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_login_tokens_staff_id_fkey') THEN
        BEGIN
            ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_login_tokens_restaurant_id_fkey') THEN
        BEGIN
            ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            BEGIN
                ALTER TABLE "staff_login_tokens" ADD CONSTRAINT "staff_login_tokens_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END;
    END IF;
END $$;
