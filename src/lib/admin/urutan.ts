// Logika murni untuk daftar admin: urutan naik turun dan aturan hapus. Tanpa database, supaya bisa dites.

export type Arah = 'naik' | 'turun'
export type BerUrutan = { id: number; sort: number }

export const arahDari = (v: unknown): Arah | null => (v === 'naik' || v === 'turun' ? v : null)

/**
 * Pindahkan satu item satu langkah ke atas atau ke bawah.
 * `items` harus sudah dalam urutan tampil. Hasilnya nilai `sort` baru (1, 2, 3, ...) hanya untuk item yang berubah,
 * jadi nilai kembar atau loncat dari data lama ikut dirapikan. Kosong kalau item tidak ada atau sudah di ujung.
 */
export function geserUrutan<T extends BerUrutan>(items: T[], id: number, arah: Arah): BerUrutan[] {
  const i = items.findIndex((x) => x.id === id)
  const j = arah === 'naik' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= items.length) return []
  const baru = [...items]
  ;[baru[i], baru[j]] = [baru[j], baru[i]]
  return baru.flatMap((x, k) => (x.sort === k + 1 ? [] : [{ id: x.id, sort: k + 1 }]))
}

/** Nilai sort untuk item baru: di akhir daftar. */
export const urutanBerikut = (items: { sort: number }[]) => items.reduce((m, x) => Math.max(m, x.sort), 0) + 1

export type Pemakaian = { jumlah: number; satuan: string }

/**
 * Aturan hapus: item yang masih dipakai tidak boleh dihapus, tawarkan nonaktifkan.
 * Mengembalikan kalimat akibat yang disebut di dialog konfirmasi, mis. "Hankook dipakai 6 produk."
 */
export function aturanHapus(nama: string, pemakaian: Pemakaian[]): { boleh: boolean; dipakai: string } {
  const ada = pemakaian.filter((p) => p.jumlah > 0)
  if (!ada.length) return { boleh: true, dipakai: '' }
  const rinci = ada.map((p) => `${p.jumlah.toLocaleString('id-ID')} ${p.satuan}`)
  const gabung = rinci.length > 1 ? `${rinci.slice(0, -1).join(', ')} dan ${rinci.at(-1)}` : rinci[0]
  return { boleh: false, dipakai: `${nama} dipakai ${gabung}.` }
}
