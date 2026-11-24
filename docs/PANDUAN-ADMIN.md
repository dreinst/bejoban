# Panduan Admin Bejo Ban

Halaman admin ada di `/admin`. Ada dua peran, owner dan admin cabang.

## Menu dan tab

Sidebar berisi paling banyak tujuh menu, tanpa judul kelompok. Tiap menu punya tab di bagian atas halaman, dan tiap tab punya alamat sendiri. Susunan menu, tab, dan hak owner diatur di satu berkas, `src/lib/admin-menu.ts`, beserta tesnya di `tests/menu.test.ts`. Di layar kecil menu dibuka dengan tombol di bilah atas, dan tab bisa digeser ke samping.

Nama pengguna, *Lihat situs*, *Akun saya*, dan *Keluar* ada di satu menu profil di bawah sidebar. Admin cabang juga mendapat *Data cabang saya* di sana.

| Menu | Tab (alamat) | Owner | Admin cabang |
| --- | --- | --- | --- |
| Ringkasan | tanpa tab (`/admin`) | ya | ya, cabangnya |
| Kasir | Transaksi baru (`/admin/kasir`) | ya, pilih cabang | ya, cabangnya |
| | Riwayat (`/admin/kasir/riwayat`, nota di `/admin/nota/[id]`) | ya | ya, cabangnya |
| | Barang masuk (`/admin/kasir/masuk`) | ya, semua cabang kasir | ya, cabangnya |
| | Opname (`/admin/kasir/opname`) | ya, tinjau dan finalkan | ya, isi cabangnya |
| | Tinjau pengajuan (`/admin/kasir/pengajuan`, dulu `/admin/kasir/diskon`) | ya | tidak |
| | Dashboard (`/admin/kasir/dashboard`) | ya | tidak |
| | Rekap dan ekspor (`/admin/kasir/rekap`) | ya | tidak |
| | Pengaturan kasir (`/admin/kasir/pengaturan`, juga `/admin/kasir/barang`) | ya | tidak |
| Stok dan harga | Stok ban (`/admin/stok-ban`) | ya | tidak |
| | Harga jasa (`/admin/harga-jasa`) | ya | tidak |
| | Produk situs (`/admin/harga`, juga `/admin/produk/baru` dan `/admin/produk/[id]`) | ya | ya, harga dan stok cabangnya |
| | Perlu dicek (`/admin/peringatan`) | ya | ya, cabangnya |
| Chatbot | Percakapan (`/admin/chatbot`) | ya | ya, percakapan cabangnya |
| | Kotak uji (`/admin/chatbot/uji`) | ya | tidak |
| | Templat pesan (`/admin/chatbot/templat`) | ya | tidak |
| | Pengaturan bot (`/admin/chatbot/pengaturan`) | ya | tidak |
| | Cermin chat (`/admin/chatbot/cermin`) | ya | tidak |
| Ongkir | Hitung ongkir (`/admin/ongkir`) | ya | ya |
| | Tarif (`/admin/ongkir/tarif`) | ya | tidak |
| | Pengaturan (`/admin/ongkir/pengaturan`) | ya | tidak |
| Situs | Tampilan beranda (`/admin/konten`) | ya | tidak |
| | Merek (`/admin/merek`) | ya | tidak |
| | Kategori (`/admin/kategori`) | ya | tidak |
| | Tautan WhatsApp (`/admin/situs`) | ya | tidak |
| Pengaturan | Cabang (`/admin/cabang`) | ya | lewat menu profil, data cabangnya saja |
| | Pengguna (`/admin/pengguna`) | ya | tidak |

Menu dan tab yang bukan hak pengguna tidak ditampilkan sama sekali. Penyaringan ini hanya tampilan: setiap halaman dan aksi tetap memeriksa sesi dan peran di server, jadi alamat owner yang diketik admin cabang dialihkan ke Ringkasan dengan pesan tidak punya akses. Kalau menu hanya punya satu tab untuk peran itu (misalnya Chatbot dan Ongkir bagi admin cabang), bilah tab tidak ditampilkan.

Halaman *Kalender libur dan promo* (`/admin/kalender`) disembunyikan dari menu karena datanya belum dipakai bot maupun situs. Halaman dan datanya tetap ada, dan owner masih bisa membukanya lewat alamat itu.

*Akun saya* (`/admin/akun`) dan *Panduan ukuran foto* (`/admin/panduan-foto`) tidak masuk menu. Panduan foto dibuka dari tautan kecil *Panduan ukuran* di bawah setiap kolom unggah foto (terbuka di tab baru supaya isian form tidak hilang).

### Alamat lama

| Alamat lama | Sekarang |
| --- | --- |
| `/admin/produk` (daftar produk) | dialihkan ke `/admin/harga` (Produk situs) |
| `/admin/pengaturan/whatsapp` | dialihkan ke `/admin/chatbot/pengaturan` (menu Chatbot, tab Pengaturan bot) |
| Kotak uji di `/admin/chatbot` | pindah ke `/admin/chatbot/uji` |
| `/admin/pengaturan/ongkir` dan bagian pengaturan di `/admin/ongkir/tarif#pengaturan` | dialihkan ke `/admin/ongkir/pengaturan` (menu Ongkir, tab Pengaturan) |
| Menu *Panduan Ukuran Foto* | dihapus dari sidebar, halamannya tetap ada |

Pengalihan dipasang di `next.config.ts` dari daftar `LEGACY_REDIRECTS` di `src/lib/admin-menu.ts`, sebagai pengalihan sementara (307). Alamat lain tidak berubah.

### Cara kerja halaman daftar

Semua halaman daftar (merek, kategori, cabang, pengguna, tarif, harga jasa, kalender, stok) memakai pola yang sama. Aturan lengkap untuk pengembang ada di `docs/STANDAR-UI-ADMIN.md`.

