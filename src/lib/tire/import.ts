import { db } from '../db'
import { isiKodeKosong, ubahStokTx } from '../stok/ubah'
import { mergeManual, type ManualRow, type ParseResult } from './pricelist'

export type ImportSource = 'berkas' | 'sheet'

// Terapkan hasil impor ke database dengan upsert per kode, jadi id baris tetap antar impor.
// Baris yang hilang dari sumber dinonaktifkan (tidak dihapus) dan aktif lagi kalau muncul kembali.
// Baris manual yang dikunci tidak ditimpa. Tiap perubahan stok dicatat di buku_stok bertipe impor.
export async function applyImport(r: ParseResult, source: ImportSource, pengguna: string | null = null) {
  const now = new Date()
  const refId = `impor:${source}:${now.toISOString()}`
  const hasil = await db.$transaction(
    async (tx) => {
      const isi = await isiKodeKosong(tx)
      const lama = await tx.stockTire.findMany()
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
          id = (await tx.stockTire.create({ data: { ...nilai, kode, stock: 0, importedAt: now } })).id
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
      await tx.stockTire.updateMany({ where: { kode: { in: [...kodeSumber] } }, data: { importedAt: now } })
      // Hilang dari sumber: nonaktifkan, kecuali baris manual terkunci (tetap dipakai seperti sebelumnya).
      const hilang = lama.filter((o) => !kodeSumber.has(o.kode!) && o.aktif && !(o.manual && o.lockManual)).map((o) => o.id)
      if (hilang.length) await tx.stockTire.updateMany({ where: { id: { in: hilang } }, data: { aktif: false } })
      n.deactivated = hilang.length

      const aktif = await tx.stockTire.findMany({ where: { aktif: true }, select: { price: true } })
      return { ...n, isi, merged, aktif }
    },
    { timeout: 60_000, maxWait: 10_000 },
  )
  const summary = {
    at: now.toISOString(),
    source,
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
  await db.setting.upsert({ where: { key: 'stok.lastImport' }, create: { key: 'stok.lastImport', value: JSON.stringify(summary) }, update: { value: JSON.stringify(summary) } })
  return summary
}
