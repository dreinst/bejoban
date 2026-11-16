-- Stok ban per cabang dan status by order merek. Hanya menambah kolom dan mengganti indeks, data tidak disalin ulang.
-- Baris StockTire yang sudah ada mendapat cabang_id NULL (tanpa cabang) sampai owner menetapkannya di halaman Stok ban.

-- Stok ban: kolom cabang, boleh kosong, tanpa relasi (seperti buku_stok.cabang_id).
ALTER TABLE "StockTire" ADD COLUMN "cabang_id" INTEGER;

-- Keunikan kode pindah dari kode saja ke gabungan kode dan cabang.
-- Indeks lama dihapus lebih dulu, lalu dua indeks baru dibuat. Isi tabel tidak berubah, dan semua kode lama
-- unik, jadi kedua indeks baru pasti bisa dibuat.
DROP INDEX "StockTire_kode_key";
CREATE UNIQUE INDEX "StockTire_kode_cabang_id_key" ON "StockTire"("kode", "cabang_id");
-- SQLite menganggap NULL selalu berbeda di indeks unik, jadi indeks di atas tidak mencegah dua baris tanpa cabang
-- dengan kode sama. Indeks parsial ini menjaganya. Prisma belum bisa menuliskan indeks parsial di schema.prisma,
-- jadi indeks ini hanya ada di sini (lihat docs/PENYELARASAN-BEJOSTOCK.md tentang drift).
CREATE UNIQUE INDEX "StockTire_kode_tanpa_cabang_key" ON "StockTire"("kode") WHERE "cabang_id" IS NULL;
CREATE INDEX "StockTire_cabang_id_idx" ON "StockTire"("cabang_id");

-- Merek: by order (tidak distok, dipesan dulu).
ALTER TABLE "Brand" ADD COLUMN "by_order" BOOLEAN NOT NULL DEFAULT false;
