-- CreateTable
CREATE TABLE "barang_masuk" (
    "id" SERIAL NOT NULL,
    "nomor_penerimaan" TEXT NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "pemasok" TEXT NOT NULL,
    "jenis_pemasok" TEXT NOT NULL,
    "tanggal_pesan" TIMESTAMP(3),
    "tanggal_terima" TIMESTAMP(3) NOT NULL,
    "pengguna_id" INTEGER NOT NULL,
    "nama_pengguna" TEXT NOT NULL,
    "catatan" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT NOT NULL,
    "dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barang_masuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_barang_masuk" (
    "id" SERIAL NOT NULL,
    "barang_masuk_id" INTEGER NOT NULL,
    "sumber" TEXT NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "baris_id" INTEGER NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "harga_beli" INTEGER,
    "harga_jual" INTEGER NOT NULL,
    "harga_lama" INTEGER NOT NULL,
    "batch_id" INTEGER,
    "pengajuan_harga_id" INTEGER,

    CONSTRAINT "detail_barang_masuk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penghitung_penerimaan" (
    "cabang_id" INTEGER NOT NULL,
    "tanggal" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "penghitung_penerimaan_pkey" PRIMARY KEY ("cabang_id","tanggal")
);

-- CreateTable
CREATE TABLE "stok_opname" (
    "id" SERIAL NOT NULL,
    "cabang_id" INTEGER NOT NULL,
    "penginput_id" INTEGER NOT NULL,
    "nama_penginput" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "tanggal" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "catatan" TEXT NOT NULL DEFAULT '',
    "dikirim" TIMESTAMP(3),
    "finalisator_id" INTEGER,
    "difinalkan" TIMESTAMP(3),

    CONSTRAINT "stok_opname_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detail_opname" (
    "id" SERIAL NOT NULL,
    "opname_id" INTEGER NOT NULL,
    "sumber" TEXT NOT NULL,
    "kode_produk" TEXT NOT NULL,
    "baris_id" INTEGER NOT NULL,
    "nama" TEXT NOT NULL,
    "stok_sistem" INTEGER NOT NULL,
    "stok_fisik" INTEGER NOT NULL,
    "selisih" INTEGER NOT NULL,
    "alasan_selisih" TEXT NOT NULL DEFAULT '',
    "diisi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stok_saat_final" INTEGER,
    "stok_akhir" INTEGER,

    CONSTRAINT "detail_opname_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barang_masuk_nomor_penerimaan_key" ON "barang_masuk"("nomor_penerimaan");

-- CreateIndex
CREATE UNIQUE INDEX "barang_masuk_idempotency_key_key" ON "barang_masuk"("idempotency_key");

-- CreateIndex
CREATE INDEX "barang_masuk_cabang_id_tanggal_terima_idx" ON "barang_masuk"("cabang_id", "tanggal_terima");

-- CreateIndex
CREATE INDEX "barang_masuk_tanggal_terima_idx" ON "barang_masuk"("tanggal_terima");

-- CreateIndex
CREATE INDEX "detail_barang_masuk_barang_masuk_id_idx" ON "detail_barang_masuk"("barang_masuk_id");

-- CreateIndex
CREATE INDEX "detail_barang_masuk_sumber_baris_id_idx" ON "detail_barang_masuk"("sumber", "baris_id");

-- CreateIndex
CREATE INDEX "stok_opname_cabang_id_status_idx" ON "stok_opname"("cabang_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "detail_opname_opname_id_sumber_baris_id_key" ON "detail_opname"("opname_id", "sumber", "baris_id");

-- AddForeignKey
ALTER TABLE "detail_barang_masuk" ADD CONSTRAINT "detail_barang_masuk_barang_masuk_id_fkey" FOREIGN KEY ("barang_masuk_id") REFERENCES "barang_masuk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detail_opname" ADD CONSTRAINT "detail_opname_opname_id_fkey" FOREIGN KEY ("opname_id") REFERENCES "stok_opname"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ditulis manual: jumlah barang masuk selalu positif, dan status opname hanya tiga nilai.
ALTER TABLE "detail_barang_masuk" ADD CONSTRAINT "detail_barang_masuk_jumlah_cek" CHECK ("jumlah" > 0 AND "harga_jual" >= 0);
ALTER TABLE "stok_opname" ADD CONSTRAINT "stok_opname_status_cek" CHECK ("status" IN ('draft', 'review', 'final'));
ALTER TABLE "detail_opname" ADD CONSTRAINT "detail_opname_cek" CHECK ("stok_fisik" >= 0 AND "selisih" = "stok_fisik" - "stok_sistem");
