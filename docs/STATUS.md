# Status pekerjaan Bejo Ban

Keadaan per 23 November 2026. Dokumen ini mencatat yang sudah selesai, yang belum, dan keputusan yang sudah diambil, supaya pekerjaan berikutnya bisa dimulai dari cabang `main`.

Repo ini publik. Sandi, nomor telepon, harga asli, alamat server, dan urusan tagihan tidak ditulis di sini. Semuanya dicatat di luar repo, di `~/ndru/bejoban-aset/CATATAN-PRIBADI.md` pada mesin pengembang.

## Keadaan sekarang

- Situs tayang di https://bejoban.com dengan kode yang sama dengan cabang `main`. Pindah ke PostgreSQL dirilis 20 November 2026 pukul 04.28 UTC, situs mati sekitar 20 detik.
- Memakai Next.js 16.4.6 dan Prisma 7.10.1 (naik versi 18 November 2026), dengan PostgreSQL 18 sejak 20 November 2026 (sebelumnya SQLite). Rinciannya di [POSTGRES.md](POSTGRES.md).
- Kasir v1 bagian 1 dan 2, ditambah perbaikan 11 temuan audit, digabung dengan `main` di branch `kasir-rilis` dan belum dirilis. `main` dan situs belum memuatnya. Rinciannya di [KASIR.md](KASIR.md).
- Di branch `kasir-rilis`, `npm test` lulus 217 tes (butuh PostgreSQL, lihat [POSTGRES.md](POSTGRES.md)). `npm run lint` dan `npm run typecheck` bersih. `npm audit --omit=dev` tanpa temuan.
- Halaman admin dan stok ban sudah bisa dipakai. Kalkulator ongkir sudah jalan, tetapi tabel tarif di produksi masih kosong, jadi hasilnya belum memuat biaya.
- Chatbot stok selesai sampai kotak uji di admin. Bot belum tersambung ke WhatsApp.
- Isi database produksi: 325 baris stok ban (pada cadangan 20 November 2026 pukul 04.28 UTC semuanya sudah ditetapkan ke cabang Batu), 14 harga jasa, 16 produk (6 tayang), 11 merek, 2 cabang, dan 3 akun admin.

## Yang sudah selesai

### Situs publik

- Beranda memakai desain hitam putih: hero, bar keunggulan, layanan bengkel, produk, alur, rekomendasi mobil, merek, galeri, dan lokasi cabang. Teks dan fotonya diatur dari admin.
- Harga tidak ditampilkan. Pengunjung diarahkan menanyakan harga lewat WhatsApp.
- Bagian merek memuat 11 merek resmi dengan urutan dari toko: Michelin, BFGoodrich, Hankook, Laufenn, Dunlop, Bridgestone, Sailun, Accelera, Falken, Delium, Maxxis. Sembilan sudah berlogo, Accelera dan Delium masih tampil sebagai nama. Empat merek terakhir bertanda by order.
- Tombol WhatsApp memakai tautan pendek `/wa`, `/wa/batu`, dan `/wa/karanglo`. Satu nomor dipakai dua cabang, dan kalimat pembukanya menyebut nama cabang. Klik dihitung per cabang per hari.
- Fitur keranjang dihapus. Alamat `/keranjang` dialihkan ke `/produk`.
- Favicon, ikon aplikasi, dan gambar pratinjau tautan memakai logo Bejo Ban.
- Halaman lain: daftar produk dengan saringan merek, detail produk, galeri, dan kalkulator ban. Saringan merek hanya memuat merek yang punya produk di cabang yang dipilih.

### Halaman admin