- Tiap item satu baris di tabel. Di HP baris berubah jadi kartu dua baris dengan tombol *Ubah* di kanan. Aksi yang jarang dipakai (*Hapus*, urutan naik turun, sakelar *By order*) ada di tombol *...* di sebelahnya. Di Stok ban, saringan Ring, Cabang, dan Keadaan berupa tiga pilihan berlabel yang langsung berlaku saat dipilih.
- *+ Tambah ...* di kanan atas dan *Ubah* di ujung baris membuka panel di sisi kanan. Panel tertutup sendiri setelah tersimpan, atau dengan Escape, tombol silang, atau klik di luar panel. Pesan singkat muncul di pojok kanan bawah. Kalau simpan ditolak (mis. nama kosong), panel tetap terbuka, isian yang sudah diketik tetap ada, dan alasannya tampil di dasar panel dekat tombol simpan. Foto yang baru diunggah di panel itu perlu dipilih lagi.
- Urutan diatur dengan tombol panah naik dan turun di kolom *Urutan*. Urutannya langsung tersimpan dan sama dengan urutan di situs. Saat pencarian aktif, tombol urutan disembunyikan.
- *Hapus* selalu membuka dialog yang menyebut nama item dan akibatnya. Item yang masih dipakai (mis. merek yang dipakai produk) tidak bisa dihapus. Dialognya menawarkan *Nonaktifkan*.
- Item nonaktif tetap ada di tabel dengan lencana *Nonaktif* dan tombol *Aktifkan*. Untuk merek dan kategori, isian *Tampil di situs* di panel *Ubah* melakukan hal yang sama tanpa lewat tombol Hapus.
- Admin cabang membuka *Data cabang saya* (menu profil, atau kartu di Ringkasan) dan langsung melihat formnya tanpa tabel.

### Ringkasan

Ringkasan hanya menampilkan angka yang perlu ditindaklanjuti, dan tiap kartu membuka halamannya: percakapan menunggu admin, stok ban habis, harga ban perlu diisi, produk dijual tanpa harga (hanya bila sakelar harga di situs menyala), dan produk tanpa foto. Kartu bernilai 0 disembunyikan. Kalau semuanya 0, tampil kalimat "Semua beres". Owner juga melihat klik WhatsApp per cabang 7 hari terakhir (membuka Tautan WhatsApp) dan sinkron pricelist terakhir (membuka Stok ban). Admin cabang hanya melihat angka cabangnya.

### Perlu dicek

Tab *Perlu dicek* mendaftar ban yang harganya kosong atau tidak terbaca, dan produk dijual tanpa harga bila sakelar harga di situs menyala. Hanya dua hal itu yang dihitung di angka kecil pada tab. Stok ban yang habis dan produk situs berstok 0 bukan masalah (situs dan bot menjawabnya lewat WhatsApp), jadi hanya muncul sebagai satu baris keterangan dengan tautan. Kalau tidak ada yang perlu ditindak, angka hilang dan halaman menulis "Semua beres". Harga 0 selalu boleh disimpan; di situs harga 0 tidak pernah tampil sebagai "Rp 0", yang tampil ajakan tanya harga lewat WhatsApp. Admin cabang hanya melihat cabangnya; stok dan harga ban tetap diperbaiki owner di *Stok ban*.

### Produk situs

Gabungan halaman Produk dan Pricelist & Stok lama. Pilih cabang (owner), ubah harga jual, harga coret, stok, Dijual, dan Flash untuk banyak produk sekaligus, lalu *Simpan harga dan stok*. Bilah simpan menempel di dasar halaman, muncul hanya kalau ada isian yang diubah, dan menyebut berapa baris yang berubah. Bawaannya hanya produk yang tampil di situs. Ada pencarian nama dan saringan *Stok 0*, *Tanpa foto*, dan *Disembunyikan (N)* untuk produk yang disembunyikan, termasuk produk contoh. Harga 0 boleh disimpan; di situs harga 0 tampil sebagai ajakan tanya harga lewat WhatsApp, juga saat sakelar harga menyala. *+ Tambah produk* dan *Ubah detail* membuka halaman detail produk (nama, kategori, merek, foto, deskripsi).

Produk dengan label **contoh** adalah data isian awal. Ganti nama, harga, dan fotonya, lalu hilangkan centang *Tandai sebagai produk contoh*, atau hapus produknya.

### Form panjang

Halaman *Tautan WhatsApp*, *Pengaturan bot*, dan *Pengaturan ongkir* dipecah per bagian. Tiap bagian punya tombol simpan sendiri dan hanya menyimpan bagian itu.

## Kasir

Kasir dipakai untuk mencatat penjualan di toko dan lewat WhatsApp. Rincian aturan dan skemanya ada di [KASIR.md](KASIR.md).

### Sebelum kasir dipakai

- Owner mengaktifkan kasir per cabang di **Kasir, Pengaturan kasir**. Isi kode nota (2 sampai 5 huruf, misalnya `BTU`), centang pernyataan, lalu tekan *Aktifkan kasir*. Stok dan harga yang ada saat itu menjadi batch awal.
- Ban yang belum punya cabang tidak bisa dijual kasir. Tetapkan dulu di Stok ban kalau ban itu milik cabang yang akan diaktifkan.
- Sesudah aktif, stok cabang itu hanya berubah lewat kasir (penjualan, void, barang masuk, opname, dan koreksi owner). Impor dan sinkron pricelist untuk cabang itu ditolak, dan isian harga serta stok di Stok ban dan Produk situs terkunci. Belum ada jalan kembali ke mode sheet.
- Kasir bisa dipasang sebagai aplikasi di HP, tablet, atau PC. Buka Kasir di Chrome, lalu pilih *Instal aplikasi* atau *Tambahkan ke layar utama*.

### Mencatat penjualan

1. Buka **Kasir**. Admin cabang langsung memakai cabangnya. Owner memilih cabang kalau lebih dari satu yang aktif.
2. Ketik ukuran, merek, nama, atau kode di kolom cari. `185 65 15` menemukan `185/65 R15`. Tekan barangnya, atau tekan Enter untuk menambah hasil pertama. Pemindai barcode juga bisa dipakai.
3. Atur jumlah dengan tombol minus dan plus. Kalau jumlah melebihi stok, layar menyebut stok di cabang lain.
4. Pilih channel (Toko atau WhatsApp) dan metode bayar (Tunai, QRIS, Debit). Untuk tunai, isi uang diterima atau tekan *Uang pas*. Kembalian tampil di bawah total.
5. Tekan *Bayar*, periksa ringkasannya, lalu *Simpan transaksi*. Nota langsung terbuka.

Harga yang tampil adalah harga batch yang akan terjual. Kalau stok satu barang berasal dari dua batch dengan harga berbeda, keranjang menulis keduanya, misalnya `1 × Rp 100.000 + 2 × Rp 120.000`. Semua harga sudah termasuk pajak.

Kalau koneksi putus saat menyimpan, tekan *Simpan transaksi* lagi. Nota yang sama tidak akan tercatat dua kali.

### Diskon

