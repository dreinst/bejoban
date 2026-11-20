import { db } from '../db'
import { isiKodeKosong, kunciSusunanStok, modeCabangTx, ubahStokTx } from '../stok/ubah'
import { GalatStok } from '../stok/logika'

export const PESAN_IMPOR_KASIR = 'Cabang ini memakai mode kasir, jadi stoknya tidak bisa diganti dari pricelist atau Google Sheets. Stok berubah lewat transaksi kasir dan koreksi owner.'
import { mergeManual, type ManualRow, type ParseResult } from './pricelist'

export type ImportSource = 'berkas' | 'sheet'

// Terapkan hasil impor ke database dengan upsert per kode, jadi id baris tetap antar impor.
// Baris yang hilang dari sumber dinonaktifkan (tidak dihapus) dan aktif lagi kalau muncul kembali.
// Baris manual yang dikunci tidak ditimpa. Tiap perubahan stok dicatat di buku_stok bertipe impor.
//
// Impor bekerja per cabang: cabangId berisi id cabang, atau null untuk baris tanpa cabang (perilaku lama).
// Semua langkah (cocokkan kode, gabung baris manual, nonaktifkan yang hilang) hanya melihat baris cabang itu,
// jadi impor ke satu cabang tidak menyentuh cabang lain maupun baris tanpa cabang.
// simpan = false: ringkasan tidak ditulis ke stok.lastImport (dipakai impor sheet gabungan yang menulis sendiri).
export async function applyImport(r: ParseResult, source: ImportSource, pengguna: string | null = null, cabangId: number | null = null, simpan = true) {
  const now = new Date()
  const refId = `impor:${source}:${cabangId ?? 'tanpa'}:${now.toISOString()}`
  const hasil = await db.$transaction(
    async (tx) => {
      // Impor lain (atau tetapkan cabang) yang sedang berjalan ditunggu dulu sampai selesai.
      await kunciSusunanStok(tx)
      // Pengaktifan kasir juga mengambil kunci di atas, jadi mode yang dibaca di sini tidak berubah sampai impor selesai.
      if ((await modeCabangTx(tx, cabangId)) === 'kasir') throw new GalatStok(PESAN_IMPOR_KASIR)
      const isi = await isiKodeKosong(tx)
      const lama = await tx.stockTire.findMany({ where: { cabangId }, orderBy: { id: 'asc' } })
      const byKode = new Map(lama.map((o) => [o.kode!, o]))
      const manual: ManualRow[] = lama
        .filter((o) => o.manual)
        .map((o) => ({
          groupName: o.groupName,
          ring: o.ring,
          sizeRaw: o.sizeRaw,
          sizeNorm: o.sizeNorm,
          brand: o.brand,
          price: o.price,
          discount: o.discount,
          priceIssue: o.priceIssue,
          stock: o.stock,
          note: o.note,
          lockManual: o.lockManual,
          kode: o.kode,
        }))
      const merged = mergeManual(r.rows, manual)
      const n = { created: 0, updated: 0, reactivated: 0, deactivated: 0, stockChanges: 0 }

      for (const x of merged.rows) {
        const { stock, manual: dikunci, lockManual: _l, kode, ...nilai } = x
        void _l
        const o = byKode.get(kode)
        let id: number
        if (!o) {
          id = (await tx.stockTire.create({ data: { ...nilai, kode, cabangId, stock: 0, importedAt: now } })).id
          n.created++
        } else {
          id = o.id
          // Baris manual terkunci: nilainya dipertahankan, hanya diaktifkan lagi kalau perlu.
          const data: Record<string, unknown> = dikunci ? {} : { ...nilai, manual: false, lockManual: true, manualAt: null }
          const beda = Object.entries(data).some(([k, v]) => (o as Record<string, unknown>)[k] !== v)
          if (!o.aktif) n.reactivated++
          if (beda || !o.aktif) {
            await tx.stockTire.update({ where: { id }, data: { ...data, aktif: true } })
            n.updated++
          }
        }
        if (!o || o.stock !== stock) {
          const h = await ubahStokTx(tx, { target: { jenis: 'stok_ban', id }, setKe: stock, tipe: 'impor', refId, pengguna })
          if (h.dicatat) n.stockChanges++
        }
      }

      const kodeSumber = new Set(merged.rows.map((x) => x.kode))
      await tx.stockTire.updateMany({ where: { cabangId, kode: { in: [...kodeSumber] } }, data: { importedAt: now } })
      // Hilang dari sumber: nonaktifkan, kecuali baris manual terkunci (tetap dipakai seperti sebelumnya).
      const hilang = lama.filter((o) => !kodeSumber.has(o.kode!) && o.aktif && !(o.manual && o.lockManual)).map((o) => o.id)
      if (hilang.length) await tx.stockTire.updateMany({ where: { id: { in: hilang } }, data: { aktif: false } })
      n.deactivated = hilang.length

      const aktif = await tx.stockTire.findMany({ where: { aktif: true, cabangId }, select: { price: true } })
      return { ...n, isi, merged, aktif }
    },
    { timeout: 60_000, maxWait: 10_000 },
  )
  const summary = {
    at: now.toISOString(),
    source,
    cabangId,
    total: hasil.aktif.length,
    withPrice: hasil.aktif.filter((x) => x.price !== null).length,
    noPrice: hasil.aktif.filter((x) => x.price === null).length,
    skipped: r.skipped,
    manualKept: hasil.merged.kept,
    manualOrphans: hasil.merged.orphans.length,
    manualOverwritten: hasil.merged.overwritten,
    created: hasil.created,
    updated: hasil.updated,
    deactivated: hasil.deactivated,
    reactivated: hasil.reactivated,
    stockChanges: hasil.stockChanges,
    codesFilled: hasil.isi.diisi,
    problems: r.problems.slice(0, 300),
    problemCount: r.problems.length,
  }
  if (simpan) await simpanRingkasan(summary)
  return summary
}

