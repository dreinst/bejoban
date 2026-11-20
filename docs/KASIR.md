# Kasir (POS) v1

Kasir web Bejo Ban. Bagian 1: katalog dan transaksi, mode stok per cabang, nota digital, riwayat dan void, diskon nota, harga batch, peringatan stok menipis, siaran realtime, dan manifest web app. Bagian 2: barang masuk dengan pengajuan harga restock, stok opname, dashboard owner, rekap bulanan, dan ekspor CSV untuk tim data.

Kasir bagian dari aplikasi admin yang sama, di `/admin/kasir`, dengan login, akun, dan cabang yang sudah ada. Rancangannya mengikuti rancangan BejoStock dari tim Asah (ERD Draf 2 dan keputusan tim), dengan perbedaan yang dicatat di bagian terakhir dokumen ini supaya penyelarasan v2 mudah.

## Peran

| Fitur | Admin cabang | Owner |
|---|---|---|
| Lihat stok cabang lain di layar kasir | ya | ya |
| Transaksi kasir | cabang sendiri | semua cabang bermode kasir |
| Diskon nota | boleh, masuk antrean tinjau owner | langsung, tercatat di log aktivitas |
| Void | cabang sendiri, hari yang sama (WIB), alasan wajib | kapan saja, alasan wajib |
| Ubah harga jual batch | mengajukan lewat barang masuk | ya, langsung |
| Batas minimum | tidak | ya |
| Aktifkan kasir per cabang | tidak | ya |
| Koreksi stok di mode kasir | tidak | ya, alasan wajib |
| Riwayat transaksi | cabang sendiri | semua cabang |
| Barang masuk | cabang sendiri | semua cabang bermode kasir |
| Putuskan usulan harga restock | tidak | ya |
| Opname | mengisi cabang sendiri, kirim ke owner | mengisi, meninjau, dan memfinalkan |
| Dashboard, rekap bulanan, ekspor CSV | tidak | ya |

Semua cek peran dijalankan di server (`src/lib/kasir/transaksi.ts`, `masuk.ts`, `opname.ts`, `src/app/admin/kasir-actions.ts`, dan route ekspor). Permintaan admin untuk cabang lain ditolak walau formulirnya diubah.

## Menu

Sidebar hanya bertambah satu menu, Kasir. Isinya tab (di HP tab digulir mendatar):

- Transaksi baru (`/admin/kasir`), semua peran.
- Riwayat (`/admin/kasir/riwayat`), semua peran.
- Barang masuk (`/admin/kasir/masuk`, formulir di `/masuk/baru`, rincian di `/masuk/<id>`), semua peran.
- Opname (`/admin/kasir/opname`, rincian di `/opname/<id>`), semua peran.
- Tinjau pengajuan (`/admin/kasir/pengajuan`), owner. Alamat lama `/admin/kasir/diskon` dialihkan ke sini.
- Dashboard (`/admin/kasir/dashboard`), owner.
- Rekap dan ekspor (`/admin/kasir/rekap`), owner. Unduhan CSV di `/api/kasir/ekspor`.
- Pengaturan kasir (`/admin/kasir/pengaturan`), owner. Halaman satu barang (`/admin/kasir/barang?sumber=ban&id=...`) ikut tab ini.

Nota ada di `/admin/nota/<id>`, di luar panel admin supaya halaman cetaknya bersih.

## Mode stok per cabang

Stok ban diisi dari pricelist (berkas atau Google Sheets) per cabang. Kalau kasir memotong stok sementara sinkron menimpanya, stok kacau. Karena itu tiap cabang punya `mode_stok`:

- `sheet` (bawaan). Perilaku lama, kasir belum bisa dipakai di cabang itu.
- `kasir`. Sistem menjadi pemegang stok cabang itu.

Owner mengaktifkan kasir di Pengaturan kasir dengan kode nota cabang (2 sampai 5 huruf, misalnya `BTU`). Saat aktif:

- Tiap baris stok cabang itu (`StockTire` dan `Listing`) yang stoknya di atas 0 mendapat batch awal: `jumlah_awal` dan `sisa` sama dengan stok, `harga_jual` sama dengan harga jual efektif (ban: harga dikurangi potongan, harga kosong menjadi 0), `jenis` = `awal`. Harga awal tercatat di `riwayat_harga`.
- Harga baris disamakan dengan harga batch terdepan. Untuk ban, potongan menjadi 0 dan harga menjadi harga sesudah potongan, jadi angka yang dibaca chatbot tidak berubah.
- Aksi tercatat di `log_aktivitas` (`aktifkan_kasir`).

Selama mode kasir:

- Impor berkas dan sinkron sheet untuk cabang itu ditolak, juga sheet gabungan yang memuat cabang itu. Pengecekan ada di aksi dan di dalam transaksi `applyImport`.
- Di Stok ban, harga, potongan, dan stok baris cabang itu terkunci. Keterangan masih bisa diubah. Di Produk situs dan form produk, harga jual dan stok terkunci. Harga coret, Dijual, dan Promo kilat masih bisa diubah. Server mengabaikan harga dan stok dari form itu.
- Stok hanya berubah lewat penjualan, void, barang masuk, opname, dan koreksi owner. `ubahStokTx` menolak perubahan stok baris cabang bermode kasir yang tidak datang dari modul kasir (`jalurKasir`). Ini penjaga terakhir kalau ada jalur lama yang terlewat.
- Menetapkan baris tanpa cabang ke cabang bermode kasir membuat batch awal untuk baris yang pindah.
- Stok baris selalu sama dengan jumlah `sisa` batch-nya, dan harga baris sama dengan harga batch terdepan. Pemeriksanya ada di Pengaturan kasir (Periksa sekarang) dan di `periksaInvarian()`.
- v1 belum punya jalan kembali ke mode sheet.

Baris tanpa cabang tidak bisa dijual kasir. Pengaktifan menyebut jumlahnya dan menautkan ke alat "Tetapkan baris tanpa cabang" di Stok ban.

## Katalog kasir

Satu daftar cari untuk:

- Ban: `StockTire` aktif milik cabang itu.
- Produk situs: `Listing` cabang itu.
- Jasa: `ServicePrice`, tanpa stok. Kalau ada `altLabel` dan `altPrice`, itu pilihan kedua.

Pencarian memakai nama, merek, kode, barcode, dan ukuran yang dinormalkan (`185 65 15` menemukan `185/65 R15`). Enter menambah hasil pertama. Teks yang sama persis dengan kode atau barcode langsung masuk keranjang, jadi pemindai barcode USB bisa dipakai. Tiap barang menampilkan sumber, stok cabang ini, stok cabang lain untuk kode yang sama, dan harga batch yang akan terjual. Barang berharga 0 ditolak sampai owner mengatur harga batch-nya.

## Transaksi

1. Admin membuka Kasir. Cabang otomatis cabangnya sendiri, owner memilih cabang.
2. Pilih channel (toko atau WhatsApp), cari barang, isi jumlah.
3. Diskon nota kalau ada, metode bayar (tunai, QRIS, debit), uang diterima untuk tunai.
4. Konfirmasi.
5. Server menyimpan semuanya dalam satu transaksi basis data: nomor, `transaksi`, `detail_transaksi` per batch, kurangi `sisa` batch dan stok baris, `buku_stok` tipe `jual` per batch, harga baris disamakan, cek peringatan stok, pengajuan diskon kalau perlu.
6. Siarkan perubahan, lalu tampilkan nota.

Aturan:

- Klien hanya mengirim sumber dan id barang, jumlah, channel, metode bayar, diskon, alasan diskon, uang diterima, dan kunci idempotency. Harga dihitung ulang di server dari batch.
- FIFO: batch tertua yang masih bersisa (`tanggal_masuk`, lalu `id`). Kalau kurang, baris dipecah per batch.
- Jumlah melebihi stok cabang ditolak dengan menyebut stok cabang lain.
- Semua harga sudah termasuk pajak. Nota tidak menghitung pajak.
- Nomor `KODE-YYMMDD-NNNN`, urut per cabang per hari WIB, misalnya `BTU-261120-0001`. Penghitungnya tabel `penghitung_nota`, dinaikkan dengan satu `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, jadi dua transaksi bersamaan mendapat nomor berbeda.
- Idempotency: layar membuat kunci acak tiap kali dialog konfirmasi dibuka. Server mengantrekan kiriman dengan kunci yang sama (`pg_advisory_xact_lock(4207002, hashtext(kunci))`), lalu mengembalikan transaksi yang sudah ada. Indeks unik `idempotency_key` menjadi cadangan. Kalau koneksi putus sebelum jawaban sampai, layar mempertahankan kunci yang sama untuk kiriman ulang.

### Kunci dan urutannya

Semua jalur mengambil kunci dengan urutan yang sama supaya tidak saling tunggu:

0. kunci idempotency (`pg_advisory_xact_lock`) untuk jual dan barang masuk, kunci satu opname per cabang saat opname dimulai, atau baris `stok_opname` / `pengajuan_harga` `FOR UPDATE` untuk opname dan keputusan restock. Kunci ini tidak pernah diambil sesudah kunci di bawahnya;
1. `kunciSusunanStok` (advisory lock), hanya untuk impor, tetapkan cabang, isi kode kosong, dan pengaktifan kasir;
2. baris `Branch`: `FOR SHARE` untuk jual, void, koreksi, ubah harga batch, barang masuk, keputusan restock, dan finalisasi opname, `FOR UPDATE` saat pengaktifan;
3. baris stok (`StockTire` lalu `Listing`, urut id) `FOR UPDATE`;
4. baris `batch_stok` `FOR UPDATE`.

Barang masuk dan opname memakai kunci baris yang sama dengan penjualan, jadi penjualan dan barang masuk (atau penjualan dan finalisasi opname) pada baris yang sama berjalan bergantian. Dua penjualan bersamaan untuk unit terakhir: yang kedua menunggu kunci baris, lalu membaca sisa batch 0 dan ditolak. Ada juga `CHECK (sisa >= 0 AND sisa <= jumlah_awal)` di `batch_stok` dan update bersyarat `sisa >= jumlah`.

## Nota digital

Isi: nama toko, cabang, alamat, WhatsApp cabang, nomor, waktu WIB, nama kasir, channel, baris (nama, jumlah x harga, subtotal), diskon, total, metode bayar, uang diterima dan kembalian untuk tunai, keterangan harga sudah termasuk pajak, dan tanda VOID dengan alasan kalau dibatalkan.

Halaman nota punya pilihan kertas 58 mm, 80 mm, dan A4 untuk dialog cetak browser (`@page` diatur menurut pilihan). Tombol Bagikan memakai Web Share. Kalau perangkat tidak mendukung, teks nota disalin. Tombol Salin teks menyalin versi teks polos untuk ditempel ke chat WhatsApp. Printer thermal khusus belum didukung.

## Diskon nota

Mengikuti keputusan tim 4 November: diskon per nota untuk kasus langka, transaksi tetap jalan, owner meninjau sesudahnya.

- Potongan dalam rupiah dengan alasan wajib, tidak boleh melebihi subtotal.
- Dibagi ke baris secara proporsional terhadap nilai baris, dibulatkan ke bawah, sisa pembulatan ke baris bernilai terbesar. Hasilnya di `detail_transaksi.diskon`.
- Diskon dari admin membuat `pengajuan_harga` tipe `diskon` berstatus `menunggu`, plus siaran ke owner. Owner menandai `disetujui` atau `ditolak` di Tinjau diskon. Transaksi tidak berubah. Untuk membatalkan, owner memakai void.
- Diskon dari owner tidak membuat pengajuan, tetapi tercatat di `log_aktivitas` (`diskon_owner`).
- Kalau transaksinya di-void, pengajuan yang masih menunggu menjadi `batal`.

## Harga batch dan riwayat harga

- Owner mengubah `harga_jual` batch yang masih bersisa di halaman barang (Pengaturan kasir, cari barang, Buka). Tiap perubahan tercatat di `riwayat_harga` dan `log_aktivitas`. Kalau batch itu terdepan, harga baris ikut berubah.
- Batch lama tidak ikut berubah saat ada batch baru dengan harga lain.
- Koreksi stok oleh owner (alasan wajib): pengurangan memakai FIFO, penambahan membuat batch `koreksi` dengan harga yang diisi atau harga batch terdepan. Koreksi untuk membetulkan selisih di luar opname. Barang datang dicatat lewat barang masuk.

## Void

- Admin: transaksi cabang sendiri di hari WIB yang sama dengan transaksi. Owner: kapan saja. Alasan wajib.
- Status `void`, alasan, siapa, dan kapan disimpan. Tiap baris detail mengembalikan jumlahnya ke batch yang sama, stok baris naik, `buku_stok` mencatat tipe `void`. Harga baris disamakan lagi dan peringatan stok dicek ulang. Nota menampilkan VOID.
- Transaksi yang sudah void tidak bisa di-void lagi.

## Peringatan stok menipis

- `batas_minimum` di `StockTire` dan `Listing`, boleh kosong (tanpa peringatan). Hanya owner yang mengatur, di halaman barang.
- Diperiksa di `ubahStokTx` sesudah tiap perubahan stok, dari jalur mana pun: kalau stok turun ke batas atau di bawahnya dan belum ada peringatan aktif, terbentuk `peringatan_stok` berstatus `aktif` dengan `jumlah_saat_itu`. Kalau sudah ada yang aktif, tidak membuat baru. Kalau stok naik di atas batas, peringatan ditutup. Mengubah batas juga langsung memeriksa.
- Tampil di Perlu dicek (bagian Stok menipis) dan dihitung di angka tab. Peringatan baru dari kasir disiarkan sebagai notifikasi ke admin cabang itu dan owner.

## Barang masuk

Barang yang datang dari distributor atau toko rekanan dicatat lewat Barang masuk (`src/lib/kasir/masuk.ts`), bukan lewat koreksi.

- Hanya untuk cabang bermode kasir. Cabang mode sheet ditolak dengan pesan bahwa stoknya masih diisi dari sheet. Admin hanya untuk cabang sendiri, owner semua cabang bermode kasir. Barang dari cabang lain di formulir yang diubah juga ditolak.
- Kepala: pemasok, jenis pemasok (`distributor` atau `rekanan`), tanggal pesan (boleh kosong), tanggal terima (tidak boleh sesudah hari ini, tanggal pesan tidak boleh sesudah tanggal terima), catatan, dan pencatat.
- Baris: ban (`StockTire`) atau produk situs (`Listing`) cabang itu, jumlah 1 sampai 9999, harga beli (boleh kosong), dan harga jual. Barang yang sama tidak boleh muncul dua kali di satu penerimaan.
- Semua dalam satu transaksi basis data: nomor, kepala, lalu per baris `detail_barang_masuk`, batch `masuk` (dengan `harga_beli` dan `detail_barang_masuk_id`), stok baris naik lewat `ubahStokTx` (`buku_stok` tipe `masuk`, `ref_id` `masuk:<id>`), `riwayat_harga`, pengajuan harga kalau perlu, dan harga baris disamakan dengan batch terdepan. Peringatan stok menipis ditutup kalau stok naik di atas batas.
- Nomor `BM-KODE-YYMMDD-NNN`, urut per cabang per hari WIB, misalnya `BM-BTU-261120-001`. Penghitungnya tabel `penghitung_penerimaan` dengan `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, sama seperti nomor nota. Awalan `BM-` membuat nomor penerimaan tidak mungkin sama dengan nomor nota (`KODE-YYMMDD-NNNN`), walau kode nota cabang kebetulan `BM`.
- Idempotency: formulir membuat satu kunci acak per penerimaan dan memakainya lagi kalau kiriman gagal. Server mengantrekan kiriman dengan kunci yang sama (`pg_advisory_xact_lock(4207003, hashtext(kunci))`) lalu mengembalikan penerimaan yang sudah ada. Indeks unik `idempotency_key` menjadi cadangan.

