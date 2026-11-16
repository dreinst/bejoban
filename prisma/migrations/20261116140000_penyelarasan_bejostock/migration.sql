-- Penyelarasan skema dengan BejoStock. Hanya menambah: tidak ada tabel atau kolom yang diganti nama atau dihapus.
-- Kolom baru memakai ALTER TABLE ADD COLUMN (nullable atau berdefault), jadi data lama tidak disalin ulang.
-- Kolom StockTire.kode diisi sesudahnya oleh scripts/isi-kode-stok.ts, atau otomatis saat impor pertama.

-- Kategori
ALTER TABLE "Category" ADD COLUMN "tipe" TEXT NOT NULL DEFAULT 'barang';
ALTER TABLE "Category" ADD COLUMN "pakai_stok" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN "aktif" BOOLEAN NOT NULL DEFAULT true;

-- Produk
ALTER TABLE "Product" ADD COLUMN "kode" TEXT;
ALTER TABLE "Product" ADD COLUMN "ukuran" TEXT;
ALTER TABLE "Product" ADD COLUMN "harga_acuan" INTEGER;
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;
CREATE UNIQUE INDEX "Product_kode_key" ON "Product"("kode");

-- Pengguna
ALTER TABLE "User" ADD COLUMN "aktif" BOOLEAN NOT NULL DEFAULT true;

-- Stok ban
ALTER TABLE "StockTire" ADD COLUMN "kode" TEXT;
ALTER TABLE "StockTire" ADD COLUMN "aktif" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "StockTire_kode_key" ON "StockTire"("kode");

-- Buku stok
CREATE TABLE "buku_stok" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tipe" TEXT NOT NULL,
    "perubahan" INTEGER NOT NULL,
    "saldo_akhir" INTEGER NOT NULL,
    "ref_id" TEXT,
    "batch_id" INTEGER,
    "cabang_id" INTEGER,
    "kode_produk" TEXT NOT NULL,
    "waktu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pengguna" TEXT
);
CREATE INDEX "buku_stok_kode_produk_idx" ON "buku_stok"("kode_produk");
CREATE INDEX "buku_stok_waktu_idx" ON "buku_stok"("waktu");

-- Log aktivitas
CREATE TABLE "log_aktivitas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pengguna" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "waktu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "log_aktivitas_waktu_idx" ON "log_aktivitas"("waktu");

-- Kalender libur dan promo
CREATE TABLE "kalender" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tanggal" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "keterangan" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX "kalender_tanggal_idx" ON "kalender"("tanggal");