Isi *Diskon nota* dalam rupiah dan alasannya. Transaksi tetap jalan. Diskon dari admin cabang masuk antrean **Tinjau pengajuan** untuk owner. Owner menandai *Setujui* atau *Tolak*, dan transaksinya tidak berubah. Kalau nota perlu dibatalkan, owner membuka notanya lalu void. Diskon dari owner langsung berlaku dan tercatat di log.

### Nota

Halaman nota punya tombol *Cetak* (pilih kertas 58 mm, 80 mm, atau A4 dulu), *Bagikan* (di HP membuka pilihan kirim, misalnya WhatsApp), dan *Salin teks* untuk ditempel ke chat pelanggan.

### Void

Buka nota dari **Riwayat**, tekan *Void transaksi*, tulis alasannya, lalu konfirmasi. Stok kembali ke batch asalnya dan nota diberi tanda VOID. Admin cabang hanya bisa void transaksi cabangnya di hari yang sama. Transaksi hari sebelumnya di-void owner.

### Riwayat dan tutup kas

**Riwayat** menampilkan transaksi hari ini. Ganti tanggal atau cabang lalu tekan *Terapkan*. Rekap di atas daftar menyebut total per metode bayar, jumlah transaksi, diskon, dan void per cabang, untuk dicocokkan dengan uang di laci dan mutasi QRIS atau debit.

### Harga batch, koreksi stok, dan batas minimum (owner)

Di **Pengaturan kasir**, cari barangnya lalu tekan *Buka*. Tombol yang sama ada di panel Ubah Stok ban dan tombol *Batch* di Produk situs.

- *Ubah harga* di baris batch mengganti harga jual batch itu saja. Batch lain tetap.
- *Koreksi stok* menyetel stok ke angka baru dengan alasan wajib. Pengurangan diambil dari batch tertua. Penambahan menjadi batch baru dengan harga yang diisi, atau harga batch terdepan kalau dikosongkan. Pakai untuk membetulkan selisih di luar opname. Barang yang datang dicatat lewat **Barang masuk**, bukan lewat koreksi.
- *Batas minimum* memunculkan peringatan *Stok menipis* di Perlu dicek kalau stok turun ke angka itu atau di bawahnya, dan notifikasi ke admin cabang serta owner. Kosongkan untuk mematikan.
- *Periksa sekarang* di Pengaturan kasir memastikan stok dan harga tiap baris cocok dengan batch-nya.

### Barang masuk

Barang yang datang dari distributor atau toko rekanan dicatat di **Kasir, Barang masuk**, tombol *Catat barang masuk*. Hanya untuk cabang yang sudah memakai kasir. Cabang mode sheet tetap mencatat stoknya di sheet.

1. Isi pemasok dan jenisnya (distributor atau toko rekanan). Nama pemasok yang pernah dipakai muncul sebagai pilihan.
2. Isi tanggal pesan kalau tahu, dan tanggal terima (bawaan hari ini). Selisih keduanya dipakai tim data sebagai lead time.
3. Cari barangnya seperti di layar kasir, lalu isi jumlah, harga beli (boleh kosong), dan harga jual. Harga jual terisi harga sekarang.
4. Tekan *Simpan barang masuk*. Stok langsung bertambah, dan penerimaan mendapat nomor `BM-KODE-YYMMDD-NNN`, misalnya `BM-BTU-261120-001`.

Harga jual:

- Admin cabang yang mengubah harga jual membuat usulan harga untuk owner. Sampai owner memutuskan, batch baru itu dijual dengan harga lama (harga batch yang sedang terjual). Barang yang belum punya harga sama sekali belum bisa dijual sampai owner menyetujui usulannya.
- Owner yang mencatat barang masuk langsung memakai harga yang diisi untuk batch baru. Batch lama tetap dengan harganya sendiri.

Daftar barang masuk bisa disaring tanggal terima dan cabang. Buka nomornya untuk melihat rincian, harga batch sekarang, dan status usulan harga.

### Tinjau pengajuan (owner)

**Tinjau pengajuan** memuat dua antrean:

- *Harga barang masuk*: usulan harga jual dari admin cabang. *Setujui* mengganti harga batch itu dengan harga usulan (tercatat di riwayat harga). *Tolak* membiarkan harga lama. Keputusan tidak bisa diubah sesudahnya. Kalau harga perlu diganti lagi, ubah harga batch-nya di halaman barang.
- *Diskon nota*: seperti di atas, keputusan tidak mengubah transaksi.

### Opname

Opname dipakai untuk mencocokkan stok sistem dengan hitungan fisik di toko. Hanya untuk cabang yang sudah memakai kasir.

1. Admin cabang membuka **Kasir, Opname** lalu menekan *Mulai opname*. Satu cabang hanya punya satu opname yang belum final.
2. Cari barang yang dihitung, isi stok fisik, lalu *Simpan baris*. Stok sistem saat itu ikut dicatat. Kalau fisik berbeda dengan sistem, alasan selisih wajib diisi. Barang yang sudah diisi bisa dipilih lagi untuk diubah.
3. Tekan *Kirim ke owner*. Sesudah itu admin tidak bisa mengubah baris lagi, kecuali owner mengembalikannya ke draft.
4. Owner membuka opname itu, memeriksa barisnya (owner juga bisa mengubah baris), lalu menekan *Finalkan*.

Penjualan tetap boleh berjalan selama opname. Saat final, sistem menambahkan selisih tiap baris ke stok yang ada saat itu, jadi penjualan sesudah baris diisi tidak hilang. Contoh: sistem 8, fisik 10 (selisih +2), lalu terjual 1. Saat final stoknya 7 + 2 = 9. Kalau hasilnya akan minus, finalisasi ditolak dan baris itu perlu dihitung ulang. Opname yang sudah final tidak bisa diubah atau difinalkan lagi. Draft yang belum dipakai bisa dihapus tanpa mengubah stok.

### Dashboard dan rekap (owner)

- **Dashboard**: penjualan hari ini dan minggu ini per cabang, 7 hari dan 8 minggu terakhir, porsi ban, jasa, dan produk, barang paling laris, stok menipis, dan jumlah pengajuan serta opname yang menunggu. Angkanya dari transaksi selesai sesudah diskon. Transaksi void tidak dihitung. Hari dan minggu memakai jam WIB, minggu dimulai Senin.
- **Rekap dan ekspor**: pilih bulan untuk melihat barang masuk, terjual, dan selisih opname atau koreksi per barang dan cabang. Di bagian bawah ada tombol unduh CSV untuk tim data (penjualan per minggu, stok habis, dan barang masuk). Isi CSV adalah data toko, jadi simpan dan bagikan dengan hati-hati. Arti kolomnya ada di [KASIR.md](KASIR.md).

