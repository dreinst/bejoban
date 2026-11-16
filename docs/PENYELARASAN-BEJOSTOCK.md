# Penyelarasan skema dengan BejoStock

Tahap ini menyiapkan database Bejo Ban supaya kelak bisa digabung dengan BejoStock (rancangan ERD dari Asah) tanpa memindahkan data. Semua perubahan bersifat aditif: tidak ada tabel atau kolom lama yang diganti nama atau dihapus, dan semua kolom baru boleh kosong atau punya nilai bawaan. Migrasinya `prisma/migrations/20261116140000_penyelarasan_bejostock`, lalu `20261116150000_stok_per_cabang` untuk stok ban per cabang dan merek by order (lihat bagian di bawah).

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
| `StockTire` | stok ban dari pricelist | per cabang lewat `cabang_id` (boleh kosong); kolom baru `kode`, `aktif`, `cabang_id` |
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
| `StockTire` | `kode` | teks, boleh kosong, unik per cabang | kode stabil baris stok ban, lihat di bawah |
| `StockTire` | `aktif` | boolean, `true` | `false` kalau baris hilang dari sumber pricelist |
| `StockTire` | `cabang_id` | angka, boleh kosong, tanpa relasi | cabang pemilik baris. Kosong berarti baris lama yang belum ditetapkan cabangnya |
| `Brand` | `by_order` | boolean, `false` | merek tidak distok, dipesan dulu |

Kode stok ban dibentuk dari ukuran ternormalisasi dan merek yang dikecilkan hurufnya, misalnya `185/65R15|hankook kinergy`. Kalau ada beberapa baris dengan ukuran dan merek sama, baris kedua dan seterusnya diberi sufiks `#2`, `#3`, dan seterusnya. Urutannya mengikuti urutan baris di pricelist, yang sama dengan urutan `id` karena impor lama membuat baris sesuai urutan berkas. Pembentuknya ada di `src/lib/stok/kode.ts` dan dipakai bersama oleh impor dan `scripts/isi-kode-stok.ts`.

## Tabel baru

- `buku_stok`: satu baris untuk setiap perubahan stok. Kolom: `id`, `tipe`, `perubahan`, `saldo_akhir`, `ref_id`, `batch_id` (boleh kosong, untuk batch FIFO nanti), `cabang_id` (cabang baris stok, kosong untuk stok ban tanpa cabang), `kode_produk`, `waktu`, `pengguna`. Tipe yang diterima: `jual`, `masuk`, `opname`, `transfer`, `void` (dari ERD), ditambah `impor` dan `koreksi`. Indeks pada `kode_produk` dan `waktu`.
- `log_aktivitas`: satu baris ringkas untuk setiap aksi admin yang mengubah data. Kolom: `pengguna`, `aksi`, `entitas`, `data` (JSON berupa teks, paling banyak sekitar 2000 karakter), `waktu`.
- `kalender`: hari libur dan promo. Kolom: `tanggal` (teks `YYYY-MM-DD` waktu Jakarta), `jenis` (`libur`, `promo`, atau `lainnya`), `keterangan`.

## Modul stok

Semua perubahan stok lewat `src/lib/stok/ubah.ts`. Fungsi `ubahStokTx` membaca saldo di dalam transaksi, menghitung saldo baru, menulis stok, lalu menulis baris `buku_stok`, semuanya dalam satu `db.$transaction`. Kalau perubahannya nol, tidak ada yang dicatat. Stok tidak boleh negatif kecuali tipe `koreksi` dengan izin eksplisit. Perhitungannya ada di `src/lib/stok/logika.ts` dan tidak menyentuh database, jadi bisa dites terpisah.

Target ada dua: baris `StockTire` (stok ban, `cabang_id` mengikuti baris itu) dan `Listing` (produk di satu cabang). Target stok ban bisa lewat `id` atau lewat `kode` plus `cabangId`, karena kode yang sama boleh ada di beberapa cabang. Yang sudah memakainya:

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

Sejak migrasi `20261116150000_stok_per_cabang` impor bekerja per cabang, rinciannya di bagian berikut.

## Endpoint baca

Keduanya hanya untuk sesi admin. Sesi dicek di handler lewat `getSession`, karena `src/proxy.ts` hanya menjaga `/admin`. Tanpa sesi jawabannya 401. Admin cabang hanya melihat data cabangnya.

