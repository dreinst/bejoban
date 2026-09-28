# Panduan Admin Bejo Ban

Halaman admin ada di `/admin`. Ada dua peran:

| Peran | Bisa mengatur |
| --- | --- |
| Owner | Semua: produk, harga semua cabang, tampilan web, kategori, merek, cabang, pengguna |
| Admin cabang | Produk (data dan foto), harga dan stok cabangnya sendiri, data cabangnya sendiri |

## Menu

- **Produk**: tambah, ubah, sembunyikan produk. Satu produk bisa dijual di beberapa cabang dengan harga dan stok berbeda.
- **Pricelist & Stok**: tabel semua produk per cabang. Ubah banyak harga sekaligus lalu tekan *Simpan semua harga*. Centang *Flash* agar produk masuk bagian Flash Sale.
- **Tampilan Web**: semua teks dan foto di halaman depan (hero, bar keunggulan, panel layanan, alur belanja, flash sale, banner promo, rekomendasi mobil, galeri, footer, SEO).
- **Kategori** dan **Merek**: nama, urutan, ikon atau logo.
- **Cabang**: alamat, WhatsApp, jam buka, Instagram, link Maps, foto.
- **Pengguna**: buat akun admin, atur peran dan cabangnya, ganti password.
- **Panduan Ukuran Foto**: tabel yang sama dengan di bawah.

Produk dengan label **CONTOH** adalah data isian awal. Ganti nama, harga, dan fotonya, lalu hilangkan centang *Tandai sebagai produk contoh*, atau hapus produknya.

## Ukuran foto

Semua foto yang diunggah otomatis dipotong ke rasio yang benar, diperkecil, lalu disimpan sebagai WebP. Jadi foto dengan rasio berbeda tetap pas di tampilannya. Hasil paling tajam didapat kalau foto aslinya sama atau lebih besar dari ukuran ideal.

| Dipakai untuk | Ukuran ideal | Rasio | Cara diproses | Tips |
| --- | --- | --- | --- | --- |
| Logo situs | 600 × 200 px | bebas (melebar) | Utuh, diperkecil | PNG latar transparan atau SVG. Minimal tinggi 120 px. |
| Latar hero | 2000 × 800 px | 5:2 | Dipotong penuh | Foto lebar, objek utama di sisi kanan karena kiri tertutup teks. |
| Foto samping hero | 720 × 1280 px | 9:16 | Dipotong penuh | Foto potret seperti cover reel Instagram. |
| Foto produk | 1200 × 1200 px | 1:1 | Utuh, sisa diberi latar | Produk di tengah, latar polos. Sisa ruang diisi putih otomatis. |
| Ikon kategori | 400 × 400 px | 1:1 | Utuh, sisa diberi latar | PNG transparan, barang saja tanpa latar. |
| Logo merek | 400 × 200 px | 2:1 | Utuh, sisa diberi latar | PNG transparan atau SVG. |
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
