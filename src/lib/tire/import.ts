import { db } from '../db'
import { mergeManual, type ManualRow, type ParseResult } from './pricelist'

export type ImportSource = 'berkas' | 'sheet'

// Terapkan hasil impor ke database. Baris yang diubah manual dan dikunci dipertahankan.
export async function applyImport(r: ParseResult, source: ImportSource) {
  const now = new Date()
  const old = await db.stockTire.findMany({ where: { manual: true } })
  const manual: ManualRow[] = old.map((o) => ({
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
  }))
  const merged = mergeManual(r.rows, manual)
  const all = [
    ...merged.rows.map((x) => ({ ...x, manualAt: x.manual ? now : null })),
    ...merged.orphans.map((x) => ({ ...x, manual: true, manualAt: now })),
  ]
  await db.$transaction([db.stockTire.deleteMany(), db.stockTire.createMany({ data: all.map((x) => ({ ...x, importedAt: now })) })])
  const summary = {
    at: now.toISOString(),
    source,
    total: all.length,
    withPrice: all.filter((x) => x.price !== null).length,
    noPrice: all.filter((x) => x.price === null).length,
    skipped: r.skipped,
    manualKept: merged.kept,
    manualOrphans: merged.orphans.length,
    manualOverwritten: merged.overwritten,
    problems: r.problems.slice(0, 300),
    problemCount: r.problems.length,
  }
  await db.setting.upsert({ where: { key: 'stok.lastImport' }, create: { key: 'stok.lastImport', value: JSON.stringify(summary) }, update: { value: JSON.stringify(summary) } })
  return summary
}