## Fitur internal

Data nyata client (pricelist, harga jasa) disimpan di database lokal dan folder `data/`, tidak boleh masuk git.

### Tautan WhatsApp (menu Situs)

- **Nomor WhatsApp utama**: satu nomor untuk dua cabang. Kalau kosong, situs memakai nomor tiap cabang (diubah di Pengaturan, tab Cabang). Halaman ini menampilkan nomor tiap cabang sebagai bacaan saja. Nomor admin penerima ringkasan bot adalah hal lain dan diubah di Chatbot, tab Pengaturan bot.
- **Tautan pendek**: semua tombol WhatsApp di situs mengarah ke `/wa/batu`, `/wa/karanglo`, atau `/wa` (umum). Tautan itu mengalihkan ke `wa.me/<nomor utama>?text=<kalimat pembuka cabang>`, jadi nomor dan kalimat cukup diubah di satu tempat. Ketiga tautan tampil di halaman ini dengan tombol salin, untuk dipasang di Google Maps, bio Instagram, dan QR di toko. Alamat dasar tautan diambil dari variabel `SITE_URL` di `.env` (tanpa garis miring di akhir). Kalau kosong, dipakai alamat yang sedang dibuka di peramban, sehingga bisa berupa alamat IP. Hitungan klik per cabang per hari ikut tampil. Yang disimpan hanya jumlah per cabang per hari, tanpa data pribadi.
- **Kalimat pembuka** bisa diedit. Kalimat tombol umum wajib memuat `{cabang}` dan kalimat halaman produk wajib memuat `{cabang}` dan `{produk}`, karena bot mengenali cabang dari nama cabang di pesan. Simpan ditolak kalau salah satunya hilang. Bagian *Hasil saat ini* menampilkan nomor dan kalimat untuk tiap cabang.
- **Harga di situs**: sakelarnya ada di Stok dan harga, tab Produk situs, dan hanya terlihat dan bisa diubah owner (dicek ulang di server). Bawaan mati. Saat mati, beranda, daftar produk, dan detail produk hanya menampilkan ajakan tanya harga lewat WhatsApp. Halaman admin tetap menampilkan harga. Harga jasa tidak pernah tampil di situs.

### Stok ban (menu Stok dan harga)

- **Stok per cabang**: stok Batu dan Karanglo terpisah. Tiap baris punya cabang, atau belum punya (baris *tanpa cabang*, misalnya 325 baris pricelist lama yang belum diketahui milik cabang mana). Baris tanpa cabang dipakai sebagai stok bersama.
- **Sinkron dari Google Sheets**: ada satu kolom URL untuk *Tanpa cabang*, satu untuk tiap cabang, dan satu untuk *Sheet gabungan*. Isi URL lalu tekan *Sinkron sekarang* di barisnya. URL disimpan di database per cabang, bukan di kode. Spreadsheet harus dibagikan sebagai "Siapa saja yang memiliki tautan dapat melihat". Yang diambil adalah ekspor CSV tab yang sedang dibuka (angka `gid` di URL).
- **Impor per cabang**: impor atau sinkron ke satu cabang hanya memperbarui dan menonaktifkan baris cabang itu. Cabang lain dan baris tanpa cabang tidak tersentuh. *Sheet gabungan* dipakai kalau satu sheet berisi dua cabang: baris judulnya harus punya kolom `Cabang` berisi Batu atau Karanglo. Baris dengan cabang kosong atau tulisan lain tidak ditebak, barisnya dilewati dan tampil di daftar bermasalah. Ringkasan impor menyebut cabang tujuannya.
- **Tetapkan baris tanpa cabang**: kalau owner sudah tahu pricelist lama milik cabang mana, tekan *Tetapkan ke Batu* atau *Tetapkan ke Karanglo* di kartu *Ban tanpa cabang*, lalu konfirmasi di dialog yang menyebut jumlah barisnya. Baris yang kodenya (ukuran dan merek) sudah ada di cabang tujuan dilewati dan tetap tanpa cabang, jumlahnya disebut di pesan hasil. Aksi ini tercatat di log aktivitas dan buku stok.
- **Filter dan banding cabang**: di tabel stok ada pilihan *Semua*, *Tanpa cabang*, *Batu*, *Karanglo*, dan *Banding cabang*. Mode banding menampilkan satu baris per ukuran dan merek dengan stok dan harga (setelah potongan) tiap cabang berdampingan.
- **Impor CSV** dengan berkas atau tempel isi tetap tersedia. Keduanya memakai pengurai yang sama.
- Hasil impor menampilkan jumlah baris masuk dan daftar baris bermasalah apa adanya. Harga kosong berarti barang belum pernah dibeli toko, jadi bot menganggapnya tidak tersedia. Harga janggal (misalnya `1.825.0000`) tidak ditebak: isi manual di tabel stok.
- Keterangan `disc 50.000` dibaca sebagai potongan. Harga asli dan potongan disimpan terpisah, bot menyebut harga setelah potongan beserta harga asalnya.
- **Ubah satu baris**: tekan *Ubah* di ujung baris, ubah harga, potongan, stok, atau keterangan di panel, lalu *Simpan baris*. Baris itu diberi penanda *manual*. Centang *Kunci* supaya sinkron berikutnya tidak menimpanya. Baris manual yang tidak dikunci ditimpa data baru. Baris manual yang dikunci tapi hilang dari spreadsheet tetap disimpan. Filter *Harga bermasalah* dan *Diubah manual* membantu menemukan barisnya.

### Merek dan status by order

Tab *Merek* di menu Situs (owner) menampilkan semua merek dalam satu tabel: logo kecil, nama, jumlah produk, sakelar *By order*, dan tombol urutan. Sakelar *By order* langsung tersimpan (merek tidak distok, dipesan dulu). Nama dan logo diubah lewat *Ubah*. Merek resmi: Michelin, BFGoodrich, Hankook, Laufenn, Dunlop, Bridgestone, Sailun, Accelera, Falken, Delium, Maxxis. Accelera, Falken, Delium, dan Maxxis berstatus by order. Ban truk (Aeolus, Swallow, Sailun, dan lainnya) menyusul dan belum dijual.

Merek yang masih dipakai produk tidak bisa dihapus. Pilih *Nonaktifkan*: merek itu hilang dari bagian merek di beranda, saringan merek di halaman produk, pilihan merek di form produk baru, dan daftar merek by order yang dikenali chatbot. Produk yang memakainya tidak berubah dan tetap tampil. Form produk yang sudah memakai merek nonaktif tetap menampilkannya dengan tanda "(nonaktif)". Merek yang tidak dipakai produk boleh dihapus. Skrip `seed:lokal` tidak mengaktifkan kembali merek yang dinonaktifkan admin.

