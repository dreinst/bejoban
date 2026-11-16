// Aturan simpan produk di admin. Modul murni supaya bisa dites tanpa database.

/**
 * Data produk (nama, deskripsi, foto, tampil di web, produk contoh) dipakai bersama semua cabang,
 * jadi hanya owner yang boleh mengubahnya atau membuat produk baru.
 * Admin cabang hanya menyimpan harga dan stok cabangnya pada produk yang sudah ada.
 */
export function aksesSimpanProduk(role: string, id: number): 'penuh' | 'harga' | 'tolak' {
  if (role === 'OWNER') return 'penuh'
  return id > 0 ? 'harga' : 'tolak'
}

type Listing = { available: boolean; price: number }

/**
 * Produk yang dijual harus punya harga. Baris lama yang sudah dijual dengan harga 0 dan tidak berubah
 * dibiarkan lolos, supaya satu baris lama tidak menggagalkan simpan seluruh halaman.
 */
export function dijualTanpaHarga(baru: Listing, lama?: Listing | null): boolean {
  if (!baru.available || baru.price > 0) return false
  return !(lama && lama.available && lama.price === 0)
}
