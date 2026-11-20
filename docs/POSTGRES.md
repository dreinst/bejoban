# PostgreSQL

Sejak 20 November 2026 Bejo Ban memakai PostgreSQL 18, menggantikan SQLite. Alasannya: sistem kasir yang akan dibangun butuh banyak penulisan bersamaan dari beberapa cabang, dan SQLite hanya bisa menulis satu per satu. Stok ban dari pricelist (`StockTire`) dan produk situs (`Product`, `Listing`) tetap terpisah seperti sebelumnya.

Perpindahan ini hanya mengganti mesin basis data. Tampilan dan perilaku sama dengan versi SQLite. Perbandingannya pada salinan data produksi dicatat di bagian akhir.

## Menjalankan di lokal

PostgreSQL berjalan di container Docker. Contoh di bawah memakai nama `bejoban-pg-uji` dan port 55432 supaya tidak bentrok dengan PostgreSQL lain di mesin yang sama.

```bash
# sandi.env berisi satu baris: POSTGRES_PASSWORD=<sandi acak>. Simpan di luar repo.
docker run -d --name bejoban-pg-uji --restart unless-stopped --memory 512m \
  -p 127.0.0.1:55432:5432 --env-file sandi.env \
  -e POSTGRES_USER=bejoban -e POSTGRES_DB=bejoban \
  -e "POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale=C" \
  -v bejoban-pg-uji:/var/lib/postgresql \
  postgres:18-alpine \
  -c shared_buffers=128MB -c max_connections=30 -c work_mem=4MB \
  -c maintenance_work_mem=32MB -c effective_cache_size=384MB
```

Lalu isi `.env`:

```
DATABASE_URL="postgresql://bejoban:<sandi>@127.0.0.1:55432/bejoban"
```

dan jalankan `npm run db:setup` untuk membuat tabel dan data contoh, atau salin data dari berkas SQLite lama (lihat di bawah).

Dua hal tentang container itu:

- Mulai versi 18, image resmi `postgres` menyimpan data di `/var/lib/postgresql/18/docker`, jadi volume dipasang ke `/var/lib/postgresql`, bukan ke `/var/lib/postgresql/data` seperti di versi lama.
- `--locale=C` membuat urutan teks sama dengan SQLite (per byte), dan pencarian tanpa membedakan huruf besar kecil hanya melipat huruf ASCII, sama seperti `LIKE` di SQLite. Jangan diganti tanpa membandingkan ulang urutan daftar stok ban dan produk.

Di server, PostgreSQL memakai major version yang sama (18) dengan batas memori 768 MB. Pengaturan servernya dicatat di luar repo.

## Koneksi

`src/lib/db.ts` memakai `@prisma/adapter-pg` dengan pool kecil: paling banyak 5 koneksi untuk app dan 2 untuk worker `bot:wa` (diatur lewat `DB_POOL_MAX`). Prisma 7 tidak lagi membaca `connection_limit` dari `DATABASE_URL`, jadi batasnya ditulis di kode. Dengan `max_connections=30`, app, worker, dan beberapa perintah `psql` atau `prisma` masih muat.

## Tes

`npm test` butuh server PostgreSQL yang menyala. Tes yang menyentuh basis data (`tests/stok-db.test.ts` dan `tests/stok-cabang-db.test.ts`) memakai `tests/db-uji.ts`: tiap berkas membuat basis data baru bernama `bejoban_uji_<nama>_<acak>`, menjalankan `prisma migrate deploy`, lalu menghapusnya sesudah selesai. Basis data dev tidak dibuka.

Server diambil dari `TEST_DATABASE_URL`, atau dari `DATABASE_URL` kalau yang pertama kosong. Akunnya harus boleh membuat basis data (akun `POSTGRES_USER` di container sudah boleh).

```bash
npm test
# atau ke server lain:
TEST_DATABASE_URL="postgresql://bejoban:<sandi>@127.0.0.1:55432/postgres" npm test
```

Kalau tes berhenti di tengah, basis data sementaranya bisa tertinggal. Cari dengan `SELECT datname FROM pg_database WHERE datname LIKE 'bejoban_uji_%'` lalu hapus dengan `DROP DATABASE ... WITH (FORCE)`.