- `GET /api/stok?cabang_id=<angka>`: JSON `{ data: [...] }`. Tiap baris berisi `sumber` (`listing` atau `stok_ban`), `produk_id` (kosong untuk stok ban), `kode`, `cabang_id`, `jumlah`, `batas_minimum`, dan `diperbarui` (waktu baris buku stok terakhir, atau waktu impor dan ubah manual untuk stok ban). `batas_minimum` selalu `null` karena belum ada kolomnya, dan akan diisi setelah batas stok per produk disepakati. Baris `stok_ban` mengikuti filter cabang: kalau `cabang_id` diisi, hanya baris cabang itu yang ikut dan baris tanpa cabang tidak disertakan. Kalau `cabang_id` tidak diisi (hanya owner), semua baris aktif ikut, dan baris yang belum ditetapkan cabangnya muncul dengan `cabang_id` null. Admin cabang selalu disaring ke cabangnya sendiri, jadi sekarang ikut melihat baris stok ban cabangnya. Baris `listing` tidak berubah. Logika saringnya `saringStokBan` di `src/lib/tire/cabang.ts`.
- `GET /api/buku-stok?dari=YYYY-MM-DD&sampai=YYYY-MM-DD`: unduhan CSV `buku_stok` dalam rentang tanggal waktu Jakarta (kedua tanggal ikut), paling banyak 366 hari. Teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi apostrof supaya tidak dibaca sebagai rumus, dan kutip ganda di-escape.

## Stok ban per cabang

Stok Batu dan Karanglo terpisah. Belum diketahui pricelist yang sudah ada itu milik cabang mana, jadi 325 baris lama tetap tanpa cabang (`cabang_id` kosong) sampai owner menetapkannya.

- **Keunikan.** `kode` unik per cabang lewat indeks gabungan `StockTire_kode_cabang_id_key` (`@@unique([kode, cabangId])`). SQLite menganggap NULL selalu berbeda di indeks unik, jadi indeks itu tidak mencegah dua baris tanpa cabang dengan kode sama. Penjaganya indeks unik parsial `StockTire_kode_tanpa_cabang_key` pada `kode` dengan syarat `cabang_id IS NULL`, yang ditulis langsung di SQL migrasi karena Prisma belum bisa menuliskan indeks parsial di skema. Sudah dicek: `prisma migrate diff` dari folder migrasi ke skema dan `prisma migrate dev --create-only` pada salinan database sama-sama menghasilkan migrasi kosong, jadi Prisma tidak menganggapnya drift dan tidak mencoba menghapusnya. Indeks lama `StockTire_kode_key` dihapus di migrasi yang sama (hanya indeks, isi tabel tidak berubah). Karena keunikan tidak lagi pada satu kolom, kode Prisma memakai `findFirst` dengan `kode` dan `cabangId`, bukan `findUnique` atau `upsert` per kode.
- **Kolom tanpa relasi.** `cabang_id` sengaja tanpa foreign key seperti `buku_stok.cabang_id`, supaya migrasinya cukup `ALTER TABLE ADD COLUMN` tanpa membangun ulang tabel yang berisi data produksi.
- **Impor per cabang.** `applyImport(hasil, sumber, pengguna, cabangId)` dengan `cabangId` null untuk perilaku lama. Pencocokan kode, penggabungan baris manual terkunci, pembuatan baris baru, dan penonaktifan baris yang hilang hanya melihat baris cabang itu. Impor ke satu cabang tidak menyentuh cabang lain maupun baris tanpa cabang (ada tesnya). Buku stok mencatat `cabang_id` baris itu untuk tipe `impor` dan `koreksi`.
- **Sheet per cabang.** URL disimpan di Setting `stok.sheet.<slug>`. `stok.sheet` yang lama tetap dipakai untuk baris tanpa cabang. Satu sheet berisi dua cabang juga bisa (pilihan "Sheet gabungan", URL di `stok.sheet.gabungan`) asal baris judulnya punya kolom `Cabang`. Nilainya dicocokkan ke slug, nama cabang, atau nama pendek (Batu, Karanglo) tanpa membedakan huruf besar kecil. Nilai kosong atau tidak dikenal tidak ditebak: barisnya dilewati dan muncul di daftar bermasalah. Sheet gabungan diimpor per cabang, satu transaksi per cabang, dan hanya untuk cabang yang muncul di sheet, jadi cabang yang tidak ada barisnya sama sekali tidak dinonaktifkan. Kalau sumber punya kolom `Cabang` tapi yang dipilih satu cabang (atau sebaliknya), impor ditolak dengan pesan yang jelas.
- **Tetapkan baris tanpa cabang.** `tetapkanTanpaCabang` di `src/lib/stok/tetapkan.ts` memindah semua baris tanpa cabang (aktif maupun tidak) ke satu cabang dalam satu transaksi. Baris yang kodenya sudah dimiliki cabang tujuan dilewati dan tetap tanpa cabang. Supaya buku stok tetap seimbang per kode dan cabang, sisa stok tiap baris yang dipindah dicatat dua kali bertipe `koreksi` dengan `ref_id` sama: keluar dari tanpa cabang, masuk ke cabang tujuan. Aksinya tercatat di `log_aktivitas` (`tetapkan_cabang`).
- **Pembaca lain.** Kalkulator ongkir menampilkan ukuran milik cabang asal ditambah baris tanpa cabang. Chatbot memakai cabang baris lewat saklar *Stok per cabang* (lihat `docs/PANDUAN-ADMIN.md`).

## Merek by order

