-- CreateTable
CREATE TABLE "StockTire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupName" TEXT NOT NULL DEFAULT '',
    "ring" INTEGER NOT NULL DEFAULT 0,
    "sizeRaw" TEXT NOT NULL,
    "sizeNorm" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "price" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "carrier" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "perKg" INTEGER NOT NULL,
    "minWeight" REAL NOT NULL DEFAULT 10,
    "etaDays" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BotProcessed" (
    "messageId" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BotLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "handoff" BOOLEAN NOT NULL DEFAULT false,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "StockTire_sizeNorm_idx" ON "StockTire"("sizeNorm");

-- CreateIndex
CREATE INDEX "StockTire_ring_idx" ON "StockTire"("ring");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_carrier_city_key" ON "ShippingRate"("carrier", "city");
