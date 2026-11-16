// Pembentuk kode stok ban. Modul murni, dipakai impor pricelist dan scripts/isi-kode-stok.ts.
// Kode = ukuran ternormalisasi + merek dinormalkan, mis. "185/65R15|hankook kinergy".
// Baris kembar (ukuran dan merek sama) diberi sufiks urutan kemunculan: "#2", "#3", dan seterusnya.

export const normMerek = (brand: string) => brand.toLowerCase().replace(/\s+/g, ' ').trim()

export const kodeDasar = (r: { sizeNorm: string; brand: string }) => `${r.sizeNorm.trim()}|${normMerek(r.brand)}`

// Kode untuk tiap baris sesuai urutan masuk. `terpakai` berisi kode yang sudah dimiliki baris lain
// dan tidak boleh dipakai lagi (diisi saat melengkapi kode yang masih kosong).
export function bentukKode(rows: { sizeNorm: string; brand: string }[], terpakai: Iterable<string> = []): string[] {
  const used = new Set(terpakai)
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const base = kodeDasar(r)
    let n = (seen.get(base) ?? 0) + 1
    let kode = n === 1 ? base : `${base}#${n}`
    while (used.has(kode)) kode = `${base}#${++n}`
    seen.set(base, n)
    used.add(kode)
    return kode
  })
}

// Kode yang punya sufiks urutan, untuk laporan baris kembar.
export const kodeKembar = (kode: string) => /#\d+$/.test(kode)
