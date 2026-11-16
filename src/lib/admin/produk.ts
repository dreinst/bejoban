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