- Menu disusun ulang menjadi enam untuk owner (Ringkasan, Stok dan harga, Chatbot, Ongkir, Situs, Pengaturan) dan empat untuk admin cabang. Tiap menu punya tab. Susunannya ada di `src/lib/admin-menu.ts`, dan alamat lama dialihkan ke tempat barunya.
- Halaman daftar (Merek, Kategori, Cabang, Pengguna, Harga jasa, Tarif, Templat pesan) berupa tabel ringkas. Tambah dan ubah lewat panel samping, hapus lewat dialog konfirmasi. Kalau simpan ditolak server, panel terbuka lagi dengan isian yang sama.
- Stok ban tampil 50 baris per halaman dengan saringan ring, cabang, dan keadaan. Impor dan sinkron ada di panel "Perbarui dari pricelist".
- Tab Perlu dicek hanya memuat hal yang perlu ditindak, sekarang empat baris stok ban yang harganya kosong atau janggal.
- Tab Produk situs menampilkan produk yang tayang. Produk yang disembunyikan dibuka lewat chip tersendiri.
- Admin cabang hanya bisa mengubah harga dan stok cabangnya. Menambah produk dan mengubah data produk bersama hanya untuk owner. Aturan ini diperiksa di server.
- Di HP, daftar tampil sebagai kartu ringkas dengan menu "..." dan sasaran sentuh 44 px.
- Aturan tampilan admin ditulis di [STANDAR-UI-ADMIN.md](STANDAR-UI-ADMIN.md). Cara pakai tiap halaman ada di [PANDUAN-ADMIN.md](PANDUAN-ADMIN.md).

### Stok ban

- Pricelist diimpor dari CSV atau disinkronkan dari Google Sheets. Baris dikenali dari ukuran dan merek.
- Stok dipisah per cabang. Baris pricelist lama belum punya cabang dan dipakai sebagai stok bersama sampai ditetapkan.
- Baris yang hilang dari pricelist dinonaktifkan dan aktif lagi kalau muncul kembali. Baris yang diubah manual bisa dikunci supaya tidak tertimpa sinkron berikutnya.
- Setiap perubahan stok tercatat di buku stok, dan aksi admin tercatat di log aktivitas.
- Skema data sudah diselaraskan dengan rancangan BejoStock. Rinciannya di [PENYELARASAN-BEJOSTOCK.md](PENYELARASAN-BEJOSTOCK.md).

### Kasir (branch `kasir-rilis`, gabungan `kasir-v1` dan `main`, belum dirilis)