export type RingkasanImpor = Awaited<ReturnType<typeof applyImport>>

export const simpanRingkasan = (summary: unknown) =>
  db.setting.upsert({ where: { key: 'stok.lastImport' }, create: { key: 'stok.lastImport', value: JSON.stringify(summary) }, update: { value: JSON.stringify(summary) } })

// Gabungkan ringkasan beberapa impor cabang (sheet dengan kolom Cabang) jadi satu ringkasan untuk halaman stok.
// Angka dijumlahkan, rincian tiap cabang disimpan di `bagian`, dan masalah tambahan (cabang tak dikenal) ikut didaftar.
export function gabungRingkasan(list: RingkasanImpor[], source: ImportSource, r: ParseResult) {
  const jumlah = (k: 'total' | 'withPrice' | 'noPrice' | 'manualKept' | 'manualOrphans' | 'manualOverwritten' | 'created' | 'updated' | 'deactivated' | 'reactivated' | 'stockChanges' | 'codesFilled') =>
    list.reduce((n, x) => n + x[k], 0)
  return {
    at: list[0]?.at ?? new Date().toISOString(),
    source,
    cabangId: null,
    gabungan: true,
    bagian: list.map((x) => ({ cabangId: x.cabangId, total: x.total, created: x.created, deactivated: x.deactivated, reactivated: x.reactivated, stockChanges: x.stockChanges })),
    total: jumlah('total'),
    withPrice: jumlah('withPrice'),
    noPrice: jumlah('noPrice'),
    skipped: r.skipped,
    manualKept: jumlah('manualKept'),
    manualOrphans: jumlah('manualOrphans'),
    manualOverwritten: jumlah('manualOverwritten'),
    created: jumlah('created'),
    updated: jumlah('updated'),
    deactivated: jumlah('deactivated'),
    reactivated: jumlah('reactivated'),
    stockChanges: jumlah('stockChanges'),
    codesFilled: jumlah('codesFilled'),
    problems: r.problems.slice(0, 300),
    problemCount: r.problems.length,
  }
}
