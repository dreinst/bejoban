-- CreateTable
CREATE TABLE "BotBranchChoice" (
    "customer" TEXT NOT NULL PRIMARY KEY,
    "branchSlug" TEXT NOT NULL,
    "chosenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WaClick" (
    "day" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("day", "branch")
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BotConversation" (
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
    "awaitingBranch" BOOLEAN NOT NULL DEFAULT false,
    "pendingAction" TEXT NOT NULL DEFAULT '',
    "pendingText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BotConversation" ("branchSlug", "channel", "chatId", "closingPending", "createdAt", "customer", "id", "lastOutOfHoursAt", "mutedUntil", "question", "result", "sizes", "status", "updatedAt") SELECT "branchSlug", "channel", "chatId", "closingPending", "createdAt", "customer", "id", "lastOutOfHoursAt", "mutedUntil", "question", "result", "sizes", "status", "updatedAt" FROM "BotConversation";
DROP TABLE "BotConversation";
ALTER TABLE "new_BotConversation" RENAME TO "BotConversation";
CREATE INDEX "BotConversation_chatId_status_idx" ON "BotConversation"("chatId", "status");
CREATE INDEX "BotConversation_status_idx" ON "BotConversation"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
