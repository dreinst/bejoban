# Bejo Ban

Web toko Bejo Ban (Authorized Hankook & Michelin Dealer, cabang Batu dan Karanglo). Tata letak toko mengikuti otomax.store. Pesanan dikirim ke WhatsApp cabang, pembayaran online menyusul.

Dibangun dengan Next.js 16, Prisma 7 (SQLite untuk lokal), Tailwind 4, dan sharp untuk memproses foto.

## Menjalankan di lokal

```bash
npm install
cp .env.example .env        # lalu isi SESSION_SECRET dengan string acak
npm run db:setup            # buat database + isi data awal
npm run dev
```

Buka http://localhost:3000 untuk toko dan http://localhost:3000/admin untuk admin. Akun admin awal (password acak) ditulis ke `data/CREDENTIALS-LOKAL.txt`. Ganti password setelah login.

Database dan foto yang diunggah tersimpan di folder `data/` (tidak ikut git).

## Struktur

- `src/app/(shop)`: halaman toko (beranda, produk, detail, keranjang, galeri, kalkulator ban)
- `src/app/admin`: halaman admin dan server action
- `src/lib/content.ts`: daftar bagian halaman depan yang bisa diedit dari admin
- `src/lib/images-presets.ts`: ukuran foto per jenis
- `prisma/seed.ts`: data awal, termasuk produk contoh dan foto dari Instagram

Panduan untuk admin toko ada di [docs/PANDUAN-ADMIN.md](docs/PANDUAN-ADMIN.md).
