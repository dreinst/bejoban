// Jejak aksi admin di tabel log_aktivitas. Satu baris per aksi, data berisi ringkasan kecil.
import { db } from '../db'

const MAKS_DATA = 2000

// Id pengguna disimpan sebagai teks, mengikuti kolom pengguna di ERD BejoStock.
export const penggunaDari = (s: { uid: number } | null | undefined) => (s ? String(s.uid) : null)

export function dataRingkas(data: Record<string, unknown> = {}) {
  const s = JSON.stringify(data)
  return s.length <= MAKS_DATA ? s : JSON.stringify({ terpotong: s.slice(0, MAKS_DATA - 50) })
}

// Gagal mencatat tidak boleh menggagalkan aksi yang sudah tersimpan, jadi galatnya hanya ditulis ke log server.
export async function catatAktivitas(p: { pengguna?: string | null; aksi: string; entitas: string; data?: Record<string, unknown> }) {
  try {
    await db.logAktivitas.create({ data: { pengguna: p.pengguna ?? null, aksi: p.aksi.slice(0, 60), entitas: p.entitas.slice(0, 60), data: dataRingkas(p.data) } })
  } catch (e) {
    console.error('catatAktivitas gagal', e)
  }
}