### Harga jual dan pengajuan restock

"Harga lama" sebuah barang adalah harga batch terdepannya (batch bersisa yang akan terjual berikutnya). Kalau barang belum punya batch bersisa (stok 0 saat kasir diaktifkan, atau sudah habis), harga lamanya harga jual efektif baris itu: ban `price - discount`, produk situs `Listing.price`. Harga kosong dianggap 0.

- Owner: batch baru memakai harga jual yang diisi owner. Batch lama tidak berubah. Tercatat di `riwayat_harga` (`harga_lama` = harga lama barang, `harga` = harga batch baru).
- Admin: kalau harga jual yang diisi sama dengan harga lama, batch memakai harga itu. Kalau berbeda, batch baru tetap memakai harga lama dan terbentuk `pengajuan_harga` tipe `restock` berstatus `menunggu` (`harga_lama`, `harga_baru` = usulan, `batch_id`, `sumber`, `kode_produk`), plus siaran ke owner.
- Harga jual akhir 0 ditolak ("belum punya harga jual"). Kalau harga lama 0 dan admin mengisi usulan, batch baru berharga 0 sampai owner menyetujui. Selama itu kasir menolak menjual barang tersebut, sama seperti barang berharga 0 lainnya.
- Owner memutuskan di Tinjau pengajuan (`putuskanRestock`). Baris `pengajuan_harga` dikunci dulu, jadi keputusan ganda hanya berlaku sekali dan keputusan tidak bisa diulang. Disetujui: `harga_jual` batch itu menjadi harga usulan, tercatat di `riwayat_harga` dan `log_aktivitas` (`restock_disetujui`), lalu harga baris disamakan lagi dengan batch terdepan. Kalau batch itu belum terdepan, harga baris baru berubah saat batch-batch sebelumnya habis. Ditolak: tidak ada yang berubah selain status (`restock_ditolak` di log).
- Keputusan diskon (`putuskanPengajuan`) hanya menerima tipe `diskon`, jadi usulan restock tidak bisa ditandai disetujui tanpa mengubah batch.

## Opname

Stok opname (`src/lib/kasir/opname.ts`) mencocokkan stok sistem dengan hitungan fisik. Hanya untuk cabang bermode kasir.

- Status `draft`, `review`, `final`. Satu cabang hanya boleh punya satu opname yang belum final (diantrekan dengan `pg_advisory_xact_lock(4207004, cabang_id)`).
- Admin cabang memulai dan mengisi opname cabangnya. Tiap baris menyimpan `stok_sistem` saat baris disimpan, `stok_fisik`, `selisih` (= fisik - sistem), dan `alasan_selisih` yang wajib kalau selisih tidak 0. Mengisi barang yang sama lagi mengganti barisnya dan membaca ulang stok sistem.
- Admin mengirim opname ke owner (`review`). Selama `review`, hanya owner yang bisa mengubah baris atau mengembalikannya ke `draft`. Draft boleh dihapus tanpa mengubah stok.
- Hanya owner yang memfinalkan, dari `draft` atau `review`. Admin yang mencoba ditolak di server.

### Finalisasi