- Menu Kasir dengan tab Transaksi baru, Riwayat, Barang masuk, Opname, Tinjau pengajuan, Dashboard, Rekap dan ekspor, dan Pengaturan kasir. Aturan, alur, skema, dan beda dengan ERD Asah ada di [KASIR.md](KASIR.md). Cara pakai untuk admin toko ada di [PANDUAN-ADMIN.md](PANDUAN-ADMIN.md).
- Mode stok per cabang (sheet atau kasir). Owner mengaktifkan kasir per cabang dengan batch awal dari stok dan harga sekarang. Selama mode kasir, impor dan sinkron sheet untuk cabang itu ditolak dan isian stok serta harga di Stok ban dan Produk situs terkunci.
- Transaksi dengan batch FIFO, diskon nota, tunai dengan kembalian, QRIS, debit, idempotency, dan nota digital untuk kertas 58 mm, 80 mm, dan A4.
- Void sesuai aturan peran, harga batch oleh owner dengan riwayat harga, koreksi stok oleh owner, batas minimum dan peringatan stok menipis, siaran realtime lewat Server-Sent Events, dan manifest web app kasir.
- Bagian 2: barang masuk dengan nomor `BM-...` dan pengajuan harga restock untuk owner, opname draft, review, dan final (selisih diterapkan ke stok saat final), dashboard owner, rekap bulanan per barang dan cabang, dan ekspor CSV untuk tim data (penjualan per minggu, stok habis, barang masuk dengan lead time). Barang datang sekarang dicatat lewat Barang masuk, bukan koreksi.
- Diuji 21 November 2026 di lokal pada salinan data produksi dengan sandi uji, lewat browser tanpa kepala dengan formulir sungguhan: aktivasi kasir, transaksi ban, produk, dan jasa dengan tunai dan kembalian, QRIS, pemecahan batch, penolakan jumlah melebihi stok (di layar dan di server), diskon admin lalu ditinjau owner, void admin, ubah harga batch, batas minimum yang memicu peringatan, pratinjau cetak 58 mm, 80 mm, dan A4, siaran ke layar kasir lain, serta perubahan di Stok ban dan Kotak uji chatbot. 64 pemeriksaan lulus, termasuk tanpa luapan mendatar di 1440, 820, dan 390 px.
- Bagian 2 diuji 20 November 2026 dengan cara yang sama: barang masuk admin dengan harga usulan, owner menyetujui satu dan menolak satu, penjualan dengan harga batch yang sesuai, opname admin dengan selisih plus dan minus dan penjualan sebelum final, penolakan untuk cabang mode sheet dan cabang lain, dashboard yang cocok dengan Riwayat, rekap bulanan, unduhan CSV, serta perubahan di Stok ban dan Kotak uji chatbot. 106 pemeriksaan lulus, termasuk tanpa luapan dan tanpa tabel terpotong di 1440, 820, dan 390 px.
- Audit independen 20 November 2026 menemukan 11 masalah. Yang terberat: kiriman ulang sesudah koneksi putus bisa menyimpan nota lama walau keranjang sudah diubah, produk contoh ikut terjual, dan total yang tersimpan bisa berbeda dari total di dialog. Semuanya sudah diperbaiki dengan tes di `tests/kasir-audit-db.test.ts` dan diuji ulang di browser pada salinan data produksi. Keputusan yang diambil saat perbaikan (produk contoh tidak ikut kasir, harga batch 0 ditolak, admin hanya menghapus draft opname buatannya, rekap bulanan menurut tanggal transaksi) dicatat di [KASIR.md](KASIR.md) dan masih bisa diubah owner. Cek ulang oleh auditor lain 23 November 2026 menyatakan ke-11 temuan tuntas dan menemukan dua masalah baru tingkat sedang (dialog konfirmasi bisa tertutup paksa dengan Escape dua kali saat status kiriman belum jelas, dan tombol Tolak dan Setujui diskon terpotong di lebar tablet), keduanya sudah diperbaiki dan diuji ulang. Dua temuan rendah masih terbuka: cek status sesudah muat ulang bisa terlewat kalau koneksi buruk atau kasir langsung membuat transaksi baru, dan produk berstok 0 yang ada di draft opname masih bisa dihapus sehingga opname baru bisa difinalkan sesudah barisnya dibuang.
- Cek ulang audit menemukan dua temuan rendah, B3 (cek kiriman sesudah muat ulang) dan B4 (produk di draft opname bisa dihapus). Keduanya ditutup 24 November 2026 di `kasir-rilis`.
- Diuji 24 November 2026 pada salinan data produksi hari itu dengan sandi uji, lewat browser tanpa kepala di 1440 dan 390 px: aktivasi kasir di kedua cabang (batch awal sama dengan stok sheet), opname awal, jual, stok satu ukuran habis, barang masuk, penolakan sinkron sheet, dan batas admin cabang. Kotak uji chatbot langsung memakai stok baru, dan layar kasir cabang lain menampilkan stok baru sesudah halaman dimuat ulang.

### Ongkir

- Kalkulator untuk J&T Cargo dan Baraka Express menghitung dari berat dan volume kemasan. Barangnya bisa ban dari stok, velg, atau berat yang diisi sendiri.
- Tujuan dicari lewat OpenStreetMap, lalu kotanya dicocokkan dengan tabel tarif.
- Tarif per kota diisi owner dari daftar harga agen, satu per satu atau tempel banyak sekaligus.

### Chatbot stok

