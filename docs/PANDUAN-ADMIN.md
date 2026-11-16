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

## Fitur internal (khusus owner, kecuali Ongkir)

Halaman ini untuk keperluan toko dan masih berupa draf untuk dicoba. Data nyata client (pricelist, harga jasa) disimpan di database lokal dan folder `data/`, tidak boleh masuk git.

### Situs dan WhatsApp

- **Nomor WhatsApp utama**: satu nomor untuk dua cabang. Kalau kosong, situs memakai nomor tiap cabang.
- **Tautan pendek**: semua tombol WhatsApp di situs mengarah ke `/wa/batu`, `/wa/karanglo`, atau `/wa` (umum). Tautan itu mengalihkan ke `wa.me/<nomor utama>?text=<kalimat pembuka cabang>`, jadi nomor dan kalimat cukup diubah di satu tempat. Ketiga tautan tampil di halaman ini dengan tombol salin, untuk dipasang di Google Maps, bio Instagram, dan QR di toko. Hitungan klik per cabang per hari ikut tampil (tanpa data pribadi).
- **Kalimat pembuka** bisa diedit. Pertahankan nama cabang (`{cabang}`), karena bot mengenali cabang dari kata Batu atau Karanglo di pesan.
- **Tampilkan harga di situs**: bawaan mati. Saat mati, beranda, daftar produk, detail, keranjang, dan flash sale hanya menampilkan ajakan tanya harga lewat WhatsApp. Halaman admin tetap menampilkan harga. Harga jasa tidak pernah tampil di situs.

### Stok ban

- **Sinkron dari Google Sheets**: isi URL spreadsheet (disimpan di database, bukan di kode), lalu tekan *Sinkron sekarang*. Spreadsheet harus dibagikan sebagai "Siapa saja yang memiliki tautan dapat melihat". Yang diambil adalah ekspor CSV tab yang sedang dibuka (angka `gid` di URL).
- **Impor CSV** dengan berkas atau tempel isi tetap tersedia. Keduanya memakai pengurai yang sama.
- Hasil impor menampilkan jumlah baris masuk dan daftar baris bermasalah apa adanya. Harga kosong berarti barang belum pernah dibeli toko, jadi bot menganggapnya tidak tersedia. Harga janggal (misalnya `1.825.0000`) tidak ditebak: isi manual di tabel stok.
- Keterangan `disc 50.000` dibaca sebagai potongan. Harga asli dan potongan disimpan terpisah, bot menyebut harga setelah potongan beserta harga asalnya.
- **Edit langsung di tabel**: ubah harga, potongan, stok, atau keterangan per baris lalu Simpan. Baris itu diberi penanda *manual*. Centang *Kunci* supaya sinkron berikutnya tidak menimpanya. Baris manual yang tidak dikunci ditimpa data baru. Baris manual yang dikunci tapi hilang dari spreadsheet tetap disimpan. Filter *Harga bermasalah* dan *Diubah manual* membantu menemukan barisnya.

### Harga jasa

Tabel harga jasa (spooring, balance, nitrogen, pasang atau bongkar ban, ganti oli) yang bisa diedit. Chatbot menjawab dari tabel ini. Kalau jasanya tidak ada atau harganya kosong, bot menyerahkan ke admin. "Paket" spooring ditulis apa adanya, isinya tidak dijelaskan di tabel. Untuk mengisi data awal dari berkas lokal `data/seed-lokal.json`, jalankan `npm run seed:lokal`.

### Ongkir

- **Kalkulator** (`/admin/ongkir`, semua admin): pilih ban dari stok, velg, atau berat manual. Tujuan dicari lewat kotak pencarian lokasi (OpenStreetMap lewat server, hasil disimpan di cache database). Pencarian hanya jalan saat tombol ditekan. Hasilnya nama tempat, kecamatan, kota atau kabupaten, provinsi, koordinat, dan jarak garis lurus dari cabang asal. Kota hasil pencarian dicocokkan dengan tabel tarif J&T Cargo dan Baraka Express. Kalau belum ada tarifnya, tampil "tarif belum diisi" dengan tautan untuk menambah tarif kota itu.
- **Tarif dan pengaturan** (owner): tarif per kota diisi dari daftar harga agen. Atur juga koordinat cabang asal, pembagi berat volume, packing per ban, berat velg, dan berat serta ukuran kemasan ban per ring (R12 sampai R19). Berat velg bawaan 10 kg, perkiraan toko (7 sampai 12 kg). Berat ban belum pernah dihitung toko, jadi angka bawaannya berlabel contoh.
- Baris tarif dan berat ban bertanda CONTOH tampil dengan label "contoh, belum dari agen". Hilangkan centang *Contoh* setelah angkanya dari agen.
- Penyedia lokasi bawaan OpenStreetMap tanpa kunci. Untuk memakai Google Maps nanti, isi `GOOGLE_MAPS_API_KEY` di `.env`.

### Chatbot

Bot bukan AI. Alurnya: pesan masuk, kenali cabang dan ukuran atau merek, cari di data stok dan harga jasa. Ada dan stok lebih dari 0 (atau jasa ada di tabel): kirim harga dan stok asli. Tidak ada, stok 0, harga kosong, atau pesan tidak dikenali: bot tidak menjawab harga, mengirim satu kalimat bahwa admin akan membalas, mengirim ringkasan ke nomor admin cabang, lalu diam di chat itu selama jangka waktu yang diatur. Admin menandai percakapan *Selesai, tersedia* atau *Selesai, tidak tersedia* (bot lalu mengirim kalimat penutup).

- **Cabang**: dikenali dari kata Batu, Karanglo, atau Singosari di mana pun dalam pesan. Cabang tidak ditanyakan sebelum menjawab stok. Bot menanyakannya (balas 1 atau 2) hanya sebelum serah terima ke admin, atau saat pelanggan mau datang, pasang, atau booking. Pilihan diingat per nomor pelanggan (bawaan 30 hari), dan pelanggan bisa mengganti dengan mengetik "ganti cabang" atau nama cabang lain. Kalau cabang belum diketahui dan pertanyaan cabang tidak dijawab, percakapan diserahkan ke nomor owner.
- **Tab Percakapan dan kotak uji**: daftar percakapan dengan filter status dan cabang, tombol penanda selesai, dan kotak uji (tidak membuat percakapan, tidak mengirim apa pun).
- **Tab Pengaturan**: Sambungan WhatsApp (satu WAHA GOWS, satu nomor), Jam dan batas kirim, Templat pesan (dengan pratinjau), Nomor admin per cabang, dan Sosial media (templat balasan otomatis Instagram, Facebook, dan TikTok berisi tautan WhatsApp, disalin admin, tanpa integrasi API).
- **Worker** (`scripts/bot-wa.ts`, `npm run bot:wa`) membaca WAHA secara berkala. Bawaannya uji kering (hanya mencetak dan mencatat). Isi `WAHA_URL`, `WAHA_API_KEY`, `WAHA_SESSION` di `.env`, dan tambahkan `BOT_SEND=1` hanya kalau memang mau mengirim. Selama masa uji, pembatasan ke nomor uji aktif. Worker belum pernah dicoba ke WAHA, dan label WhatsApp per cabang baru berupa fungsi kosong bercatatan.

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