Penjualan bisa terjadi antara baris diisi dan finalisasi. Karena itu selisih diterapkan ke stok sekarang, bukan menimpa angkanya: stok akhir = stok saat final + selisih. Contoh: sistem 7, fisik 9 (selisih +2), lalu terjual 1, saat final stoknya 6 + 2 = 8.

Semua dalam satu transaksi basis data:

1. Baris `stok_opname` dikunci `FOR UPDATE`. Opname yang sudah final ditolak, jadi finalisasi ganda (juga yang bersamaan) hanya berlaku sekali.
2. Baris cabang `FOR SHARE`, lalu semua baris stok opname itu dikunci urut (ban lalu produk, id). Penjualan pada baris yang sama menunggu sampai finalisasi selesai, atau sebaliknya.
3. Kalau stok akhir satu baris akan negatif, seluruh finalisasi ditolak dengan menyebut barisnya, dan tidak ada stok yang berubah. Ini terjadi kalau terjual lebih banyak dari yang dihitung fisik, jadi hitungan itu sudah tidak cocok. Baris itu perlu dihitung dan disimpan ulang (stok sistemnya terbaca ulang), lalu difinalkan lagi. Hasil negatif tidak dipotong ke 0 supaya selisih yang tidak masuk akal tidak tersembunyi.
4. Selisih minus mengurangi batch menurut FIFO. Selisih plus membentuk batch `opname` dengan harga batch terdepan (atau harga baris kalau tidak ada batch bersisa) dan tercatat di `riwayat_harga`. Semuanya di `buku_stok` tipe `opname` (`ref_id` `opname:<id>`). Harga baris disamakan dan peringatan stok dicek ulang.
5. `stok_saat_final` dan `stok_akhir` disimpan per baris, status menjadi `final`, dan finalisasi tercatat di `log_aktivitas` (`finalkan_opname`).

## Dashboard dan rekap bulanan

Kode di `src/lib/kasir/analitik.ts`, owner saja.

- Hanya transaksi `selesai`. Transaksi void tidak dihitung. Nilai per barang dan per periode diambil dari `detail_transaksi`: kotor = `subtotal`, diskon = `detail_transaksi.diskon`, bersih = kotor - diskon.
- Hari dan minggu dihitung dalam WIB (UTC+7). Minggu dimulai Senin. Kolom waktu disimpan sebagai `timestamp` UTC, jadi batas rentang dikirim sebagai teks ISO dan diubah ke UTC di SQL, dan pengelompokan memakai `waktu + interval '7 hours'`. Hasilnya tidak bergantung pada zona sesi basis data.
- Dashboard: penjualan hari ini dan minggu ini per cabang, tabel 7 hari dan 8 minggu terakhir per cabang, porsi ban, jasa, dan produk, 10 barang atau jasa paling laris (unit, lalu nilai), peringatan stok aktif, dan jumlah usulan restock, diskon, dan opname yang menunggu. Saringan cabang dan rentang rincian (hari ini, 7 hari, 30 hari).
- Rekap bulanan per barang (`sumber` dan `baris_id`) dan cabang untuk satu bulan WIB: masuk (jumlah `detail_barang_masuk` menurut tanggal terima), terjual (unit dari transaksi selesai), nilai terjual (bersih), penyesuaian (jumlah `buku_stok` tipe `opname` dan `koreksi` di bulan itu, bisa minus), dan stok sekarang. Jasa tidak ikut karena tidak punya stok.

## Ekspor CSV untuk tim data

Unduhan di `/api/kasir/ekspor?jenis=<jenis>&dari=YYYY-MM-DD&sampai=YYYY-MM-DD` (route handler, runtime Node). Sesi dicek ulang ke database tiap unduhan, selain owner ditolak (401 atau 403). Jawabannya `Cache-Control: no-store, private`, dan tiap unduhan tercatat di `log_aktivitas` (`ekspor_csv`). Rentang paling panjang dua tahun, tanggal dalam WIB.

Format: UTF-8 tanpa BOM, pemisah koma, baris diakhiri CRLF, baris pertama nama kolom. Sel teks yang diawali `=`, `+`, `-`, `@`, tab, atau CR diberi awalan `'` supaya spreadsheet tidak menjalankannya sebagai rumus. Angka ditulis apa adanya (angka minus tetap angka). Sel yang memuat koma, kutip, atau baris baru dikutip.

`penjualan`: satu baris per minggu, cabang, barang, dan channel, dari transaksi selesai.

