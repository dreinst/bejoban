-- Perbaikan temuan audit kasir (K1). Hanya menambah kolom dan tabel, tidak mengubah yang sudah ada.

-- AlterTable
ALTER TABLE "transaksi" ADD COLUMN "sidik_isi" TEXT;

-- AlterTable
ALTER TABLE "barang_masuk" ADD COLUMN "sidik_isi" TEXT;

-- CreateTable
CREATE TABLE "kunci_ditutup" (
    "kunci" TEXT NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "dibuat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kunci_ditutup_pkey" PRIMARY KEY ("kunci")
);
