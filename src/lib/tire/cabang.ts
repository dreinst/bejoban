// Stok ban per cabang: pencocokan nama cabang dan pemisahan hasil impor menurut kolom Cabang. Modul murni.
import type { ParseResult, PriceProblem } from './pricelist'

export type CabangRef = { id: number; slug: string; name: string }

// "Bejo Ban Batu (Hankook Masters)" menjadi "Batu". Dipakai untuk label WhatsApp dan tampilan singkat.
export const namaPendek = (name: string) =>
  name
    .replace(/\s*\(.*\)\s*/, '')
    .replace(/^bejo\s*ban\s*/i, '')
    .trim()

const rapikan = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// Nilai kolom Cabang dicocokkan ke slug, nama lengkap, nama tanpa kurung, atau nama pendek (tanpa "Bejo Ban").
// Tidak ditebak: nilai yang tidak sama persis dengan salah satunya dianggap tidak dikenal.
export function cocokCabang<T extends CabangRef>(nilai: string, branches: T[]): T | null {
  const v = rapikan(nilai)
  if (!v) return null
  const hasil = branches.filter((b) => [b.slug, b.name, b.name.replace(/\s*\(.*\)\s*/, ''), namaPendek(b.name)].some((x) => rapikan(x) === v))
  return hasil.length === 1 ? hasil[0] : null
}

// Pisahkan hasil impor sheet gabungan menjadi satu ParseResult per cabang.
// Baris dengan Cabang kosong atau tidak dikenal tidak masuk, dan dilaporkan sebagai bermasalah.
// Masalah hasil pengurai (harga janggal dan lain-lain) tidak dipecah per cabang, pemanggil melaporkannya sekali.
export function pisahPerCabang<T extends CabangRef>(r: ParseResult, branches: T[]) {
  const per = new Map<number, { cabang: T; hasil: ParseResult }>()
  const masalah: PriceProblem[] = []
  r.rows.forEach((row, i) => {
    const a = r.asal?.[i]
    const nilai = a?.cabang ?? ''
    const b = cocokCabang(nilai, branches)
    if (!b) {
      masalah.push({
        line: a?.line ?? 0,
        group: row.groupName,
        size: row.sizeRaw,
        brand: row.brand,
        priceRaw: row.price === null ? '' : String(row.price),
        stockRaw: String(row.stock),
        reason: nilai ? `cabang "${nilai}" tidak dikenal, baris dilewati` : 'kolom Cabang kosong, baris dilewati',
        imported: false,
      })
      return
    }
    if (!per.has(b.id)) per.set(b.id, { cabang: b, hasil: { rows: [], problems: [], skipped: 0 } })
    per.get(b.id)!.hasil.rows.push(row)
  })
  return { bagian: [...per.values()], masalah }
}

// ---- Endpoint /api/stok ----

export type BarisStokBan = { kode: string | null; cabangId: number | null; stock: number; importedAt: Date; manualAt: Date | null }

// cabangId diberikan: hanya baris cabang itu (baris tanpa cabang tidak ikut).
// cabangId null (owner tanpa filter): semua baris, baris tanpa cabang muncul dengan cabang_id null.
export const saringStokBan = <T extends Pick<BarisStokBan, 'cabangId'>>(rows: T[], cabangId: number | null) =>
  cabangId === null ? rows : rows.filter((r) => r.cabangId === cabangId)

// Banding cabang: satu baris per kode (ukuran dan merek) dengan isi tiap cabang berdampingan.
export function bandingCabang<T extends { kode: string | null; cabangId: number | null }>(rows: T[]) {
  const per = new Map<string, { kode: string; contoh: T; isi: Map<number | null, T> }>()
  for (const r of rows) {
    if (!r.kode) continue
    const g = per.get(r.kode) ?? { kode: r.kode, contoh: r, isi: new Map() }
    if (!g.isi.has(r.cabangId)) g.isi.set(r.cabangId, r)
    per.set(r.kode, g)
  }
  return [...per.values()]
}
