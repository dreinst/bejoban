# Status pekerjaan Bejo Ban

Keadaan per 20 November 2026. Dokumen ini mencatat yang sudah selesai, yang belum, dan keputusan yang sudah diambil, supaya pekerjaan berikutnya bisa dimulai dari cabang `main`.

Repo ini publik. Sandi, nomor telepon, harga asli, alamat server, dan urusan tagihan tidak ditulis di sini. Semuanya dicatat di luar repo, di `~/ndru/bejoban-aset/CATATAN-PRIBADI.md` pada mesin pengembang.

## Keadaan sekarang

- Situs tayang di https://bejoban.com dengan kode yang sama dengan cabang `main`.
- Memakai Next.js 16.4.6 dan Prisma 7.10.1 (naik versi 18 November 2026), dengan PostgreSQL 18 sejak 20 November 2026 (sebelumnya SQLite). Rinciannya di [POSTGRES.md](POSTGRES.md).
- `npm test` lulus 141 tes (butuh PostgreSQL, lihat [POSTGRES.md](POSTGRES.md)). `npm run lint` dan `npm run typecheck` bersih. `npm audit --omit=dev` tanpa temuan.
- Halaman admin dan stok ban sudah bisa dipakai. Kalkulator ongkir sudah jalan, tetapi tabel tarif di produksi masih kosong, jadi hasilnya belum memuat biaya.
- Chatbot stok selesai sampai kotak uji di admin. Bot belum tersambung ke WhatsApp.
- Isi database produksi: 325 baris stok ban (semuanya belum punya cabang), 14 harga jasa, 16 produk (6 tayang), 11 merek, 2 cabang, dan 3 akun admin.

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

### Ongkir

- Kalkulator untuk J&T Cargo dan Baraka Express menghitung dari berat dan volume kemasan. Barangnya bisa ban dari stok, velg, atau berat yang diisi sendiri.
- Tujuan dicari lewat OpenStreetMap, lalu kotanya dicocokkan dengan tabel tarif.
- Tarif per kota diisi owner dari daftar harga agen, satu per satu atau tempel banyak sekaligus.

### Chatbot stok

- Bot tidak memakai AI. Pesan dicocokkan ke cabang, ukuran, merek, atau jasa, lalu dijawab dari data stok dan harga jasa. Kalau barang tidak ada, stok kosong, harga kosong, atau pesan tidak dikenali, bot menyerahkan percakapan ke admin cabang dan diam.
- Di admin sudah ada Percakapan, Kotak uji, Templat pesan (termasuk teks balasan untuk sosial media), dan Pengaturan bot.
- Worker `scripts/bot-wa.ts` sudah ditulis dan bawaannya uji kering, yaitu hanya mencetak balasan tanpa mengirim.

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

1. Pricelist yang sudah diimpor itu milik cabang mana. Sampai dijawab, 325 baris stok ban belum punya cabang. Ikut ditanyakan: daftar stok cabang satunya, dan apakah harga dua cabang sama.
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
- Kelanjutan rancangan BejoStock: kasir, penyatuan stok ban dan produk situs, serta aturan diskon. Pindah basis data sudah diputuskan ke PostgreSQL (20 November 2026), bukan MySQL. Daftar lengkapnya ada di bagian "Yang sengaja ditunda" di [PENYELARASAN-BEJOSTOCK.md](PENYELARASAN-BEJOSTOCK.md).
- Kalender libur dan promo. Halamannya ada di `/admin/kalender` tetapi disembunyikan dari menu, karena datanya belum dipakai bot maupun situs.
- Kolom batas minimum stok.
- Bawaan kotak "Kunci baris ini" di panel Ubah stok ban. Sekarang kotak itu tercentang dari awal, jadi menekan Simpan tanpa mengubah apa pun tetap mengunci baris dari sinkron dan impor berikutnya.
- Urusan server: waktu reboot untuk memasang kernel baru, deploy otomatis, cadangan ke luar server, dan kanal notifikasi pemantau.

### Pekerjaan teknis yang belum dikerjakan