## Migrasi

Delapan migrasi SQLite lama tidak bisa dijalankan di PostgreSQL. Penggantinya satu migrasi dasar, `prisma/migrations/20261120000000_postgres_dasar`, yang dibuat dengan `prisma migrate diff --from-empty --to-schema prisma/schema.prisma`, ditambah satu indeks yang ditulis manual (lihat di bawah). `migration_lock.toml` sekarang `postgresql`. Migrasi lama dihapus dari folder dan tetap bisa dilihat di riwayat git (commit `4217b3a` dan sebelumnya).

Akibatnya basis data SQLite lama tidak bisa dinaikkan lewat `prisma migrate deploy`. Datanya dipindah dengan skrip penyalin.

Indeks unik parsial `StockTire_kode_tanpa_cabang_key` (`kode` dengan syarat `cabang_id IS NULL`) menjaga kode unik untuk baris stok ban tanpa cabang. Indeks gabungan `(kode, cabang_id)` tidak menjaganya karena PostgreSQL, seperti SQLite, menganggap NULL selalu berbeda. Prisma belum bisa menuliskan indeks parsial di skema, jadi indeks itu ada di SQL migrasi saja.

## Menyalin data dari SQLite

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx tsx scripts/salin-sqlite-ke-pg.ts data/bejoban.db
```

Skrip itu:

1. membuka berkas SQLite hanya baca (`node:sqlite` bawaan Node 24, tanpa paket tambahan);
2. menolak kalau tabel atau kolom kedua sisi tidak sama, atau kalau basis data tujuan sudah berisi;
3. menyalin semua tabel dengan id aslinya, urut menurut relasi, dalam satu transaksi;
4. menyetel sequence tiap kolom id ke id terbesar, atau ke nilai `sqlite_sequence` kalau lebih besar, supaya id baru sama dengan yang akan dipakai SQLite;
5. membandingkan jumlah baris dan sidik isi tiap tabel, total stok ban, total stok listing, jumlah perubahan buku stok, total harga stok ban, dan total klik WhatsApp, lalu keluar dengan kode 1 kalau ada yang beda.

`--periksa-saja` hanya menjalankan langkah perbandingan. Berguna untuk mencocokkan lagi sesudah app hidup, selama belum ada data baru.

Konversi yang dilakukan:

- `DateTime`: adapter SQLite menyimpan teks ISO UTC (`2026-11-15T17:07:50.618+00:00`). Skrip juga menerima teks `CURRENT_TIMESTAMP` dan angka milidetik. Kolom PostgreSQL `timestamp(3)` tanpa zona, berisi waktu UTC. Skrip menulis nilai sebagai teks, karena driver `pg` mengubah objek `Date` ke zona waktu mesin.
- `Boolean`: 0 dan 1 menjadi false dan true. Nilai lain ditolak.
- `Int`: ditolak kalau tidak muat di integer 32 bit. Di SQLite `INTEGER` berukuran 64 bit. Nilai terbesar di data produksi 20 November 2026 adalah 6.875.000 (harga), jadi belum ada kolom yang perlu `BigInt`.
- `Float` (`ShippingRate.minWeight`): disalin apa adanya ke `double precision`.

## Perbedaan perilaku yang disesuaikan di kode

- Pencarian. Di SQLite `contains` tidak membedakan huruf besar kecil untuk huruf ASCII, di PostgreSQL membedakan. Semua `contains` dari isian pengguna (situs produk, stok ban, produk situs di admin, percakapan chatbot) diberi `mode: 'insensitive'`. Pencocokan persis (`equals`, nama pengguna saat login, merek di saringan) memang membedakan huruf besar kecil di kedua mesin.
- Urutan NULL. Untuk urutan naik, SQLite menaruh NULL di depan dan PostgreSQL di belakang. Satu-satunya yang berpengaruh ke tampilan adalah daftar Produk situs di admin yang diurutkan menurut urutan kategori: produk tanpa kategori tetap ditaruh di depan lewat urut ulang di `src/app/admin/(panel)/harga/page.tsx`. Pengelompokan ukuran di kalkulator ongkir memakai `nulls: 'first'` untuk `cabang_id`.
- Urutan yang kembar atau tidak disebut. SQLite mengembalikan baris yang nilai urutnya sama, atau kueri tanpa `orderBy`, menurut urutan id. PostgreSQL tidak menjamin urutannya. Urutan yang bisa kembar (cabang menurut `sort`, harga jasa menurut `sort`, produk menurut nama) diberi `id` sebagai pemecah seri. Kueri tanpa `orderBy` yang hasilnya dipakai berurutan juga diberi urutan id: stok ban dan merek by order untuk chatbot (harga kembar tetap urut id karena mesin bot mengurutkan dengan sort stabil), tarif per ekspedisi (kota pertama yang cocok dipakai), baris lama saat impor, cabang saat impor gabungan dan simpan pengaturan, percakapan yang menunggu kiriman penutup, dan listing saat produk dihapus (sekaligus membuat urutan kunci baris tetap).
- Perubahan stok bersamaan. SQLite menjalankan penulisan satu per satu. Di PostgreSQL dengan isolasi Read Committed, dua transaksi bisa membaca saldo yang sama lalu salah satu perubahan hilang. `ubahStokTx` di `src/lib/stok/ubah.ts` sekarang mengunci baris stok (`SELECT ... FOR UPDATE`) sebelum membaca saldo. Impor pricelist, tetapkan cabang, dan pengisian kode kosong diantrekan dengan kunci `pg_advisory_xact_lock`, supaya dua impor bersamaan tidak bentrok di indeks unik kode. Kunci antrean selalu diambil sebelum kunci baris. Tesnya ada di `tests/stok-db.test.ts`, dan tes itu gagal kalau kuncinya dicabut.

## Hasil perbandingan pada salinan data produksi

Diuji 20 November 2026 di lokal dengan salinan cadangan harian produksi dan sandi uji, tanpa login ke situs produksi. Versi lama (commit `4217b3a`, SQLite) dan versi baru (PostgreSQL) dijalankan bergantian di port yang sama, masing-masing mulai dari isi data yang sama.

- Skrip penyalin: semua tabel sama jumlah baris dan sidik isinya, begitu juga total stok dan id berikutnya.
- Teks 54 alamat sama persis: beranda, daftar produk (termasuk pencarian `Hankook`, `hankook`, `HANKOOK`, `Bridgestone`, `bridgestone`, saringan merek, dan urutan harga), dua detail produk, galeri, kalkulator ban, semua halaman admin owner (Ringkasan, Stok ban dengan pencarian ukuran dan merek dalam beberapa bentuk huruf, halaman 2 dan 7, saringan ring dan keadaan, tampilan banding, Produk situs, Harga jasa, Perlu dicek, Ongkir, Tarif, Chatbot, Templat, Pengaturan, Merek, Kategori, Cabang, Pengguna, Kalender), serta jawaban `/api/stok` dan ekspor `/api/buku-stok`.
- Sepuluh pesan di Kotak uji chatbot (ukuran, merek, jasa, cabang) mendapat jawaban dan alasan yang sama persis.
- Daftar rute hasil `next build` sama, termasuk rute yang dirender statis.

Build Next.js tetap butuh basis data, karena prerender membaca tabel `Setting`. Dulu image dibuild dengan berkas SQLite sementara berisi seed. Sekarang image dibuild dengan PostgreSQL sementara di dalam langkah build, berisi seed, yang dibuang sesudahnya. Basis data produksi tidak dihubungi saat build.

`npm audit --omit=dev` pada 20 November 2026 melaporkan celah ReDoS di `effect` (GHSA-7589-6fvf-x4pw), yang dipakai `@prisma/config` milik CLI `prisma` dengan versi terkunci 3.20.0. Celah itu juga ada di commit `4217b3a`. Belum ada Prisma yang lebih baru dari 7.10.1, jadi `package.json` memakai `overrides` ke `effect` 3.22.5. Hapus override itu sesudah Prisma memperbarui dependensinya.
