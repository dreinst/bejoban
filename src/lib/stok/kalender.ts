// Aturan data tabel kalender. Modul murni.

export const JENIS_KALENDER = ['libur', 'promo', 'lainnya'] as const
export type JenisKalender = (typeof JENIS_KALENDER)[number]

export const LABEL_JENIS: Record<JenisKalender, string> = { libur: 'Libur', promo: 'Promo', lainnya: 'Lainnya' }

// YYYY-MM-DD yang benar-benar ada di kalender, tahun 2000 sampai 2100.
export function tanggalKalenderSah(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = Date.parse(`${s}T00:00:00Z`)
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return false
  const y = Number(s.slice(0, 4))
  return y >= 2000 && y <= 2100
}
