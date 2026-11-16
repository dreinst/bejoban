// Ekspor CSV buku stok: pengaman sel dan rentang tanggal waktu Jakarta. Modul murni.

// Sel teks yang diawali karakter ini bisa dibaca sebagai rumus oleh Excel atau Sheets.
const AWAL_RUMUS = /^[=+\-@\t\r]/

// Angka ditulis apa adanya (supaya -3 tetap angka). Teks berawalan rumus diberi apostrof,
// lalu dikutip ganda kalau berisi koma, kutip, atau baris baru.
export function selCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  let s = v
  if (AWAL_RUMUS.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const barisCsv = (sel: (string | number | null | undefined)[]) => sel.map(selCsv).join(',')

const OFFSET_JAKARTA_MS = 7 * 60 * 60 * 1000 // WIB, tanpa jam musim panas
const HARI_MS = 24 * 60 * 60 * 1000
export const MAKS_HARI = 366

const tanggalSah = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const t = Date.parse(`${s}T00:00:00Z`)
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s ? null : t
}

// dari dan sampai inklusif, waktu Jakarta. Hasil berupa batas UTC [gte, lt).
export function rentangJakarta(dari: string, sampai: string): { ok: true; gte: Date; lt: Date; hari: number } | { ok: false; error: string } {
  const a = tanggalSah(dari)
  const b = tanggalSah(sampai)
  if (a === null || b === null) return { ok: false, error: 'Tanggal harus berformat YYYY-MM-DD' }
  if (a > b) return { ok: false, error: 'Tanggal awal lebih besar dari tanggal akhir' }
  const hari = (b - a) / HARI_MS + 1
  if (hari > MAKS_HARI) return { ok: false, error: `Rentang paling banyak ${MAKS_HARI} hari` }
  return { ok: true, gte: new Date(a - OFFSET_JAKARTA_MS), lt: new Date(b + HARI_MS - OFFSET_JAKARTA_MS), hari }
}

// 2026-11-16T11:30:00Z menjadi "2026-11-16 18:30:00" (WIB).
export const waktuJakarta = (d: Date) => new Date(d.getTime() + OFFSET_JAKARTA_MS).toISOString().slice(0, 19).replace('T', ' ')
