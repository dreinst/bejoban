-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "kasir_aktif_sejak" TIMESTAMP(3),
ADD COLUMN     "kode_nota" TEXT,
ADD COLUMN     "mode_stok" TEXT NOT NULL DEFAULT 'sheet';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "batas_minimum" INTEGER;

-- AlterTable
ALTER TABLE "StockTire" ADD COLUMN     "batas_minimum" INTEGER;

-- CreateTable
CREATE TABLE "transaksi" (
    "id" SERIAL NOT NULL,
    "nomor" TEXT NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "nama_kasir" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "metode_bayar" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "diskon" INTEGER NOT NULL DEFAULT 0,
    "alasan_diskon" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL,
    "dibayar" INTEGER,
    "kembalian" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'selesai',
    "alasan_void" TEXT,
    "divoid_oleh" INTEGER,
    "waktu_void" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "waktu_transaksi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_transaksi" (
    "id" SERIAL NOT NULL,
    "transaksi_id" INTEGER NOT NULL,
    "sumber" TEXT NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "baris_id" INTEGER,
    "nama" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "harga_satuan" INTEGER NOT NULL,
    "harga_asli" INTEGER NOT NULL,
    "diskon" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "pengajuan_harga_id" INTEGER,

    CONSTRAINT "detail_transaksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_stok" (
    "id" SERIAL NOT NULL,
    "sumber" TEXT NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "baris_id" INTEGER NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "jenis" TEXT NOT NULL,
    "detail_barang_masuk_id" INTEGER,
    "harga_beli" INTEGER,
    "harga_jual" INTEGER NOT NULL,
    "jumlah_awal" INTEGER NOT NULL,
    "sisa" INTEGER NOT NULL,
    "tanggal_masuk" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "batch_stok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pengajuan_harga" (
    "id" SERIAL NOT NULL,
    "tipe" TEXT NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "sumber" TEXT,
    "kode_produk" TEXT,
    "pengaju_id" INTEGER NOT NULL,
    "harga_lama" INTEGER NOT NULL,
    "harga_baru" INTEGER NOT NULL,
    "alasan" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'menunggu',
    "penyetuju_id" INTEGER,
    "diputuskan" TIMESTAMP(3),
    "batch_id" INTEGER,
    "detail_transaksi_id" INTEGER,
    "transaksi_id" INTEGER,
    "dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pengajuan_harga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "riwayat_harga" (
    "id" SERIAL NOT NULL,
    "sumber" TEXT NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "harga_lama" INTEGER,
    "harga" INTEGER NOT NULL,
    "pengguna" TEXT,
    "berlaku_mulai" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "riwayat_harga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peringatan_stok" (
    "id" SERIAL NOT NULL,
    "sumber" TEXT NOT NULL,
    "baris_id" INTEGER NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "cabang_id" INTEGER,
    "jumlah_saat_itu" INTEGER NOT NULL,
    "batas_minimum" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ditutup" TIMESTAMP(3),

    CONSTRAINT "peringatan_stok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penghitung_nota" (
    "cabang_id" INTEGER NOT NULL,
    "tanggal" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "penghitung_nota_pkey" PRIMARY KEY ("cabang_id","tanggal")
);

-- CreateIndex
CREATE UNIQUE INDEX "transaksi_nomor_key" ON "transaksi"("nomor");

-- CreateIndex
CREATE UNIQUE INDEX "transaksi_idempotency_key_key" ON "transaksi"("idempotency_key");

-- CreateIndex
CREATE INDEX "transaksi_cabang_id_waktu_transaksi_idx" ON "transaksi"("cabang_id", "waktu_transaksi");

-- CreateIndex
CREATE INDEX "transaksi_waktu_transaksi_idx" ON "transaksi"("waktu_transaksi");

-- CreateIndex
CREATE INDEX "detail_transaksi_transaksi_id_idx" ON "detail_transaksi"("transaksi_id");

-- CreateIndex
CREATE INDEX "detail_transaksi_batch_id_idx" ON "detail_transaksi"("batch_id");

-- CreateIndex
CREATE INDEX "batch_stok_sumber_baris_id_tanggal_masuk_idx" ON "batch_stok"("sumber", "baris_id", "tanggal_masuk");

-- CreateIndex
CREATE INDEX "batch_stok_cabang_id_idx" ON "batch_stok"("cabang_id");

-- CreateIndex
CREATE INDEX "pengajuan_harga_status_dibuat_idx" ON "pengajuan_harga"("status", "dibuat");

-- CreateIndex
CREATE INDEX "pengajuan_harga_transaksi_id_idx" ON "pengajuan_harga"("transaksi_id");

-- CreateIndex
CREATE INDEX "riwayat_harga_sumber_kode_produk_cabang_id_idx" ON "riwayat_harga"("sumber", "kode_produk", "cabang_id");

-- CreateIndex
CREATE INDEX "peringatan_stok_status_idx" ON "peringatan_stok"("status");

-- CreateIndex
CREATE INDEX "peringatan_stok_sumber_baris_id_status_idx" ON "peringatan_stok"("sumber", "baris_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_kode_nota_key" ON "Branch"("kode_nota");

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_transaksi_id_fkey" FOREIGN KEY ("transaksi_id") REFERENCES "transaksi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_transaksi" ADD CONSTRAINT "detail_transaksi_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batch_stok"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ditulis manual: sisa batch tidak boleh negatif atau melebihi jumlah awal. Prisma tidak mengelola CHECK, jadi
-- migrasi berikutnya tidak akan menghapusnya.
ALTER TABLE "batch_stok" ADD CONSTRAINT "batch_stok_sisa_cek" CHECK ("sisa" >= 0 AND "sisa" <= "jumlah_awal");