Bagian merek di beranda mengambil daftar ini sesuai urutan. Logo tampil putih satu warna dengan tinggi yang sama, jadi unggah SVG atau PNG transparan. Merek tanpa logo tampil sebagai nama. Merek by order diberi keterangan kecil "by order". Kolom lama "Merek yang ditampilkan" di *Tampilan beranda* sudah tidak dipakai. Daftar merek juga bisa diisi dari `seed.json` bagian `brands` (lihat bagian data lokal).

### Kalender dan akun nonaktif

Di *Kalender libur dan promo* (tidak ada di menu; buka lewat alamat `/admin/kalender`), owner mencatat tanggal libur toko dan promo beserta keterangannya, lalu bisa mengubah atau menghapusnya. Tabelnya bisa disaring *Akan datang*, *Sudah lewat*, atau *Semua*. Di tab *Pengguna*, buka *Ubah* lalu hilangkan centang *Akun aktif* untuk menonaktifkan akun. Kata sandi diganti di bagian *Ganti kata sandi* di bawah form yang sama. Akun yang dinonaktifkan: pemiliknya tidak bisa login dan sesi yang sedang berjalan langsung berhenti. Owner tidak bisa menonaktifkan akunnya sendiri. Sejak tahap ini impor stok ban tidak lagi menghapus baris: baris yang hilang dari pricelist disembunyikan dan muncul lagi kalau ada di impor berikutnya, dan setiap perubahan stok tercatat di buku stok (rinciannya di `docs/PENYELARASAN-BEJOSTOCK.md`).

### Harga jasa

Daftar harga jasa (spooring, balance, nitrogen, pasang atau bongkar ban, ganti oli) yang bisa diedit. Chatbot menjawab dari tabel ini. Kalau jasanya tidak ada atau harganya kosong, bot menyerahkan ke admin. "Paket" spooring ditulis apa adanya, isinya tidak dijelaskan di tabel. Untuk mengisi data awal dari berkas lokal `data/seed-lokal.json`, jalankan `npm run seed:lokal`.

### Ongkir

- **Kalkulator** (`/admin/ongkir`, semua admin): pilih ban dari stok, velg, atau berat manual. Kolom yang tidak dipakai oleh pilihan itu dinonaktifkan, dan hasil menyebut dari mana berat diambil. Tujuan dicari lewat kotak alamat atau lokasi (OpenStreetMap lewat server). Kalau ada beberapa pilihan lokasi, pilihan kembar dibuang dan tiap pilihan diberi keterangan wilayahnya (kelurahan, kecamatan, kota atau kabupaten, provinsi). Tombol *Cari ulang lokasi* mencari dari awal tanpa memakai hasil pencarian sebelumnya. Alamat lengkap gaya Google Maps boleh ditempel utuh: pencarian mencoba teks utuh, lalu versi tanpa kode pos dan nomor rumah, lalu jalan plus kecamatan dan kabupaten, lalu kecamatan plus kabupaten dan provinsi, lalu kabupaten plus provinsi, dan berhenti di yang pertama ketemu (Photon sebagai cadangan). Hasil menyebut tingkat ketepatannya (titik alamat, kecamatan, atau kota atau kabupaten). Hasil kosong hanya diingat beberapa menit, dan tombol *Cari ulang* melewati cache. Pencarian hanya jalan saat tombol ditekan. Hasilnya nama tempat, kecamatan, kota atau kabupaten, provinsi, koordinat, dan jarak garis lurus dari cabang asal. Kota hasil pencarian dicocokkan dengan tabel tarif J&T Cargo dan Baraka Express. Kalau belum ada tarifnya, tampil "tarif belum diisi" dengan tautan untuk menambah tarif kota itu.
- **Tarif** (owner, `/admin/ongkir/tarif`): tarif per kota diisi dari daftar harga agen, satu per satu atau tempel banyak sekaligus.
- **Pengaturan ongkir** (owner, menu Ongkir, tab Pengaturan): titik toko tiap cabang (tempel tautan lengkap Google Maps atau dua angka koordinat, dibaca otomatis; kosong berarti titik lama dipertahankan), pembagi berat volume (dilipat di *Angka pembagi ekspedisi*), packing per ban, berat velg, dan berat serta ukuran kemasan ban per ring (R12 sampai R19). Berat velg bawaan 10 kg, perkiraan toko (7 sampai 12 kg). Berat ban belum pernah dihitung toko, jadi angka bawaannya berlabel contoh. Label itu hilang sendiri setelah owner mengubah angka kemasan dan menyimpannya.
- Baris tarif dan berat ban bertanda CONTOH tampil dengan label "contoh, belum dari agen". Hilangkan centang *Contoh* setelah angkanya dari agen.
- Penyedia lokasi bawaan OpenStreetMap tanpa kunci. Untuk memakai Google Maps nanti, isi `GOOGLE_MAPS_API_KEY` di `.env`.

### Chatbot

Bot bukan AI. Alurnya: pesan masuk, kenali cabang dan ukuran atau merek, cari di data stok dan harga jasa. Ada dan stok lebih dari 0 (atau jasa ada di tabel): kirim harga dan stok asli. Tidak ada, stok 0, harga kosong, atau pesan tidak dikenali: bot tidak menjawab harga, mengirim satu kalimat bahwa admin akan membalas, mengirim ringkasan ke nomor admin cabang, lalu diam di chat itu selama jangka waktu yang diatur. Admin menandai percakapan *Selesai, tersedia* atau *Selesai, tidak tersedia* (bot lalu mengirim kalimat penutup).

