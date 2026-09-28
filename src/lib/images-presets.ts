// Ukuran final setiap jenis foto. Upload apa pun akan dipotong/diperkecil ke sini,
// jadi tampilan selalu pas walau foto aslinya beda rasio.
export const PRESETS = {
  logo: { w: 600, h: 200, fit: 'inside', label: 'Logo situs', ratio: 'bebas (melebar)', tip: 'PNG latar transparan atau SVG. Minimal tinggi 120 px.' },
  hero: { w: 2000, h: 800, fit: 'cover', label: 'Latar hero', ratio: '5:2', tip: 'Foto lebar, objek utama di sisi kanan karena kiri tertutup teks.' },
  heroSide: { w: 720, h: 1280, fit: 'cover', label: 'Foto samping hero', ratio: '9:16', tip: 'Foto potret seperti cover reel Instagram.' },
  product: { w: 1200, h: 1200, fit: 'contain', label: 'Foto produk', ratio: '1:1', tip: 'Produk di tengah, latar polos. Sisa ruang diisi putih otomatis.' },
  category: { w: 400, h: 400, fit: 'contain', label: 'Ikon kategori', ratio: '1:1', tip: 'PNG transparan, barang saja tanpa latar.' },
  brand: { w: 400, h: 200, fit: 'contain', label: 'Logo merek', ratio: '2:1', tip: 'PNG transparan atau SVG.' },
  car: { w: 1400, h: 700, fit: 'cover', label: 'Kartu rekomendasi mobil', ratio: '2:1', tip: 'Mobil dari samping/depan, bagian atas kiri agak kosong untuk judul.' },
  promo: { w: 2400, h: 640, fit: 'cover', label: 'Banner promo', ratio: '15:4', tip: 'Banner sangat lebar. Teks penting taruh di tengah agar aman di HP.' },
  store: { w: 800, h: 900, fit: 'cover', label: 'Foto toko (panel samping)', ratio: '8:9', tip: 'Tampak depan bengkel.' },
  branch: { w: 1200, h: 700, fit: 'cover', label: 'Foto cabang', ratio: '12:7', tip: 'Tampak depan atau suasana bengkel.' },
  payment: { w: 240, h: 80, fit: 'contain', label: 'Logo pembayaran', ratio: '3:1', tip: 'PNG transparan.' },
  og: { w: 1200, h: 630, fit: 'cover', label: 'Gambar share (WA/FB)', ratio: '1.91:1', tip: 'Muncul saat link dibagikan.' },
} as const

export type PresetKey = keyof typeof PRESETS
