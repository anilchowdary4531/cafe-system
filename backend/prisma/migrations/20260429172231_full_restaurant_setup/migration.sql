/*
  Warnings:

  - A unique constraint covering the columns `[restaurantId,tableNo]` on the table `DiningTable` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[restaurantId,orderNo]` on the table `Order` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DiningTable" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "orderType" TEXT NOT NULL DEFAULT 'DIRECT';

-- CreateTable
CREATE TABLE "TableSession" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "tableId" INTEGER NOT NULL,
    "openedByUserId" INTEGER,
    "guestCount" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serviceChargeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentMode" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableOrderItem" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "menuItemId" INTEGER,
    "itemName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSettings" (
    "id" SERIAL NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "directOrders" BOOLEAN NOT NULL DEFAULT true,
    "runningBills" BOOLEAN NOT NULL DEFAULT true,
    "qrOrdering" BOOLEAN NOT NULL DEFAULT true,
    "waiterOrdering" BOOLEAN NOT NULL DEFAULT true,
    "deliveryOrders" BOOLEAN NOT NULL DEFAULT false,
    "gstPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "servicePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "splitBillEnabled" BOOLEAN NOT NULL DEFAULT true,
    "roundOffEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tipsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "darkTheme" BOOLEAN NOT NULL DEFAULT true,
    "autoAcceptOrders" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseTableMins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableSession_restaurantId_status_idx" ON "TableSession"("restaurantId", "status");

-- CreateIndex
CREATE INDEX "TableSession_tableId_status_idx" ON "TableSession"("tableId", "status");

-- CreateIndex
CREATE INDEX "TableOrderItem_sessionId_createdAt_idx" ON "TableOrderItem"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSettings_restaurantId_key" ON "RestaurantSettings"("restaurantId");

-- CreateIndex
CREATE INDEX "DiningTable_restaurantId_status_idx" ON "DiningTable"("restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiningTable_restaurantId_tableNo_key" ON "DiningTable"("restaurantId", "tableNo");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_category_idx" ON "MenuItem"("restaurantId", "category");

-- CreateIndex
CREATE INDEX "MenuItem_restaurantId_isAvailable_idx" ON "MenuItem"("restaurantId", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_orderNo_key" ON "Order"("restaurantId", "orderNo");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Restaurant_slug_idx" ON "Restaurant"("slug");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrderItem" ADD CONSTRAINT "TableOrderItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableOrderItem" ADD CONSTRAINT "TableOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSettings" ADD CONSTRAINT "RestaurantSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
