# Kasir (POS) v1

Kasir web Bejo Ban, bagian 1: katalog dan transaksi, mode stok per cabang, nota digital, riwayat dan void, diskon nota, harga batch, peringatan stok menipis, siaran realtime, dan manifest web app. Barang masuk, opname, dashboard owner, rekap bulanan, dan ekspor CSV dikerjakan di bagian 2.

Kasir bagian dari aplikasi admin yang sama, di `/admin/kasir`, dengan login, akun, dan cabang yang sudah ada. Rancangannya mengikuti rancangan BejoStock dari tim Asah (ERD Draf 2 dan keputusan tim), dengan perbedaan yang dicatat di bagian terakhir dokumen ini supaya penyelarasan v2 mudah.

## Peran

| Fitur | Admin cabang | Owner |
|---|---|---|
| Lihat stok cabang lain di layar kasir | ya | ya |
| Transaksi kasir | cabang sendiri | semua cabang bermode kasir |
| Diskon nota | boleh, masuk antrean tinjau owner | langsung, tercatat di log aktivitas |
| Void | cabang sendiri, hari yang sama (WIB), alasan wajib | kapan saja, alasan wajib |
| Ubah harga jual batch | tidak | ya |
| Batas minimum | tidak | ya |
| Aktifkan kasir per cabang | tidak | ya |
| Koreksi stok di mode kasir | tidak | ya, alasan wajib |
| Riwayat transaksi | cabang sendiri | semua cabang |

Semua cek peran dijalankan di server (`src/lib/kasir/transaksi.ts` dan `src/app/admin/kasir-actions.ts`). Permintaan admin untuk cabang lain ditolak walau formulirnya diubah.

## Menu

Sidebar hanya bertambah satu menu, Kasir. Isinya tab:

- Transaksi baru (`/admin/kasir`), semua peran.
- Riwayat (`/admin/kasir/riwayat`), semua peran.
- Tinjau diskon (`/admin/kasir/diskon`), owner.
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
- `ubahStokTx` menolak perubahan stok baris cabang bermode kasir yang tidak datang dari modul kasir (`jalurKasir`). Ini penjaga terakhir kalau ada jalur lama yang terlewat.
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

1. `kunciSusunanStok` (advisory lock), hanya untuk impor, tetapkan cabang, isi kode kosong, dan pengaktifan kasir;
2. baris `Branch`: `FOR SHARE` untuk jual, void, koreksi, dan ubah harga batch, `FOR UPDATE` saat pengaktifan;
3. baris stok (`StockTire` lalu `Listing`, urut id) `FOR UPDATE`;
4. baris `batch_stok` `FOR UPDATE`.

Dua penjualan bersamaan untuk unit terakhir: yang kedua menunggu kunci baris, lalu membaca sisa batch 0 dan ditolak. Ada juga `CHECK (sisa >= 0 AND sisa <= jumlah_awal)` di `batch_stok` dan update bersyarat `sisa >= jumlah`.

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
- Koreksi stok oleh owner (alasan wajib): pengurangan memakai FIFO, penambahan membuat batch `koreksi` dengan harga yang diisi atau harga batch terdepan. Sampai fitur barang masuk tersedia (bagian 2), barang datang dicatat lewat koreksi ini.

## Void

- Admin: transaksi cabang sendiri di hari WIB yang sama dengan transaksi. Owner: kapan saja. Alasan wajib.
- Status `void`, alasan, siapa, dan kapan disimpan. Tiap baris detail mengembalikan jumlahnya ke batch yang sama, stok baris naik, `buku_stok` mencatat tipe `void`. Harga baris disamakan lagi dan peringatan stok dicek ulang. Nota menampilkan VOID.
- Transaksi yang sudah void tidak bisa di-void lagi.

## Peringatan stok menipis

