-- Cermin chat: tabel pemetaan LID ke nomor. Aditif, tabel lain tidak diubah.

-- CreateTable
CREATE TABLE "wa_lid" (
    "lid" TEXT NOT NULL,
    "pn" TEXT NOT NULL,
    "diperbarui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wa_lid_pkey" PRIMARY KEY ("lid")
);

-- CreateIndex
CREATE INDEX "wa_lid_diperbarui_idx" ON "wa_lid"("diperbarui");

