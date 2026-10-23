-- AlterTable
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "table_id" INTEGER;
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "task_type" TEXT;
ALTER TABLE "staff_tasks" ADD COLUMN IF NOT EXISTS "requested_by_user_id" INTEGER;

-- AlterTable
ALTER TABLE "dining_tables" ADD COLUMN IF NOT EXISTS "cleaning_status" TEXT DEFAULT 'CLEAN';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "staff_tasks_restaurant_id_status_idx" ON "staff_tasks"("restaurant_id", "status");
CREATE INDEX IF NOT EXISTS "dining_tables_restaurant_id_cleaning_status_idx" ON "dining_tables"("restaurant_id", "cleaning_status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_tasks_table_id_fkey') THEN
    ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_tasks_requested_by_user_id_fkey') THEN
    ALTER TABLE "staff_tasks" ADD CONSTRAINT "staff_tasks_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