- Bot tidak memakai AI. Pesan dicocokkan ke cabang, ukuran, merek, atau jasa, lalu dijawab dari data stok dan harga jasa. Kalau barang tidak ada, stok kosong, harga kosong, atau pesan tidak dikenali, bot menyerahkan percakapan ke admin cabang dan diam.
- Di admin sudah ada Percakapan, Kotak uji, Templat pesan (termasuk teks balasan untuk sosial media), dan Pengaturan bot.
- Worker `scripts/bot-wa.ts` sudah ditulis dan bawaannya uji kering, yaitu hanya mencetak balasan tanpa mengirim.
- Cermin chat (24 November 2026, cabang `cermin-wa`, belum dirilis): tab owner *Cermin chat* berisi salinan hanya baca semua chat di nomor bot, diisi webhook WAHA berpengaman HMAC dan tombol Tarik riwayat, dengan penanda pelanggan, bot, atau admin dan lama simpan 180 hari. Worker mencatat id pesan yang ia kirim supaya pesan bot tidak tertulis admin. Rinciannya di [PANDUAN-ADMIN.md](PANDUAN-ADMIN.md), bagian Cermin chat.

### Server

- Satu VPS menjalankan Docker Compose berisi aplikasi Next.js dan Caddy. HTTPS diurus Caddy, dan `www` dialihkan ke domain utama.
- Database PostgreSQL berjalan di container sendiri, dan foto unggahan ada di volume terpisah dari image. Cadangan harian disimpan 14 hari di server.
- Memori container dibatasi. Akses SSH hanya dengan kunci, ditambah firewall dan fail2ban.

### Pemeriksaan tampilan admin

- Semua halaman admin diaudit tiga peninjau terpisah, lalu diperbaiki dalam lima tahap.
- Sesudah itu satu peninjau lain menguji klik 15 alur di desktop 1440 px dan HP 390 px. Dua alur gagal dan sudah diperbaiki.

### Uji pada salinan data produksi

Admin diuji di lokal memakai salinan database produksi dan sandi uji, tanpa login ke situs produksi.

- Semua halaman admin dibuka dengan tiga akun di 1440 px dan 390 px, 260 bukaan, tanpa galat dan tanpa luapan mendatar. Tamu dialihkan ke halaman login. Admin cabang ditolak dari halaman khusus owner.
- 35 form disimpan tanpa mengubah isian (23 form pengaturan, 7 panel Ubah, 5 form produk). Semuanya berhasil dan tampilan publik tetap sama.
- Pricelist yang sama diimpor ulang lewat panel "Perbarui dari pricelist". 325 baris masuk, tidak ada harga atau stok yang berubah.
- Admin cabang berhasil mengunggah foto cabangnya. Jenis unggahan lain ditolak.
- Naik versi 18 November 2026 (Next.js 16.3.6 ke 16.4.6, Prisma 7.10.0 ke 7.10.1) dibandingkan dengan versi sebelumnya pada data yang sama. Halaman admin, tampilan publik, dan jawaban API stok, ekspor, media, serta unggah tidak berbeda. Satu hal yang berubah: jawaban route handler yang bisa dimampatkan (ikon, manifest, teks) sekarang dikirim dengan gzip.
- Pindah ke PostgreSQL 20 November 2026 dibandingkan dengan versi SQLite pada data yang sama. Teks 54 alamat publik, admin, dan API serta jawaban 10 pesan uji chatbot sama persis. Rinciannya di [POSTGRES.md](POSTGRES.md).

## Yang belum

### Menunggu jawaban toko

1. Pricelist yang sudah diimpor itu milik cabang mana. Di cadangan 20 November 2026 ke-325 barisnya sudah ditetapkan ke Batu, tetapi kepastiannya dari toko belum tercatat di sini. Ikut ditanyakan: daftar stok cabang satunya, dan apakah harga dua cabang sama.
2. Daftar tarif agen J&T Cargo dan Baraka Express.
3. Berat dan ukuran kemasan ban per ring. Angka yang terpasang masih contoh.
4. Kepastian harga untuk empat baris di tab Perlu dicek.
5. Isi "paket" spooring di daftar harga jasa.
6. Foto mobil, velg, cabang, dan galeri. Foto dari Instagram terlalu kecil untuk dipakai.
7. Berkas logo Accelera dan Delium.
8. Akses akun sosial media toko untuk memasang balasan otomatis dan tautan pendek.
9. Kepastian merek ban truk (Aeolus, Swallow, dan lainnya). Barisnya belum dibuat.

