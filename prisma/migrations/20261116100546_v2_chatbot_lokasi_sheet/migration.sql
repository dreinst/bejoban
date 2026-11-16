-- AlterTable
ALTER TABLE "BotLog" ADD COLUMN "conversationId" INTEGER;

-- CreateTable
CREATE TABLE "BotConversation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channel" TEXT NOT NULL DEFAULT 'WA',
    "chatId" TEXT NOT NULL,
    "customer" TEXT NOT NULL DEFAULT '',
    "branchSlug" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BARU',
    "question" TEXT NOT NULL DEFAULT '',
    "sizes" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "mutedUntil" DATETIME,
    "closingPending" BOOLEAN NOT NULL DEFAULT false,
    "lastOutOfHoursAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServicePrice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    "ringMin" INTEGER,
    "ringMax" INTEGER,
    "minDiameter" INTEGER,
    "price" INTEGER,
    "unit" TEXT NOT NULL DEFAULT '',
    "altLabel" TEXT NOT NULL DEFAULT '',
    "altPrice" INTEGER,
    "note" TEXT NOT NULL DEFAULT '',
    "keywords" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GeoCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockTire" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupName" TEXT NOT NULL DEFAULT '',
    "ring" INTEGER NOT NULL DEFAULT 0,
    "sizeRaw" TEXT NOT NULL,
    "sizeNorm" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "price" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "discount" INTEGER NOT NULL DEFAULT 0,
    "priceIssue" TEXT NOT NULL DEFAULT '',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "lockManual" BOOLEAN NOT NULL DEFAULT true,
    "manualAt" DATETIME,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_StockTire" ("brand", "groupName", "id", "importedAt", "note", "price", "ring", "sizeNorm", "sizeRaw", "stock") SELECT "brand", "groupName", "id", "importedAt", "note", "price", "ring", "sizeNorm", "sizeRaw", "stock" FROM "StockTire";
DROP TABLE "StockTire";
ALTER TABLE "new_StockTire" RENAME TO "StockTire";
CREATE INDEX "StockTire_sizeNorm_idx" ON "StockTire"("sizeNorm");
CREATE INDEX "StockTire_ring_idx" ON "StockTire"("ring");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BotConversation_chatId_status_idx" ON "BotConversation"("chatId", "status");

-- CreateIndex
CREATE INDEX "BotConversation_status_idx" ON "BotConversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoCache_provider_query_key" ON "GeoCache"("provider", "query");