| Kolom | Arti |
|---|---|
| `minggu_mulai` | Senin (WIB) awal minggu, `YYYY-MM-DD` |
| `cabang_id`, `cabang` | id dan nama pendek cabang |
| `sumber` | `ban`, `produk`, atau `jasa` |
| `kode_produk` | kode `StockTire`, kode produk (slug kalau kosong), atau `jasa:<id>` (`jasa:<id>:alt` untuk pilihan kedua) |
| `nama` | nama barang saat transaksi |
| `channel` | `toko` atau `whatsapp` |
| `jumlah` | unit terjual |
| `transaksi` | jumlah transaksi berbeda yang memuat barang itu |
| `nilai_harga_asli` | jumlah x harga satuan, sebelum diskon |
| `diskon` | bagian diskon nota untuk baris itu (`detail_transaksi.diskon`) |
| `nilai_bersih` | `nilai_harga_asli - diskon` |
| `harga_asli_rata` | `nilai_harga_asli / jumlah`, dibulatkan |
| `harga_efektif_rata` | `nilai_bersih / jumlah`, dibulatkan |
| `sempat_habis` | `1` kalau stok barang itu di cabang itu turun ke 0 di minggu itu menurut `buku_stok`, `0` kalau tidak, kosong untuk jasa |

`stok-habis`: satu baris per kejadian di `buku_stok` saat stok turun ke 0 atau naik lagi dari 0. Barang yang habis sepanjang minggu tidak muncul di `penjualan` (karena tidak ada yang terjual), jadi berkas ini dipakai untuk menghitung lama stok kosong.

| Kolom | Arti |
|---|---|
| `waktu_wib` | waktu kejadian, `YYYY-MM-DD HH:MM` WIB |
| `minggu_mulai` | Senin awal minggu kejadian |
| `cabang_id`, `cabang` | cabang baris stok (kosong untuk ban tanpa cabang) |
| `kode_produk` | kode barang di `buku_stok` |
| `kejadian` | `habis` (saldo menjadi 0 atau kurang) atau `tersedia` (saldo naik dari 0) |
| `tipe` | tipe `buku_stok` penyebabnya: `jual`, `void`, `masuk`, `opname`, `koreksi`, `impor` |
| `perubahan`, `saldo_akhir` | perubahan stok dan saldo sesudahnya |

`barang-masuk`: satu baris per barang yang diterima, menurut tanggal terima.

| Kolom | Arti |
|---|---|
| `nomor_penerimaan` | nomor `BM-...` |
| `cabang_id`, `cabang` | cabang penerima |
| `pemasok`, `jenis_pemasok` | nama pemasok, `distributor` atau `rekanan` |
| `tanggal_pesan`, `tanggal_terima` | `YYYY-MM-DD` WIB, tanggal pesan boleh kosong |
| `lead_time_hari` | hari dari tanggal pesan ke tanggal terima, kosong kalau tanggal pesan kosong |
| `sumber`, `kode_produk`, `nama` | barang yang diterima |
| `jumlah` | unit diterima |
| `harga_beli` | harga beli per unit dari pemasok, boleh kosong |
| `harga_jual_usulan` | harga jual yang diisi pencatat |
| `harga_lama` | harga lama barang saat dicatat (lihat bagian harga jual) |
| `harga_batch` | harga jual batch itu sekarang |
| `status_harga` | `tetap` (sama dengan harga lama), `langsung` (owner memakai harga sendiri), atau status pengajuan: `menunggu`, `disetujui`, `ditolak` |

## Riwayat dan rekap harian

Riwayat menyaring tanggal (WIB) dan cabang, plus status void. Rekap rentang itu per cabang: jumlah transaksi selesai, total per metode bayar untuk tutup kas, total diskon, dan jumlah void. Admin cabang hanya melihat cabangnya.

## Realtime

Server-Sent Events dari `/api/kasir/siaran` (route handler, runtime Node) dengan pemancar di dalam proses (`src/lib/kasir/siaran.ts`), karena aplikasi berjalan sebagai satu proses di VPS. Yang disiarkan: perubahan stok (layar kasir dan daftar stok memuat ulang data), transaksi baru dan void (Riwayat), pengajuan diskon baru (owner), keputusan owner (admin pengaju), dan peringatan stok. Admin cabang hanya menerima siaran cabangnya. Kalau koneksi putus, browser menyambung ulang sendiri, dan layar memuat ulang data saat tab aktif kembali. Kalau nanti aplikasi berjalan lebih dari satu proses, isi `siarkan()` dan `dengar()` diganti `LISTEN/NOTIFY` PostgreSQL.

Caddy meneruskan respons streaming tanpa penyangga, dan route mengirim komentar detak tiap 25 detik supaya koneksi diam tidak ditutup.

## Web app

`/kasir.webmanifest` dipasang dari bagian Kasir dan halaman nota: nama "Kasir Bejo Ban", ikon dari logo yang ada (`icon-192.png`, `icon-512.png`), `start_url` `/admin/kasir`, tampilan `standalone`. Halaman lain tetap memakai manifest situs. Mode offline belum ada.

## Skema

Migrasi `prisma/migrations/20261121000000_kasir_v1`. Semua aditif.

Kolom baru:

| Tabel | Kolom | Keterangan |
|---|---|---|
| `Branch` | `kode_nota` | unik, boleh kosong sampai kasir diaktifkan |
| `Branch` | `mode_stok` | `sheet` (bawaan) atau `kasir` |
| `Branch` | `kasir_aktif_sejak` | waktu pengaktifan |
| `StockTire` | `batas_minimum` | boleh kosong |
| `Listing` | `batas_minimum` | boleh kosong |

Tabel baru:

- `transaksi`: `nomor` (unik), `cabang_id`, `pengguna_id`, `nama_kasir`, `channel` (`toko`, `whatsapp`), `metode_bayar` (`tunai`, `qris`, `debit`), `subtotal`, `diskon`, `alasan_diskon`, `total`, `dibayar`, `kembalian`, `status` (`selesai`, `void`), `alasan_void`, `divoid_oleh`, `waktu_void`, `idempotency_key` (unik), `waktu_transaksi`.
- `detail_transaksi`: satu baris per batch. `transaksi_id`, `sumber` (`ban`, `produk`, `jasa`), `kode_produk`, `baris_id` (id `StockTire` atau `Listing`, kosong untuk jasa), `nama` (salinan saat transaksi), `jumlah`, `harga_satuan`, `harga_asli`, `diskon`, `subtotal` (jumlah x harga satuan, sebelum diskon), `batch_id`, `pengajuan_harga_id`. Harga efektif per unit = (`subtotal` - `diskon`) / `jumlah`.
- `batch_stok`: `sumber`, `kode_produk`, `baris_id`, `cabang_id`, `jenis` (`awal`, `koreksi`, `masuk`, `opname`), `detail_barang_masuk_id`, `harga_beli`, `harga_jual`, `jumlah_awal`, `sisa`, `tanggal_masuk`.
- `pengajuan_harga`: `tipe` (`diskon`, `restock`), `cabang_id`, `sumber`, `kode_produk`, `pengaju_id`, `harga_lama`, `harga_baru`, `alasan`, `status` (`menunggu`, `disetujui`, `ditolak`, `batal`), `penyetuju_id`, `diputuskan`, `batch_id`, `detail_transaksi_id`, `transaksi_id`, `dibuat`. Untuk diskon nota, `harga_lama` = subtotal dan `harga_baru` = total. Untuk restock, `harga_lama` = harga lama barang, `harga_baru` = usulan, dan `batch_id` = batch yang diajukan.
- `riwayat_harga`: `sumber`, `kode_produk`, `cabang_id`, `batch_id`, `harga_lama`, `harga`, `pengguna`, `berlaku_mulai`.
- `peringatan_stok`: `sumber`, `baris_id`, `kode_produk`, `cabang_id`, `jumlah_saat_itu`, `batas_minimum`, `status` (`aktif`, `ditutup`), `dibuat`, `ditutup`.
- `penghitung_nota`: `cabang_id`, `tanggal` (`YYMMDD` WIB), `nomor`.

Migrasi bagian 2: `prisma/migrations/20261122000000_kasir_v1_bagian_2`, juga aditif. Tabel baru:

- `barang_masuk`: `nomor_penerimaan` (unik), `cabang_id`, `pemasok`, `jenis_pemasok` (`distributor`, `rekanan`), `tanggal_pesan` (boleh kosong), `tanggal_terima` (keduanya pukul 00.00 WIB tanggal itu), `pengguna_id`, `nama_pengguna`, `catatan`, `idempotency_key` (unik), `dibuat`.
- `detail_barang_masuk`: `barang_masuk_id`, `sumber` (`ban`, `produk`), `kode_produk`, `baris_id`, `cabang_id`, `nama`, `jumlah` (CHECK > 0), `harga_beli`, `harga_jual` (yang diisi pencatat), `harga_lama`, `batch_id`, `pengajuan_harga_id`.
- `penghitung_penerimaan`: `cabang_id`, `tanggal` (`YYMMDD` WIB), `nomor`.
- `stok_opname`: `cabang_id`, `penginput_id`, `nama_penginput`, `status` (CHECK `draft`, `review`, `final`), `tanggal`, `catatan`, `dikirim`, `finalisator_id`, `difinalkan`.
- `detail_opname`: `opname_id` (hapus ikut opname draft), `sumber`, `kode_produk`, `baris_id`, `nama`, `stok_sistem`, `stok_fisik`, `selisih` (CHECK = fisik - sistem, fisik >= 0), `alasan_selisih`, `diisi`, `stok_saat_final`, `stok_akhir`. Unik per opname, sumber, dan baris.

`cabang_id` dan `pengguna_id` di tabel kasir sengaja tanpa relasi, sama seperti `buku_stok`, supaya riwayat tetap ada walau akun dihapus.

## Kode