### Menunggu keputusan pemilik proyek

- Nomor WhatsApp Business utama dan nomor admin tiap cabang. Tanpa ini bot tidak bisa disambungkan.
- Kelanjutan rancangan BejoStock: penyatuan stok ban dan produk situs. Kasir dan aturan diskon sudah diputuskan dan bagian 1-nya dibangun di branch `kasir-v1`. Pindah basis data sudah diputuskan ke PostgreSQL (20 November 2026), bukan MySQL. Daftar lengkapnya ada di bagian "Yang sengaja ditunda" di [PENYELARASAN-BEJOSTOCK.md](PENYELARASAN-BEJOSTOCK.md).
- Kalender libur dan promo. Halamannya ada di `/admin/kalender` tetapi disembunyikan dari menu, karena datanya belum dipakai bot maupun situs.
- Bawaan kotak "Kunci baris ini" di panel Ubah stok ban. Sekarang kotak itu tercentang dari awal, jadi menekan Simpan tanpa mengubah apa pun tetap mengunci baris dari sinkron dan impor berikutnya.
- Urusan server: waktu reboot untuk memasang kernel baru, deploy otomatis, cadangan ke luar server, dan kanal notifikasi pemantau.

### Pekerjaan teknis yang belum dikerjakan

- Menyambungkan chatbot: pasang WAHA (engine GOWS) di server, pindai QR, jalankan worker dalam mode uji ke nomor uji, lalu buka ke pelanggan. Worker dan label WhatsApp per cabang belum pernah dicoba ke WAHA sungguhan.
- Memasang cermin chat di produksi (sesudah cabang `cermin-wa` digabung):
  1. Isi env container app: `WAHA_WEBHOOK_HMAC` (kunci acak baru, mis. `openssl rand -hex 32`), serta `WAHA_URL=http://waha:3000`, `WAHA_API_KEY`, `WAHA_SESSION` untuk tombol Tarik riwayat.
  2. Rilis seperti biasa. Migrasi `20261124000000_cermin_wa` hanya menambah tiga tabel dan berjalan otomatis saat container mulai. Jalankan ulang worker bot dengan kode baru supaya id kiriman bot tercatat.
  3. Pasang webhook di sesi WAHA `default`: url `http://app:3000/api/waha/webhook`, events `message.any`, `message.revoked`, `message.edited`, `hmac.key` sama dengan `WAHA_WEBHOOK_HMAC`, retries misalnya `exponential` 5 kali. Lewat `PUT /api/sessions/default` dengan seluruh `config` lama ikut dikirim (ambil dulu dengan `GET /api/sessions/default`), karena permintaan itu mengganti seluruh konfigurasi sesi. Menurut dokumentasi WAHA, sesi yang sedang jalan dihentikan lalu dinyalakan lagi dengan konfigurasi baru, jadi lakukan saat sepi.
  4. Tutup alamat webhook dari internet di Caddy, karena WAHA memanggil app langsung lewat jaringan Docker: `@waha path /api/waha/*` lalu `respond @waha 404`. HMAC tetap menolak permintaan tanpa kunci kalau blok ini terlewat.
  5. Periksa: log WAHA menunjukkan kiriman webhook dijawab 200, tab Cermin chat terisi, lalu tekan Tarik riwayat sekali untuk chat lama.