- **Cabang**: dikenali dari kata Batu, Karanglo, atau Singosari di mana pun dalam pesan. Untuk stok tanpa cabang, cabang tidak ditanyakan sebelum menjawab. Bot menanyakannya (balas 1 atau 2) sebelum menyebut stok yang sudah ditetapkan ke cabang, sebelum serah terima ke admin, atau saat pelanggan mau datang, pasang, atau booking. Pilihan diingat per nomor pelanggan (bawaan 30 hari), dan pelanggan bisa mengganti dengan mengetik "ganti cabang" atau nama cabang lain. Kalau cabang belum diketahui dan pertanyaan cabang tidak dijawab, percakapan diserahkan ke nomor owner.
- **Stok per cabang** (saklar di menu Chatbot, tab Pengaturan bot, bagian Bot aktif dan jam layanan, bawaan menyala):

  | Keadaan | Sebelum revisi ini | Sesudah, saklar menyala |
  | --- | --- | --- |
  | Baris tanpa cabang | Dijawab langsung | Sama, dijawab langsung tanpa menanyakan cabang |
  | Baris bercabang, cabang pelanggan belum diketahui | (belum ada baris bercabang) | Bot menanyakan cabang dulu, lalu menjawab stok dan harga cabang itu |
  | Kosong di cabang pelanggan, ada di cabang lain | (satu stok) | Bot menyebut "tersedia di cabang ..." tanpa angka stok dan harga, lalu menyerahkan ke admin cabang pelanggan |
  | Semua cabang kosong | Serah ke admin | Serah ke admin |
  | Merek by order yang stoknya kosong | Serah ke admin | Bot menjawab merek itu bisa dipesan dulu, lalu menyerahkan ke admin cabang |

  Saklar mati: cabang baris diabaikan dan semua baris dianggap satu stok seperti sebelumnya. Merek by order tetap dikenali.
- **Templat baru**: *Tersedia di cabang lain* (`{cabang}`, `{cabangLain}`, `{ukuran}`) dan *Merek by order* (`{merek}`, `{cabang}`, `{ukuran}`). Keduanya bisa diedit di Templat pesan seperti templat lain.
- **Tab Percakapan**: daftar percakapan dengan filter status dan cabang (owner), dan tombol penanda selesai. Admin cabang hanya melihat dan menandai percakapan cabangnya; pemeriksaan ini juga dilakukan di server.
- **Tab Kotak uji** (owner): tidak membuat percakapan dan tidak mengirim apa pun. Punya pilihan cabang yang diingat, pesan asal untuk mengetes jawaban 1 atau 2, dan saklar *Stok per cabang* khusus untuk uji itu (ikut pengaturan, nyala, atau mati).
- **Tab Templat pesan** (owner): semua kalimat bot dengan pratinjau, dalam tiga kelompok: Ke pelanggan, Ke admin, dan Untuk sosial media. Kelompok sosial media berisi balasan otomatis Instagram, Facebook, dan TikTok yang memuat tautan pendek tiap cabang. Tombol *Salin* menyalin teks jadi dan memunculkan pesan "tersalin", tombol *Ubah* membuka panel dengan isian, pratinjau, simpan, dan kembalikan ke bawaan. *Kembalikan semua ke bawaan* ikut mengembalikan teks sosial media. Simpan ditolak kalau teks memuat isian dalam kurung kurawal yang tidak dikenal templat itu (mis. `{nama}`), dengan pesan yang menyebut isian mana yang boleh dipakai.
- **Chatbot, tab Pengaturan bot** (owner): paling atas *Bot aktif dan jam layanan* (saklar, jam, stok per cabang). Angka teknis (jeda antar pesan, batas per hari, lama bot diam, lama cabang diingat, lama menunggu jawaban) dan *Hanya membalas nomor uji* ada di *Pengaturan lanjutan* yang tertutup. Kalau pembatasan nomor uji menyala dengan daftar kosong, bot diam ke semua orang. Halaman memberi peringatan merah di kartu paling atas (juga saat bot sedang mati, sebagai pengingat sebelum dinyalakan) dan membuka Pengaturan lanjutan. Kalau bot sedang aktif dalam keadaan itu, Ringkasan owner juga menampilkan peringatannya. Lalu Sambungan WhatsApp (status bot, tersambung, mode kirim, nomor yang dipakai) dan Nomor admin per cabang. Balasan otomatis sosial media tidak lagi di halaman ini, tempatnya di Templat pesan.
- **Tab Cermin chat** (owner): salinan hanya baca semua chat di nomor bot, termasuk chat yang tidak ditangani bot. Rinciannya di bagian Cermin chat di bawah.
- **Worker** (`scripts/bot-wa.ts`, `npm run bot:wa`) membaca WAHA secara berkala. Bawaannya uji kering (hanya mencetak dan mencatat). Isi `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` di `.env`, dan tambahkan `BOT_SEND=1` hanya kalau memang mau mengirim. Selama masa uji, pembatasan ke nomor uji aktif. Worker belum pernah dicoba ke WAHA.
- **Label WhatsApp per cabang**: saat cabang percakapan diketahui atau berubah, worker memasang label "Batu" atau "Karanglo" (nama cabang tanpa "Bejo Ban" dan tanpa kurung) ke chat di akun WhatsApp Business. Label dicari menurut nama, dibuat kalau belum ada, dan id-nya disimpan di memori worker. Label lain yang dipasang admin tetap ada, hanya label cabang lain yang dilepas. Di uji kering worker hanya mencetak permintaan yang akan dikirim. Kalau label gagal (404, 501, engine tidak mendukung, jaringan), kegagalan dicatat sekali dan balasan bot tetap jalan. Pembentuk permintaannya ada di `src/lib/bot/label.ts`.

  Dukungan endpoint label WAHA menurut dokumentasi resmi, dibaca 16 November 2026 dari https://waha.devlike.pro/docs/how-to/labels/ dan tabel fitur di https://waha.devlike.pro/docs/how-to/engines/:

  | Endpoint | WEBJS | WPP | NOWEB | GOWS |
  | --- | --- | --- | --- | --- |
  | `GET /api/{session}/labels` (daftar label) | ya | ya | ya | ya |
  | `POST /api/{session}/labels` (buat, isi `name` dan `color` 0 sampai 19) | ya | ya | ya | ya |
  | `GET /api/{session}/labels/chats/{chatId}/` (label chat) | ya | ya | ya | ya |
  | `PUT /api/{session}/labels/chats/{chatId}/` (isi `labels: [{ id }]`, mengganti seluruh label chat) | ya | ya | ya | ya |
  | Event `label.upsert`, `label.deleted` | tidak | tidak | ya | ya |

  Jadi label didukung engine GOWS yang kita pakai. Dokumentasi menyebut label adalah fitur WhatsApp Business, dan tidak menjelaskan apa yang terjadi di akun WhatsApp biasa. Bentuk jawaban `POST` membuat label tidak didokumentasikan: worker memakai `id` dari jawaban itu, atau membaca ulang daftar label kalau tidak ada. Semua ini belum dicoba ke WAHA sungguhan.

### Cermin chat

