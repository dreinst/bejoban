# Penyelarasan skema dengan BejoStock

Tahap ini menyiapkan database Bejo Ban supaya kelak bisa digabung dengan BejoStock (rancangan ERD dari Asah) tanpa memindahkan data. Semua perubahan bersifat aditif: tidak ada tabel atau kolom lama yang diganti nama atau dihapus, dan semua kolom baru boleh kosong atau punya nilai bawaan. Migrasinya `prisma/migrations/20261116140000_penyelarasan_bejostock`.

Nama tabel dan kolom baru di database mengikuti gaya ERD Asah (snake_case, bahasa Indonesia) lewat `@map` dan `@@map` di `prisma/schema.prisma`. Nama field di kode Prisma tetap camelCase.

## Pemetaan tabel lama ke nama Asah

Tabel lama belum diganti nama. Kolom kanan adalah padanan yang dipakai di dokumen ini dan di endpoint `/api/stok`. Nama padanan untuk tabel lama belum dicocokkan satu per satu dengan ERD Asah, jadi perlu dicek ulang sebelum penyatuan.

| Tabel sekarang | Padanan Asah | Catatan |
| --- | --- | --- |
| `Branch` | `cabang` | `id` dipakai sebagai `cabang_id` |
| `User` | `pengguna` | kolom baru `aktif` |
| `Category` | `kategori` | kolom baru `tipe`, `pakai_stok`, `aktif` |
| `Product` | `produk` | kolom baru `kode`, `ukuran`, `harga_acuan`, `barcode` |
| `Listing` | `stok` per produk dan cabang | `productId` = `produk_id`, `branchId` = `cabang_id`, `stock` = `jumlah` |
| `StockTire` | stok ban dari pricelist | belum per cabang; kolom baru `kode` dan `aktif` |
| `ServicePrice` | produk bertipe jasa | belum disatukan, lihat bagian yang ditunda |

## Kolom baru

| Tabel | Kolom database | Tipe dan bawaan | Kegunaan |
| --- | --- | --- | --- |
| `Category` | `tipe` | teks, `barang` | `barang` atau `jasa` |
| `Category` | `pakai_stok` | boolean, `true` | kategori jasa nanti tidak memakai stok |
| `Category` | `aktif` | boolean, `true` | |
| `Product` | `kode` | teks, boleh kosong, unik | kode produk gaya BejoStock. Selama kosong, `slug` dipakai sebagai kode di buku stok |
| `Product` | `ukuran` | teks, boleh kosong | |
| `Product` | `harga_acuan` | angka, boleh kosong | |
| `Product` | `barcode` | teks, boleh kosong | |
| `User` | `aktif` | boolean, `true` | akun nonaktif tidak bisa login dan sesinya langsung tidak berlaku |
| `StockTire` | `kode` | teks, boleh kosong, unik | kode stabil baris stok ban, lihat di bawah |
| `StockTire` | `aktif` | boolean, `true` | `false` kalau baris hilang dari sumber pricelist |

Kode stok ban dibentuk dari ukuran ternormalisasi dan merek yang dikecilkan hurufnya, misalnya `185/65R15|hankook kinergy`. Kalau ada beberapa baris dengan ukuran dan merek sama, baris kedua dan seterusnya diberi sufiks `#2`, `#3`, dan seterusnya. Urutannya mengikuti urutan baris di pricelist, yang sama dengan urutan `id` karena impor lama membuat baris sesuai urutan berkas. Pembentuknya ada di `src/lib/stok/kode.ts` dan dipakai bersama oleh impor dan `scripts/isi-kode-stok.ts`.

## Tabel baru

- `buku_stok`: satu baris untuk setiap perubahan stok. Kolom: `id`, `tipe`, `perubahan`, `saldo_akhir`, `ref_id`, `batch_id` (boleh kosong, untuk batch FIFO nanti), `cabang_id` (kosong untuk stok ban), `kode_produk`, `waktu`, `pengguna`. Tipe yang diterima: `jual`, `masuk`, `opname`, `transfer`, `void` (dari ERD), ditambah `impor` dan `koreksi`. Indeks pada `kode_produk` dan `waktu`.
- `log_aktivitas`: satu baris ringkas untuk setiap aksi admin yang mengubah data. Kolom: `pengguna`, `aksi`, `entitas`, `data` (JSON berupa teks, paling banyak sekitar 2000 karakter), `waktu`.
- `kalender`: hari libur dan promo. Kolom: `tanggal` (teks `YYYY-MM-DD` waktu Jakarta), `jenis` (`libur`, `promo`, atau `lainnya`), `keterangan`.

## Modul stok

Semua perubahan stok lewat `src/lib/stok/ubah.ts`. Fungsi `ubahStokTx` membaca saldo di dalam transaksi, menghitung saldo baru, menulis stok, lalu menulis baris `buku_stok`, semuanya dalam satu `db.$transaction`. Kalau perubahannya nol, tidak ada yang dicatat. Stok tidak boleh negatif kecuali tipe `koreksi` dengan izin eksplisit. Perhitungannya ada di `src/lib/stok/logika.ts` dan tidak menyentuh database, jadi bisa dites terpisah.

Target ada dua: baris `StockTire` (stok ban, `cabang_id` kosong) dan `Listing` (produk di satu cabang). Yang sudah memakainya:

- `saveProduct` dan `savePrices` (stok produk per cabang, tipe `koreksi`), termasuk menghapus listing dan menghapus produk, yang lebih dulu mencatat sisa stok keluar sampai 0.
- `saveStockRow` di halaman stok ban (tipe `koreksi`).
- Impor berkas dan sinkron Google Sheets (tipe `impor`).

`catatAktivitas` di `src/lib/stok/aktivitas.ts` menulis `log_aktivitas` untuk aksi admin yang mengubah data. Kalau pencatatan gagal, aksinya tetap jalan dan galatnya hanya masuk log server.

## Impor pricelist

Sebelumnya impor menghapus seluruh `StockTire` lalu membuat ulang, sehingga `id` berganti setiap kali. Sekarang impor melakukan upsert per `kode`:

- Baris yang ada di sumber diperbarui atau dibuat. `id` tetap sama setelah impor ulang.
- Baris yang hilang dari sumber ditandai `aktif = false`, tidak dihapus. Kalau muncul lagi, baris itu aktif kembali dengan `id` yang sama.
- Baris manual yang dikunci tidak ditimpa dan tidak dinonaktifkan walaupun hilang dari sumber. Baris manual yang tidak dikunci ditimpa data baru.
- Selisih stok dicatat di `buku_stok` bertipe `impor`, hanya kalau stoknya berubah. Baris baru dihitung dari 0.
- Kalau masih ada baris dengan `kode` kosong (misalnya skrip isi kode belum dijalankan), impor mengisinya dulu dengan pembentuk yang sama, di dalam transaksi yang sama.
- Ringkasan `stok.lastImport` sekarang juga berisi jumlah baris baru, dinonaktifkan, diaktifkan kembali, dan stok berubah.

Halaman stok ban, Peringatan, Ringkasan, kalkulator ongkir, halaman chatbot, dan chatbot (`src/lib/bot/respond.ts`, dipakai juga oleh `process.ts`) hanya membaca baris aktif.

## Endpoint baca

Keduanya hanya untuk sesi admin. Sesi dicek di handler lewat `getSession`, karena `src/proxy.ts` hanya menjaga `/admin`. Tanpa sesi jawabannya 401. Admin cabang hanya melihat data cabangnya.

- `GET /api/stok?cabang_id=<angka>`: JSON `{ data: [...] }`. Tiap baris berisi `sumber` (`listing` atau `stok_ban`), `produk_id` (kosong untuk stok ban), `kode`, `cabang_id`, `jumlah`, `batas_minimum`, dan `diperbarui` (waktu baris buku stok terakhir, atau waktu impor dan ubah manual untuk stok ban). `batas_minimum` selalu `null` karena belum ada kolomnya, dan akan diisi setelah batas stok per produk disepakati. Stok ban belum per cabang, jadi hanya ikut kalau `cabang_id` tidak diisi.
- `GET /api/buku-stok?dari=YYYY-MM-DD&sampai=YYYY-MM-DD`: unduhan CSV `buku_stok` dalam rentang tanggal waktu Jakarta (kedua tanggal ikut), paling banyak 366 hari. Teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi apostrof supaya tidak dibaca sebagai rumus, dan kutip ganda di-escape.

## Langkah migrasi produksi

Jalankan berurutan di folder aplikasi di server, dengan `DATABASE_URL` produksi.

1. Hentikan aplikasi dan worker bot supaya tidak ada tulisan ke database selama migrasi.
2. Cadangkan database:
   ```
   cp data/bejoban.db data/bejoban.db.cadangan-$(date +%Y%m%d-%H%M)
   ```
   Cara lain yang tetap aman walau ada proses yang masih membuka database: `sqlite3 data/bejoban.db ".backup data/bejoban.db.cadangan-$(date +%Y%m%d-%H%M)"`.
3. Ambil kode terbaru dan pasang dependensi: `npm ci` (ikut menjalankan `prisma generate`).
4. Terapkan migrasi: `npx prisma migrate deploy`. Hanya `20261116140000_penyelarasan_bejostock` yang baru.
5. Isi kode stok ban: `npm run isi:kode`. Skrip ini aman diulang dan hanya mengisi kolom `kode` yang kosong. Catat jumlah baris kembar yang dilaporkan.
6. Periksa: `npx prisma migrate status` harus bersih, dan jumlah baris `StockTire` serta `ServicePrice` sama dengan sebelum migrasi.
7. Build dan hidupkan lagi: `npm run build`, lalu restart aplikasi dan worker. Restart wajib, karena proses lama masih memakai Prisma Client lama yang belum mengenal kolom `aktif`, sehingga semua login akan ditolak sampai proses diganti.

Kalau ada yang salah, hentikan aplikasi dan kembalikan berkas cadangan dari langkah 2.

## Yang sengaja ditunda

- Kasir dan transaksi penjualan (tipe `jual` dan `void` sudah diterima buku stok, tapi belum ada pemakainya).
- Batch FIFO (`batch_id` sudah ada, belum dipakai), barang masuk, opname, dan transfer antarcabang.
- Pengajuan harga dan diskon.
- Penyatuan `StockTire` dan `ServicePrice` ke `Product`, serta stok ban per cabang.
- Kolom `batas_minimum` dan nama tabel lama yang diselaraskan penuh dengan ERD.
- Pindah ke MySQL dan pembaruan langsung lewat Socket.IO.