- Menyambungkan chatbot: pasang WAHA (engine GOWS) di server, pindai QR, jalankan worker dalam mode uji ke nomor uji, lalu buka ke pelanggan. Worker dan label WhatsApp per cabang belum pernah dicoba ke WAHA sungguhan.
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

## Cara rilis

Belum ada deploy otomatis. Sebelum mulai, periksa dua hal di folder sumber:

- `npm audit --omit=dev` tidak melaporkan temuan tinggi atau kritis.
- `src/generated` dibuat dari skema dan versi Prisma yang sekarang. Kalau ragu, jalankan `npx prisma generate` (lihat Jebakan).

Urutan yang dipakai sejauh ini:

1. Di server, jalankan skrip cadangan `/usr/local/bin/bejoban-backup.sh` dan arsipkan folder kode lama.
2. Salin kode dari `main` ke `/opt/bejoban/app` dengan `rsync --delete`. Kecualikan `node_modules`, `.next`, `data`, `.env`, `.git`, `Dockerfile`, `.dockerignore`, `tsconfig.tsbuildinfo`, dan `next-env.d.ts`.
3. Jalankan `docker compose build app`, lalu `docker compose up -d app`. Container menjalankan `prisma migrate deploy` setiap kali mulai.
4. Periksa `/`, `/produk`, dan `/admin/login`, lalu baca log container. Untuk tautan WhatsApp pakai alamat cabang yang tidak ada, misalnya `/wa/cek`, yang harus menjawab 404. Alamat cabang asli jangan dipakai untuk uji karena kliknya ikut terhitung.

Migrasi baru diuji dulu pada salinan database produksi sebelum dirilis.

## Jebakan

- `npm run seed:lokal` menghapus semua harga jasa lalu membuatnya ulang dari `seed.json`. Skrip itu juga menimpa alamat dan foto cabang, serta nama, spesifikasi, dan foto produk yang ada di berkas. Di produksi `seed.json` sengaja hanya berisi bagian merek dan dua teks beranda. Versi lengkapnya disimpan sebagai `seed-lengkap.json` di folder yang sama. Jangan menjalankan seed lengkap di produksi.
- Seed tidak mengubah urutan dan status by order merek yang sudah ada. Urutan merek di produksi disetel langsung di database.
- `src/generated` (hasil `prisma generate`) diabaikan git tetapi ikut tersalin oleh rsync. Kalau folder sumber memuat hasil dari skema lama, hasil itu menimpa Prisma Client yang dibuat saat build image. Jalankan `npx prisma generate` di folder sumber sebelum menyalin. Hal yang sama berlaku sesudah menaikkan versi Prisma dengan `npm install <paket>`, karena perintah itu tidak menjalankan `postinstall`.
- `npx prisma db seed` selalu menulis ulang `data/CREDENTIALS-LOKAL.txt` di folder tempat ia dijalankan, walaupun `DATABASE_URL` menunjuk ke database lain. Kalau perlu menguji seed ke database sementara, jalankan dari salinan folder supaya catatan akun lokal tidak tertimpa.
- `SITE_URL` wajib terisi di `.env` server. Kalau kosong, tautan pendek dan gambar pratinjau memakai alamat dari header permintaan atau `localhost`.
- Versi Next.js di repo ini punya perubahan yang tidak ada di versi lama. Baca panduannya di `node_modules/next/dist/docs/` sebelum menulis kode (lihat `AGENTS.md`).
- Auditor tampilan tidak tahu aturan bisnis toko. Usulnya dicek dulu ke aturan di bagian keputusan sebelum diterapkan.
- Kartu HP dengan tombol selebar penuh membuat halaman sangat panjang. Ukur tinggi halaman di 390 px sesudah mengubah tampilan daftar.

## Data lokal

`npm run db:setup` membuat database baru berisi produk contoh, dan akun awalnya ditulis ke `data/CREDENTIALS-LOKAL.txt`. Data nyata tidak ikut. Letak salinan pricelist, folder `seed-lokal`, dan database lokal yang terakhir dipakai dicatat di catatan pribadi.