- `src/lib/kasir/logika.ts`: logika murni (FIFO, pemecahan per batch, pembagian diskon, hitungan nota, nomor, tanggal WIB, syarat void, invarian, keputusan peringatan). Tesnya `tests/kasir-logika.test.ts`.
- `src/lib/kasir/stok.ts`: kunci, batch, pengaktifan, koreksi, harga batch, batas minimum, pemeriksa invarian.
- `src/lib/kasir/transaksi.ts`: jual, void, keputusan diskon.
- `src/lib/kasir/masuk.ts`: barang masuk dan keputusan harga restock.
- `src/lib/kasir/opname.ts`: opname dari mulai sampai final.
- `src/lib/kasir/analitik.ts` dan `src/app/api/kasir/ekspor/route.ts`: dashboard, rekap bulanan, dan ekspor CSV.
- `src/lib/kasir/katalog.ts` dan `cari.ts`: katalog dan pencarian layar kasir.
- `src/lib/kasir/siaran.ts` dan `src/app/api/kasir/siaran/route.ts`: realtime.
- `src/lib/stok/ubah.ts`: jalur stok bersama, sekarang dengan penjaga mode kasir dan peringatan stok.
- Tes basis data: `tests/kasir-db.test.ts` (bagian 1) dan `tests/kasir-bagian2-db.test.ts` (barang masuk, restock, opname, balapan, dashboard, rekap, CSV, invarian acak).

## Beda dengan ERD Asah (untuk penyelarasan v2)

- `produk_id` diganti pasangan `sumber` dan `kode_produk`, karena katalog ban (pricelist) dan produk situs belum disatukan. Di `batch_stok`, `detail_transaksi`, dan `peringatan_stok` ada juga `baris_id` (id baris stok) supaya baris bisa dikunci dan dicari tanpa bergantung pada kode.
- `STOK_CABANG` belum menjadi tabel sendiri. Kolomnya (`jumlah`, `batas_minimum`) ada di `StockTire` dan `Listing`. `peringatan_stok` menunjuk ke baris itu lewat `sumber` dan `baris_id`, bukan `stok_cabang_id`.
- Uang `Int` rupiah, bukan decimal.
- Diskon per nota yang dibagi ke baris, bukan pengajuan diskon per item sebelum transaksi. Dasarnya keputusan tim di channel keputusan, yang didahulukan dari papan Draf 2.
- Server-Sent Events, bukan Socket.IO.
- PostgreSQL, bukan MySQL.
- Kolom tambahan di `transaksi`: `subtotal`, `diskon`, `alasan_diskon`, `dibayar`, `kembalian`, `divoid_oleh`, `waktu_void`, dan `nama_kasir`. Di `detail_transaksi`: `sumber`, `kode_produk`, `baris_id`, `nama`. Di `batch_stok`: `sumber`, `kode_produk`, `baris_id`, `jenis`. Di `pengajuan_harga`: `cabang_id`, `transaksi_id`, `dibuat`, dan status `batal`. Di `riwayat_harga`: `cabang_id`, `batch_id`, `harga_lama`, `pengguna`.
- `harga_satuan` di `detail_transaksi` sama dengan `harga_asli` di v1, karena harga per item tidak bisa diubah di kasir.
- Tabel baru `penghitung_nota` untuk nomor transaksi per cabang per hari, dan `penghitung_penerimaan` untuk nomor barang masuk.
- `barang_masuk`: `cabang_id` di kepala (satu penerimaan untuk satu cabang, supaya nomornya urut per cabang). `cabang_id` di `detail_barang_masuk` tetap ada seperti ERD dan selalu sama dengan kepala. Kolom tambahan `nama_pengguna`, `catatan`, `idempotency_key`, `dibuat`. Nilai `jenis_pemasok`: `distributor` atau `rekanan`.
- `detail_barang_masuk`: `produk_id` diganti `sumber`, `kode_produk`, dan `baris_id`. Kolom tambahan `nama`, `harga_lama`, `batch_id`, dan `pengajuan_harga_id`. `harga_jual` berisi harga yang diisi pencatat. Harga yang benar-benar dipakai ada di `batch_stok.harga_jual`.
- `stok_opname`: `penginput_id` seperti ERD, plus `nama_penginput`, `catatan`, `dikirim`, `finalisator_id`, `difinalkan`. `detail_opname`: `produk_id` diganti `sumber`, `kode_produk`, `baris_id`, plus `nama`, `diisi`, `stok_saat_final`, `stok_akhir`.
- Opname menerapkan selisih ke stok saat final (bukan menimpa dengan stok fisik), supaya penjualan selama opname tidak hilang.
- Nilai `channel` dan `metode_bayar` ditulis huruf kecil (`whatsapp`, `qris`).

## Di luar v1

Forecasting dan rekomendasi restock (ekspor CSV disiapkan untuk itu), impor data historis dari aplikasi kasir lama, pemindahan stok antar cabang, mode offline, printer thermal khusus, EDC, data pelanggan, dan jalan kembali dari mode kasir ke mode sheet.