- Perbaikan LID cermin chat (cabang `cermin-wa`, belum dirilis): migrasi aditif `20261124010000_cermin_lid` (tabel `wa_lid`). Sesudah rilis, chat ber-LID yang sudah tersimpan di produksi digabung ke nomornya saat pelanggan itu mengirim pesan lagi atau saat Tarik riwayat ditekan. Tidak perlu langkah manual.
- Header keamanan HTTP (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- `robots.txt`, `sitemap.xml`, dan penanda noindex untuk halaman admin.
- Dockerfile dan berkas Compose baru ada di server. Keduanya belum masuk repo.
- Pemeriksaan otomatis (lint, typecheck, tes) saat push belum ada.
- `npm audit` tanpa `--omit=dev` masih melaporkan `picomatch`, paket yang hanya dipakai alat lint. Versi perbaikannya belum ada.

### Belum diuji

- Halaman admin di produksi setelah login. Yang diuji adalah kode yang sama pada salinan data produksi di lokal.
- HP sungguhan. Uji HP memakai emulasi browser 390 px.
- Sinkron pricelist dari Google Sheets. Alamat sheet belum tersimpan di produksi, jadi yang teruji baru impor CSV.
- Tab Percakapan dengan data nyata, karena bot belum tersambung.
- Keadaan kosong tab Perlu dicek.
- Cermin chat dengan WAHA sungguhan. Payload webhook, jawaban `sendText`, dan daftar chat baru diuji dengan data buatan yang mengikuti kode engine GOWS. Yang perlu dilihat saat pertama dipasang: id chat dari webhook dan dari daftar chat sama bentuknya (`@c.us` atau `@lid`), dan pesan bot tertanda Bot.

## Keputusan yang sudah diambil

- Toko tidak menampilkan harga di situs. Karena itu produk berharga 0 dan berstok 0 sah, dan situs tidak pernah menulis "Rp 0". Usul auditor untuk menolak harga 0 sempat diterapkan lalu dicabut.
- Satu nomor WhatsApp untuk dua cabang. Cabang dikenali dari kalimat pembuka tautan pendek, atau ditanyakan bot.
- Chatbot tidak memakai AI dan tidak menebak. Yang tidak ada di data diserahkan ke admin.
- Tarif ongkir diisi dari daftar harga agen, karena kedua ekspedisi tidak menyediakan sumber tarif yang terbuka untuk dipakai.
- Admin cabang tidak bisa menambah produk atau mengubah data produk bersama.
- Stok ban tampil 50 baris per halaman.
- Kalender disembunyikan dari menu sampai datanya dipakai.
- Data nyata toko (pricelist, harga jasa, foto, logo pabrikan) tidak masuk git. Tempatnya di folder `data/` yang diabaikan git.
- Tampilan situs hitam putih, minimalis, tanpa elemen miring.
- Halaman daftar di admin memakai tabel ringkas dengan panel samping. Form bertumpuk per item ditolak.
- Cermin chat hanya untuk owner, hanya baca, dan menyimpan pesan paling lama 180 hari (bisa diatur). Berkas media tidak diunduh.

## Cara rilis

Belum ada deploy otomatis. Sebelum mulai, periksa dua hal di folder sumber:

- `npm audit --omit=dev` tidak melaporkan temuan tinggi atau kritis.
- `src/generated` dibuat dari skema dan versi Prisma yang sekarang. Kalau ragu, jalankan `npx prisma generate` (lihat Jebakan).

Urutan yang dipakai sejauh ini:

1. Di server, jalankan skrip cadangan `/usr/local/bin/bejoban-backup.sh` (sejak 20 November 2026 berisi `pg_dump` basis data dan foto unggahan) dan arsipkan folder kode lama.
2. Salin kode dari `main` ke `/opt/bejoban/app` dengan `rsync --delete`. Kecualikan `node_modules`, `.next`, `data`, `.env`, `.git`, `Dockerfile`, `.dockerignore`, `tsconfig.tsbuildinfo`, dan `next-env.d.ts`.
3. Jalankan `docker compose build app`, lalu `docker compose up -d app`. Container menjalankan `prisma migrate deploy` ke PostgreSQL setiap kali mulai. Build image memakai PostgreSQL sementara di dalam langkah build (berisi seed, lalu dibuang), karena prerender membaca database. Basis data produksi tidak dihubungi saat build. Build bisa dilakukan sebelum app dihentikan, karena container yang sedang jalan tetap memakai image lama.
4. Periksa `/`, `/produk`, dan `/admin/login`, lalu baca log container. Untuk tautan WhatsApp pakai alamat cabang yang tidak ada, misalnya `/wa/cek`, yang harus menjawab 404. Alamat cabang asli jangan dipakai untuk uji karena kliknya ikut terhitung.

Migrasi baru diuji dulu pada salinan database produksi sebelum dirilis. Pada 20 November 2026 `npm ci` di dalam build sekali melewati paket biner `lightningcss` untuk Linux tanpa galat, sehingga `next build` gagal. Dockerfile di server sekarang memeriksa paket biner itu bisa dimuat sesudah `npm ci`.

## Jebakan

- Kasir: sesudah kasir aktif di satu cabang, stok cabang itu tidak bisa lagi diganti dari pricelist dan belum ada jalan kembali ke mode sheet. Sebelum toko memakai kasir, ganti dulu sandi akun produksi yang masih gampang.
- Kasir: siaran realtime memakai pemancar di dalam proses. Kalau aplikasi suatu saat dijalankan lebih dari satu proses, ganti dengan `LISTEN/NOTIFY` PostgreSQL (lihat [KASIR.md](KASIR.md)).

- `npm run seed:lokal` menghapus semua harga jasa lalu membuatnya ulang dari `seed.json`. Skrip itu juga menimpa alamat dan foto cabang, serta nama, spesifikasi, dan foto produk yang ada di berkas. Di produksi `seed.json` sengaja hanya berisi bagian merek dan dua teks beranda. Versi lengkapnya disimpan sebagai `seed-lengkap.json` di folder yang sama. Jangan menjalankan seed lengkap di produksi.
- Seed tidak mengubah urutan dan status by order merek yang sudah ada. Urutan merek di produksi disetel langsung di database.
- `src/generated` (hasil `prisma generate`) diabaikan git tetapi ikut tersalin oleh rsync. Kalau folder sumber memuat hasil dari skema lama, hasil itu menimpa Prisma Client yang dibuat saat build image. Jalankan `npx prisma generate` di folder sumber sebelum menyalin. Hal yang sama berlaku sesudah menaikkan versi Prisma dengan `npm install <paket>`, karena perintah itu tidak menjalankan `postinstall`.
- `npx prisma db seed` selalu menulis ulang `data/CREDENTIALS-LOKAL.txt` di folder tempat ia dijalankan, walaupun `DATABASE_URL` menunjuk ke database lain. Kalau perlu menguji seed ke database sementara, jalankan dari salinan folder supaya catatan akun lokal tidak tertimpa.
- `SITE_URL` wajib terisi di `.env` server. Kalau kosong, tautan pendek dan gambar pratinjau memakai alamat dari header permintaan atau `localhost`.
- Versi Next.js di repo ini punya perubahan yang tidak ada di versi lama. Baca panduannya di `node_modules/next/dist/docs/` sebelum menulis kode (lihat `AGENTS.md`).
- Auditor tampilan tidak tahu aturan bisnis toko. Usulnya dicek dulu ke aturan di bagian keputusan sebelum diterapkan.
- Migrasi kasir (20261121 sampai 20261123) bertanggal lebih awal dari migrasi cermin chat yang sudah terpasang di produksi. Nama foldernya sengaja tidak diganti: `prisma migrate deploy` memasang migrasi yang belum tercatat tanpa memeriksa urutan, dan kedua kelompok tidak saling bergantung. Diuji 24 November 2026 di salinan basis data produksi: tiga migrasi kasir terpasang tanpa galat, `migrate status` bersih, dan skema hasilnya sama persis dengan basis data baru dari `npm run db:setup`. Mengganti nama folder justru membuat basis data lokal yang sudah memasang kasir mencoba memasangnya lagi.
- Kartu HP dengan tombol selebar penuh membuat halaman sangat panjang. Ukur tinggi halaman di 390 px sesudah mengubah tampilan daftar.

## Data lokal

`npm run db:setup` membuat database baru berisi produk contoh, dan akun awalnya ditulis ke `data/CREDENTIALS-LOKAL.txt`. Data nyata tidak ikut. Letak salinan pricelist, folder `seed-lokal`, dan database lokal yang terakhir dipakai dicatat di catatan pribadi.