- `batas_minimum` di `StockTire` dan `Listing`, boleh kosong (tanpa peringatan). Hanya owner yang mengatur, di halaman barang.
- Diperiksa di `ubahStokTx` sesudah tiap perubahan stok, dari jalur mana pun: kalau stok turun ke batas atau di bawahnya dan belum ada peringatan aktif, terbentuk `peringatan_stok` berstatus `aktif` dengan `jumlah_saat_itu`. Kalau sudah ada yang aktif, tidak membuat baru. Kalau stok naik di atas batas, peringatan ditutup. Mengubah batas juga langsung memeriksa.
- Tampil di Perlu dicek (bagian Stok menipis) dan dihitung di angka tab. Peringatan baru dari kasir disiarkan sebagai notifikasi ke admin cabang itu dan owner.

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
- `batch_stok`: `sumber`, `kode_produk`, `baris_id`, `cabang_id`, `jenis` (`awal`, `koreksi`, nanti `masuk` dan `opname`), `detail_barang_masuk_id`, `harga_beli`, `harga_jual`, `jumlah_awal`, `sisa`, `tanggal_masuk`.
- `pengajuan_harga`: `tipe` (`diskon`, nanti `restock`), `cabang_id`, `sumber`, `kode_produk`, `pengaju_id`, `harga_lama`, `harga_baru`, `alasan`, `status` (`menunggu`, `disetujui`, `ditolak`, `batal`), `penyetuju_id`, `diputuskan`, `batch_id`, `detail_transaksi_id`, `transaksi_id`, `dibuat`. Untuk diskon nota, `harga_lama` = subtotal dan `harga_baru` = total.
- `riwayat_harga`: `sumber`, `kode_produk`, `cabang_id`, `batch_id`, `harga_lama`, `harga`, `pengguna`, `berlaku_mulai`.
- `peringatan_stok`: `sumber`, `baris_id`, `kode_produk`, `cabang_id`, `jumlah_saat_itu`, `batas_minimum`, `status` (`aktif`, `ditutup`), `dibuat`, `ditutup`.
- `penghitung_nota`: `cabang_id`, `tanggal` (`YYMMDD` WIB), `nomor`.

`cabang_id` dan `pengguna_id` di tabel kasir sengaja tanpa relasi, sama seperti `buku_stok`, supaya riwayat tetap ada walau akun dihapus.

## Kode

- `src/lib/kasir/logika.ts`: logika murni (FIFO, pemecahan per batch, pembagian diskon, hitungan nota, nomor, tanggal WIB, syarat void, invarian, keputusan peringatan). Tesnya `tests/kasir-logika.test.ts`.
- `src/lib/kasir/stok.ts`: kunci, batch, pengaktifan, koreksi, harga batch, batas minimum, pemeriksa invarian.
- `src/lib/kasir/transaksi.ts`: jual, void, keputusan diskon.
- `src/lib/kasir/katalog.ts` dan `cari.ts`: katalog dan pencarian layar kasir.
- `src/lib/kasir/siaran.ts` dan `src/app/api/kasir/siaran/route.ts`: realtime.
- `src/lib/stok/ubah.ts`: jalur stok bersama, sekarang dengan penjaga mode kasir dan peringatan stok.
- Tes basis data: `tests/kasir-db.test.ts`.

## Beda dengan ERD Asah (untuk penyelarasan v2)

- `produk_id` diganti pasangan `sumber` dan `kode_produk`, karena katalog ban (pricelist) dan produk situs belum disatukan. Di `batch_stok`, `detail_transaksi`, dan `peringatan_stok` ada juga `baris_id` (id baris stok) supaya baris bisa dikunci dan dicari tanpa bergantung pada kode.
- `STOK_CABANG` belum menjadi tabel sendiri. Kolomnya (`jumlah`, `batas_minimum`) ada di `StockTire` dan `Listing`. `peringatan_stok` menunjuk ke baris itu lewat `sumber` dan `baris_id`, bukan `stok_cabang_id`.
- Uang `Int` rupiah, bukan decimal.
- Diskon per nota yang dibagi ke baris, bukan pengajuan diskon per item sebelum transaksi. Dasarnya keputusan tim di channel keputusan, yang didahulukan dari papan Draf 2.
- Server-Sent Events, bukan Socket.IO.
- PostgreSQL, bukan MySQL.
- Kolom tambahan di `transaksi`: `subtotal`, `diskon`, `alasan_diskon`, `dibayar`, `kembalian`, `divoid_oleh`, `waktu_void`, dan `nama_kasir`. Di `detail_transaksi`: `sumber`, `kode_produk`, `baris_id`, `nama`. Di `batch_stok`: `sumber`, `kode_produk`, `baris_id`, `jenis`. Di `pengajuan_harga`: `cabang_id`, `transaksi_id`, `dibuat`, dan status `batal`. Di `riwayat_harga`: `cabang_id`, `batch_id`, `harga_lama`, `pengguna`.
- `harga_satuan` di `detail_transaksi` sama dengan `harga_asli` di v1, karena harga per item tidak bisa diubah di kasir.
- Tabel baru `penghitung_nota` untuk nomor transaksi per cabang per hari.
- Nilai `channel` dan `metode_bayar` ditulis huruf kecil (`whatsapp`, `qris`).

## Di luar v1

Forecasting dan rekomendasi restock, impor data historis dari aplikasi kasir lama, pemindahan stok antar cabang, mode offline, printer thermal khusus, EDC, data pelanggan, dan jalan kembali dari mode kasir ke mode sheet.
