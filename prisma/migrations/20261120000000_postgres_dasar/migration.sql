-- Migrasi dasar PostgreSQL, dibuat dari prisma/schema.prisma dengan `prisma migrate diff --from-empty`.
-- Menggantikan 8 migrasi SQLite lama (masih ada di riwayat git, lihat docs/POSTGRES.md).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Branch" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instagram" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "hours" TEXT NOT NULL DEFAULT '08.00 sampai 17.00',
    "mapsUrl" TEXT NOT NULL DEFAULT '',
    "photo" TEXT NOT NULL DEFAULT '',
    "services" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'BRANCH_ADMIN',
    "branchId" INTEGER,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "tipe" TEXT NOT NULL DEFAULT 'barang',
    "pakai_stok" BOOLEAN NOT NULL DEFAULT true,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,
    "by_order" BOOLEAN NOT NULL DEFAULT false,
    "aktif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "fitment" TEXT NOT NULL DEFAULT '',
    "images" TEXT NOT NULL DEFAULT '[]',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "kode" TEXT,
    "ukuran" TEXT,
    "harga_acuan" INTEGER,
    "barcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "comparePrice" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "flashSale" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "StockTire" (
    "id" SERIAL NOT NULL,
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
    "manualAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kode" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "cabang_id" INTEGER,

    CONSTRAINT "StockTire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" SERIAL NOT NULL,
    "carrier" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "perKg" INTEGER NOT NULL,
    "minWeight" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "etaDays" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotProcessed" (
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotProcessed_pkey" PRIMARY KEY ("messageId")
);

-- CreateTable
CREATE TABLE "BotLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT '',
    "input" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "handoff" BOOLEAN NOT NULL DEFAULT false,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL DEFAULT '',
    "conversationId" INTEGER,

    CONSTRAINT "BotLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotConversation" (
    "id" SERIAL NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WA',
    "chatId" TEXT NOT NULL,
    "customer" TEXT NOT NULL DEFAULT '',
    "branchSlug" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'BARU',
    "question" TEXT NOT NULL DEFAULT '',
    "sizes" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "mutedUntil" TIMESTAMP(3),
    "closingPending" BOOLEAN NOT NULL DEFAULT false,
    "lastOutOfHoursAt" TIMESTAMP(3),
    "awaitingBranch" BOOLEAN NOT NULL DEFAULT false,
    "pendingAction" TEXT NOT NULL DEFAULT '',
    "pendingText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePrice" (
    "id" SERIAL NOT NULL,
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
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoCache" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotBranchChoice" (
    "customer" TEXT NOT NULL,
    "branchSlug" TEXT NOT NULL,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotBranchChoice_pkey" PRIMARY KEY ("customer")
);

-- CreateTable
CREATE TABLE "WaClick" (
    "day" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WaClick_pkey" PRIMARY KEY ("day","branch")
);

-- CreateTable
CREATE TABLE "buku_stok" (
    "id" SERIAL NOT NULL,
    "tipe" TEXT NOT NULL,
    "perubahan" INTEGER NOT NULL,
    "saldo_akhir" INTEGER NOT NULL,
    "ref_id" TEXT,
    "batch_id" INTEGER,
    "cabang_id" INTEGER,
    "kode_produk" TEXT NOT NULL,
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pengguna" TEXT,

    CONSTRAINT "buku_stok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_aktivitas" (
    "id" SERIAL NOT NULL,
    "pengguna" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kalender" (
    "id" SERIAL NOT NULL,
    "tanggal" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "kalender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_kode_key" ON "Product"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_productId_branchId_key" ON "Listing"("productId", "branchId");

-- CreateIndex
CREATE INDEX "StockTire_cabang_id_idx" ON "StockTire"("cabang_id");

-- CreateIndex
CREATE INDEX "StockTire_sizeNorm_idx" ON "StockTire"("sizeNorm");

-- CreateIndex
CREATE INDEX "StockTire_ring_idx" ON "StockTire"("ring");

-- CreateIndex
CREATE UNIQUE INDEX "StockTire_kode_cabang_id_key" ON "StockTire"("kode", "cabang_id");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_carrier_city_key" ON "ShippingRate"("carrier", "city");

-- CreateIndex
CREATE INDEX "BotConversation_chatId_status_idx" ON "BotConversation"("chatId", "status");

-- CreateIndex
CREATE INDEX "BotConversation_status_idx" ON "BotConversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GeoCache_provider_query_key" ON "GeoCache"("provider", "query");

-- CreateIndex
CREATE INDEX "buku_stok_kode_produk_idx" ON "buku_stok"("kode_produk");

-- CreateIndex
CREATE INDEX "buku_stok_waktu_idx" ON "buku_stok"("waktu");

-- CreateIndex
CREATE INDEX "log_aktivitas_waktu_idx" ON "log_aktivitas"("waktu");

-- CreateIndex
CREATE INDEX "kalender_tanggal_idx" ON "kalender"("tanggal");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Kode unik untuk baris stok ban tanpa cabang. Indeks unik (kode, cabang_id) di atas tidak menjaganya,
-- karena PostgreSQL menganggap NULL selalu berbeda. Prisma belum bisa menuliskan indeks parsial di skema.
CREATE UNIQUE INDEX "StockTire_kode_tanpa_cabang_key" ON "StockTire"("kode") WHERE "cabang_id" IS NULL;
