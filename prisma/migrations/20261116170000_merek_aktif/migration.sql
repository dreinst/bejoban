-- Merek: status aktif. Hanya menambah satu kolom dengan nilai bawaan true, jadi semua merek lama tetap aktif
-- dan isi kolom lain tidak berubah. Merek nonaktif tidak tampil di beranda, saringan produk, pilihan merek
-- di form produk, dan kosakata merek by order chatbot. Produk yang memakainya tidak diubah.
ALTER TABLE "Brand" ADD COLUMN "aktif" BOOLEAN NOT NULL DEFAULT true;
