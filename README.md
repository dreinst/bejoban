# Bejo Ban

Web toko Bejo Ban (Authorized Hankook & Michelin Dealer, cabang Batu dan Karanglo), tayang di https://bejoban.com. Situs publiknya tidak menampilkan harga dan mengarahkan pengunjung ke WhatsApp cabang. Halaman admin dipakai untuk stok ban, estimasi ongkir, dan chatbot stok.

Yang sudah selesai dan yang belum dicatat di [docs/STATUS.md](docs/STATUS.md).

Dibangun dengan Next.js 16, Prisma 7 dengan PostgreSQL 18, Tailwind 4, dan sharp untuk memproses foto.

## Menjalankan di lokal

Butuh PostgreSQL 18. Cara menjalankannya di Docker ada di [docs/POSTGRES.md](docs/POSTGRES.md).

```bash
npm install
cp .env.example .env        # lalu isi DATABASE_URL dan SESSION_SECRET (string acak)
npm run db:setup            # buat tabel + isi data awal
npm run dev
```

Buka http://localhost:3000 untuk toko dan http://localhost:3000/admin untuk admin. Akun admin awal (password acak) ditulis ke `data/CREDENTIALS-LOKAL.txt`. Ganti password setelah login.

Foto yang diunggah tersimpan di folder `data/` (tidak ikut git). Datanya ada di basis data PostgreSQL yang ditunjuk `DATABASE_URL`.

## Struktur

- `src/app/(shop)`: halaman toko (beranda, produk, detail, galeri, kalkulator ban)
- `src/app/admin`: halaman admin dan server action
- `src/lib/content.ts`: daftar bagian halaman depan yang bisa diedit dari admin
- `src/lib/images-presets.ts`: ukuran foto per jenis
- `prisma/seed.ts`: data awal, termasuk produk contoh dan foto dari Instagram

Panduan untuk admin toko ada di [docs/PANDUAN-ADMIN.md](docs/PANDUAN-ADMIN.md).
