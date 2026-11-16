-- Hasil pencarian lokasi yang kosong tidak boleh tersimpan lama di cache. Hapus entri kosong yang sudah ada.
DELETE FROM "GeoCache" WHERE "results" = '[]';