`Brand.by_order` menandai merek yang tidak distok dan dipesan dulu. Merek resmi Bejo Ban: Michelin, BFGoodrich, Hankook, Laufenn, Dunlop, Bridgestone, Sailun, Accelera, Falken, Delium, Maxxis. Empat yang terakhir berstatus by order. Ban truk menyusul dan belum dijual: Aeolus, Swallow, Sailun, dan merek lain. Belum ada baris `Brand` untuk ban truk.

Merek di pricelist (misalnya GT, Forceum, Bison, Gajah Tunggal) adalah teks di kolom `StockTire.brand`, bukan baris `Brand`, dan tidak terpengaruh. Chatbot menerima daftar merek by order lewat `BotContext.byOrderBrands`, diisi `loadContext` dari tabel `Brand`.

## Langkah produksi untuk stok per cabang dan merek by order

Produksi sekarang ada di migrasi `20261116140000_penyelarasan_bejostock`. Yang baru hanya `20261116150000_stok_per_cabang`. Jalankan berurutan dengan `DATABASE_URL` produksi.

1. Hentikan aplikasi dan worker bot.
2. Cadangkan database: `sqlite3 data/bejoban.db ".backup data/bejoban.db.cadangan-$(date +%Y%m%d-%H%M)"` (atau `cp` seperti di bawah kalau tidak ada proses yang membukanya).
3. Ambil kode terbaru, `npm ci`.
4. `npx prisma migrate deploy`. Sudah diuji pada salinan database lokal yang setara produksi: jumlah baris dan checksum isi kolom lama semua tabel sama sebelum dan sesudah, `StockTire` tetap 325 baris dengan `cabang_id` kosong semua, `Brand` tetap 5 baris dengan `by_order` false.
5. Tambahkan bagian `brands` ke `/app/data/seed-lokal/seed.json` di server, urutan sesuai daftar merek resmi:
   ```json
   "brands": [
     { "name": "Michelin", "byOrder": false, "sort": 1 },
     { "name": "BFGoodrich", "byOrder": false, "sort": 2 },
     { "name": "Hankook", "byOrder": false, "sort": 3 },
     { "name": "Laufenn", "byOrder": false, "sort": 4 },
     { "name": "Dunlop", "byOrder": false, "sort": 5 },
     { "name": "Bridgestone", "byOrder": false, "sort": 6 },
     { "name": "Sailun", "byOrder": false, "sort": 7 },
     { "name": "Accelera", "byOrder": true, "sort": 8 },
     { "name": "Falken", "byOrder": true, "sort": 9 },
     { "name": "Delium", "byOrder": true, "sort": 10 },
     { "name": "Maxxis", "byOrder": true, "sort": 11 }
   ]
   ```
   Field `logo` (nama berkas SVG atau PNG transparan di folder yang sama) boleh ditambahkan per merek, berkasnya tidak masuk git.
6. Jalankan `npm run seed:lokal` di dalam container (data di `/app/data/seed-lokal/`). Merek dicocokkan menurut nama tanpa membedakan huruf besar kecil: yang ada diperbarui `byOrder` dan `sort`, yang belum ada dibuat, merek lain tidak disentuh. Seed yang sama juga menjalankan bagian lain `seed.json` seperti biasa (aman diulang).
7. Periksa: `npx prisma migrate status` bersih, jumlah `StockTire` dan `ServicePrice` sama dengan sebelum migrasi.
8. Build lalu restart aplikasi dan worker (Prisma Client lama belum mengenal `cabang_id` dan `by_order`).

Kalau ada yang salah, hentikan aplikasi dan kembalikan berkas cadangan dari langkah 2.

## Langkah migrasi produksi (tahap penyelarasan sebelumnya)

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

## Menu admin dan modul Asah

Sidebar admin tidak lagi memakai judul kelompok modul Asah. Pemetaannya dicatat di sini dan di komentar `src/lib/admin-menu.ts`:

| Modul Asah | Menu admin sekarang |
| --- | --- |
| Analitik | Ringkasan |
| Inventaris | Stok dan harga (Stok ban, Harga jasa, Produk situs, Perlu dicek); Merek dan Kategori ada di menu Situs |
| Kasir dan Harga | belum ada halaman (lihat daftar di bawah); dulu tampil sebagai baris "menyusul dari BejoStock" di sidebar |
| Peringatan | Stok dan harga, tab Perlu dicek; Kalender libur dan promo disembunyikan dari menu, halamannya di `/admin/kalender` |
| Akses | Pengaturan (Cabang, Pengguna); Akun saya di menu profil |

## Yang sengaja ditunda

- Kasir dan transaksi penjualan (tipe `jual` dan `void` sudah diterima buku stok, tapi belum ada pemakainya).
- Batch FIFO (`batch_id` sudah ada, belum dipakai), barang masuk, opname, dan transfer antarcabang.
- Pengajuan harga dan diskon.
- Penyatuan `StockTire` dan `ServicePrice` ke `Product`.
- Transfer stok ban antarcabang (sekarang hanya penetapan baris tanpa cabang).
- Kolom `batas_minimum` dan nama tabel lama yang diselaraskan penuh dengan ERD.
- Pindah ke MySQL dan pembaruan langsung lewat Socket.IO.