Tab *Cermin chat* (`/admin/chatbot/cermin`) menampilkan semua chat di nomor bot: pesan pelanggan, balasan bot, dan balasan yang diketik manusia dari HP atau WhatsApp Web. Aturannya mengikuti aturan mirroring WhatsApp untuk semua nomor chatbot (ditetapkan 24 November 2026):

- Hanya owner yang bisa membuka. Admin cabang yang mengetik alamatnya dialihkan ke Ringkasan; pemeriksaannya di server (`requireOwner`), bukan hanya di menu.
- Hanya baca. Tidak ada tombol kirim, balas, atau hapus pesan WhatsApp. Membalas tetap dari HP atau lewat alur bot.
- Daftar chat berisi nama atau nomor, cuplikan pesan terakhir, waktu, dan jumlah pesan masuk yang belum dilihat di panel. Hitungan itu kembali nol saat chat dibuka. Isi chat tampil sebagai gelembung: putih untuk pelanggan, hitam untuk bot, abu untuk admin. Di grup, nama dan nomor peserta ditulis di atas gelembung.
- Pencarian mencari isi pesan, nama, dan nomor. Saringan pengirim (Pelanggan, Bot, Admin) dan jenis chat (Pribadi, Grup) menyaring daftar chat dan isi chat yang dibuka. Di HP, saringan berupa dua pilihan berlabel, dan saat satu chat dibuka hanya isi chat dan tombol *Daftar chat* yang tampil.
- Penanda pengirim: pesan masuk = pelanggan. Pesan keluar yang id-nya dicatat worker bot saat mengirim (tabel `wa_kirim_bot`) = bot. Pesan keluar lain = admin. Kalau webhook tiba sebelum worker mencatat id, pesan itu sempat tertulis admin lalu diganti bot begitu id tercatat.
- Media tidak diunduh. Yang disimpan hanya jenisnya (gambar, video, pesan suara, dokumen, stiker, lokasi, kontak), nama berkas dokumen, dan keterangannya. Untuk lokasi hanya nama tempatnya (tanpa koordinat), untuk kontak hanya nama tampilannya (tanpa isi vCard).
- Status (`status@broadcast`), siaran, dan saluran (newsletter) tidak dicatat. Reaksi dan pesan protokol juga tidak.
- Pesan yang dihapus pengirim tetap tersimpan dan ditandai *dihapus* (teks dicoret). Pesan yang diedit menyimpan isi terakhir dan ditandai *diedit*. Kalau tanda hapus atau edit tiba lebih dulu daripada pesan aslinya, dibuat baris sementara yang dilengkapi begitu pesan asli datang.
- Lama simpan bawaan 180 hari, diubah di tab Pengaturan bot, bagian Cermin chat (7 sampai 730 hari). Pesan yang lebih tua dihapus otomatis saat webhook atau tarik riwayat berjalan (paling sering sekali per jam per proses, tanpa cron), dan langsung saat lama simpan disimpan.
- Chat pribadi ber-LID. Engine GOWS bisa mengirim chat pribadi dengan id LID (`...@lid`), bukan nomor (`62...@c.us`) seperti di daftar chat WAHA. Id itu diganti nomornya sebelum disimpan, dari sumber berikut menurut urutan: `_data.Info.SenderAlt` (pesan masuk) atau `RecipientAlt` (pesan keluar) di payload, tabel `wa_lid`, lalu `GET /api/{session}/lids/{lid}` di WAHA. Pemetaan disimpan di `wa_lid` supaya WAHA tidak ditanya tiap pesan; LID yang gagal dicari tidak ditanyakan lagi selama 10 menit. Kalau nomornya belum diketahui, pesan tetap disimpan dengan id LID (webhook tetap menjawab 200) dan chat tampil sebagai "Nomor belum diketahui". Begitu nomornya diketahui (pesan berikutnya, atau Tarik riwayat yang membaca `GET /api/{session}/lids` lalu paling banyak 20 pencarian satu per satu), chat LID lama digabung ke chat nomornya: pesan yang sama menjadi satu baris, tanda dihapus dan diedit dipertahankan. Peserta grup ber-LID juga ditulis nomornya kalau payload membawanya.
- Isi chat adalah data pribadi pelanggan. Tidak masuk git, tidak dicetak ke log aplikasi, dan tidak dipotret untuk dibagikan. Uji memakai data buatan.

Sumber data:

- **Webhook WAHA** (sumber utama): `POST /api/waha/webhook` menerima event `message.any`, `message.revoked`, dan `message.edited` (ketiganya didukung engine GOWS). Setiap permintaan wajib membawa HMAC SHA-512 atas body mentah di header `X-Webhook-Hmac`, dengan kunci `WAHA_WEBHOOK_HMAC`. HMAC salah atau tidak ada dijawab 401 tanpa menyimpan apa pun. Kalau `WAHA_WEBHOOK_HMAC` kosong, semua permintaan ditolak. Body di atas 1 MB ditolak sebelum HMAC dihitung. Event dari sesi lain selain `WAHA_SESSION` diabaikan. Penyimpanan idempoten per (chat, id pesan), jadi kiriman ulang WAHA tidak membuat baris ganda.
- **Tarik riwayat** (tombol di kanan atas tab Cermin chat): membaca `GET /api/{session}/chats/overview` lalu `GET /api/{session}/chats/{id}/messages` dari WAHA (`WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION`), paling banyak 30 chat terbaru dan 50 pesan per chat, satu chat per satu. Dipakai untuk mengisi chat lama saat pertama dipasang atau sesudah webhook mati. Juga idempoten. Nama chat dan grup diambil dari daftar chat WAHA.

Kode: pembaca payload dan HMAC di `src/lib/cermin/baca.ts` (murni), penyimpanan dan retensi di `src/lib/cermin/simpan.ts`, pemetaan dan penggabungan LID di `src/lib/cermin/lid.ts`, penarik riwayat di `src/lib/cermin/tarik.ts`. Tesnya di `tests/cermin.test.ts` dan `tests/cermin-db.test.ts`. Bentuk payload diambil dari kode engine GOWS di repo resmi WAHA (dibaca 24 November 2026) dan baru diuji dengan payload buatan, belum dengan WAHA sungguhan.

## Tampilan situs terbaru dan data lokal

Beranda memakai desain hitam putih terbaru (hero, bar keunggulan, layanan, produk, alur, rekomendasi mobil, merek, galeri, lokasi). Semua teks dan foto tetap diatur dari *Tampilan beranda* (menu Situs), bagian baru *Layanan bengkel* ikut di sana. Bagian flash sale, pembayaran, panel, dan promo tidak tampil di desain ini tapi isinya tetap tersimpan; di admin diberi tanda *tidak tampil*.

