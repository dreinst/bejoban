-- Cermin chat WhatsApp: tiga tabel baru, aditif. Tabel dan indeks lama tidak diubah.
-- Dibuat dengan prisma migrate diff dari skema commit e5722c9 ke skema baru.

-- CreateTable
CREATE TABLE "wa_chat" (
    "chat_id" TEXT NOT NULL,
    "nama" TEXT NOT NULL DEFAULT '',
    "grup" BOOLEAN NOT NULL DEFAULT false,
    "pesan_terakhir" TEXT NOT NULL DEFAULT '',
    "waktu_terakhir" TIMESTAMP(3),
    "dilihat" TIMESTAMP(3),

    CONSTRAINT "wa_chat_pkey" PRIMARY KEY ("chat_id")
);

-- CreateTable
CREATE TABLE "wa_pesan" (
    "id" SERIAL NOT NULL,
    "chat_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "id_pendek" TEXT NOT NULL,
    "dari_saya" BOOLEAN NOT NULL,
    "pengirim" TEXT NOT NULL,
    "peserta" TEXT NOT NULL DEFAULT '',
    "nama_pengirim" TEXT NOT NULL DEFAULT '',
    "isi" TEXT NOT NULL DEFAULT '',
    "jenis" TEXT NOT NULL DEFAULT 'teks',
    "nama_berkas" TEXT NOT NULL DEFAULT '',
    "waktu" TIMESTAMP(3) NOT NULL,
    "dihapus" BOOLEAN NOT NULL DEFAULT false,
    "diedit" BOOLEAN NOT NULL DEFAULT false,
    "sementara" BOOLEAN NOT NULL DEFAULT false,
    "dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_pesan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_kirim_bot" (
    "id_pendek" TEXT NOT NULL,
    "dibuat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_kirim_bot_pkey" PRIMARY KEY ("id_pendek")
);

-- CreateIndex
CREATE INDEX "wa_chat_waktu_terakhir_idx" ON "wa_chat"("waktu_terakhir");

-- CreateIndex
CREATE INDEX "wa_pesan_id_pendek_idx" ON "wa_pesan"("id_pendek");

-- CreateIndex
CREATE INDEX "wa_pesan_chat_id_waktu_idx" ON "wa_pesan"("chat_id", "waktu");

-- CreateIndex
CREATE INDEX "wa_pesan_waktu_idx" ON "wa_pesan"("waktu");

-- CreateIndex
CREATE UNIQUE INDEX "wa_pesan_chat_id_id_pendek_key" ON "wa_pesan"("chat_id", "id_pendek");

-- CreateIndex
CREATE INDEX "wa_kirim_bot_dibuat_idx" ON "wa_kirim_bot"("dibuat");