Foto mobil, galeri, cabang, dan gambar ban pabrikan tidak masuk git. Letakkan di folder `data/seed-lokal/` bersama satu berkas `seed.json`, lalu jalankan `npm run seed:lokal` (di server: di dalam container dengan data di `/app/data/seed-lokal/`). Skrip ini aman dijalankan berulang: gambar yang sama tidak diunggah ulang, enam produk beranda dibuat lewat upsert (harga dan stok yang sudah diisi tidak ditimpa), produk bertanda CONTOH disembunyikan, dan konten beranda dipasang. Bagian `brands` (`[{ "name": "Dunlop", "byOrder": false, "sort": 5, "logo": "dunlop.svg" }]`, `logo` opsional) membuat merek yang belum ada dan memperbarui `byOrder` serta `sort` merek yang sudah ada, dicocokkan menurut nama tanpa membedakan huruf besar kecil. Merek lain tidak disembunyikan atau dihapus. Logo dari seed hanya dipasang kalau logo merek itu masih kosong atau masih logo dari seed sebelumnya, jadi logo yang diganti admin tidak tertimpa. Format `seed.json` ada di komentar awal `scripts/seed-lokal.ts`.

## Ukuran foto

Semua foto yang diunggah otomatis dipotong ke rasio yang benar, diperkecil, lalu disimpan sebagai WebP. Jadi foto dengan rasio berbeda tetap pas di tampilannya. Hasil paling tajam didapat kalau foto aslinya sama atau lebih besar dari ukuran ideal.

| Dipakai untuk | Ukuran ideal | Rasio | Cara diproses | Tips |
| --- | --- | --- | --- | --- |
| Logo situs | 600 × 200 px | bebas (melebar) | Utuh, diperkecil | PNG latar transparan atau SVG. Minimal tinggi 120 px. |
| Latar hero | 2000 × 800 px | 5:2 | Dipotong penuh | Foto lebar, objek utama di sisi kanan karena kiri tertutup teks. |
| Foto samping hero | 720 × 1280 px | 9:16 | Dipotong penuh | Foto potret seperti cover reel Instagram. |
| Foto produk | 1200 × 1200 px | 1:1 | Utuh, sisa diberi latar | Produk di tengah, latar polos. Sisa ruang diisi putih otomatis. |
| Ikon kategori | 400 × 400 px | 1:1 | Utuh, sisa diberi latar | PNG transparan, barang saja tanpa latar. |
| Logo merek | paling besar 800 × 400 px | bebas | Tepi kosong dipangkas, rasio asli tetap | SVG atau PNG transparan. Di beranda tampil putih satu warna dengan tinggi yang sama. |
| Kartu rekomendasi mobil | 1400 × 700 px | 2:1 | Dipotong penuh | Mobil dari samping/depan, bagian atas kiri agak kosong untuk judul. |
| Banner promo | 2400 × 640 px | 15:4 | Dipotong penuh | Banner sangat lebar. Teks penting taruh di tengah agar aman di HP. |
| Foto toko (panel samping) | 800 × 900 px | 8:9 | Dipotong penuh | Tampak depan bengkel. |
| Foto cabang | 1200 × 700 px | 12:7 | Dipotong penuh | Tampak depan atau suasana bengkel. |
| Logo pembayaran | 240 × 80 px | 3:1 | Utuh, sisa diberi latar | PNG transparan. |
| Gambar share (WA/FB) | 1200 × 630 px | 1.91:1 | Dipotong penuh | Muncul saat link dibagikan. |

Aturan umum:

- Format JPG untuk foto. PNG transparan atau SVG untuk logo dan ikon. WebP juga bisa.
- Foto HEIC dari iPhone belum bisa dibaca. Ubah dulu ke JPG (di iPhone: Pengaturan, Kamera, Format, pilih Paling Kompatibel).
- Ukuran file maksimal 15 MB.
- Foto produk sebaiknya berlatar polos dengan produk di tengah. Nama, ukuran, dan harga sudah ditulis oleh web, jadi tidak perlu ditulis di foto.
- Foto banner dan hero boleh berisi teks, tapi taruh di tengah supaya tidak terpotong di layar HP.

## Untuk pengelola sistem

Keterangan teknis yang dulu tampil di halaman admin dan sekarang hanya dicatat di sini:

- **Sambungan WhatsApp**: halaman *Pengaturan bot* hanya menampilkan "Tersambung" kalau `WAHA_URL`, `WAHA_API_KEY`, dan `WAHA_SESSION` terisi di `.env` server, dan "Dikirim ke pelanggan" kalau `BOT_SEND=1`. Satu WAHA (engine GOWS) untuk satu nomor. Worker dijalankan dengan `npm run bot:wa` (`scripts/bot-wa.ts`), belum dijalankan dari aplikasi web.
- **Cermin chat**: app butuh `WAHA_WEBHOOK_HMAC` (kunci acak, sama dengan `hmac.key` di konfigurasi webhook sesi WAHA) dan, untuk tombol Tarik riwayat, `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` di env container app (bukan hanya worker). Alamat webhook dari dalam jaringan Docker: `http://app:3000/api/waha/webhook`.
- **Data awal harga jasa**: kalau daftar harga jasa kosong, jalankan `npm run seed:lokal` dengan berkas `data/seed-lokal.json`.
- **Sinkron Google Sheets**: URL disimpan di tabel pengaturan database per cabang (kunci `stok.sheet`, `stok.sheet.<slug>`, `stok.sheet.gabungan`), bukan di kode. Sinkron mengambil ekspor CSV dari tab yang dibuka (angka `gid` di URL).
- **Impor stok ban**: baris dikenali dari ukuran dan merek. Baris yang hilang dari sumber dinonaktifkan dan aktif lagi kalau muncul kembali, dan setiap perubahan stok tercatat di buku stok (`docs/PENYELARASAN-BEJOSTOCK.md`).
- **Pencarian lokasi ongkir**: OpenStreetMap (Nominatim) lewat server, Photon sebagai cadangan. Pencarian hanya jalan saat tombol ditekan, sesuai aturan pakai OpenStreetMap. Hasil disimpan sementara di database; *Cari ulang* melewati simpanan itu. Atribusi "Data peta © kontributor OpenStreetMap" wajib tampil di bawah hasil pencarian.
- **Hitungan klik WhatsApp** berasal dari tautan pendek `/wa`, `/wa/batu`, dan `/wa/karanglo`, dan hanya menyimpan jumlah per cabang per hari.
