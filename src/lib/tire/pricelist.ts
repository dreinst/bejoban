// Pengurai CSV pricelist ban. Modul murni.
// Format: beberapa kelompok kolom berdampingan (Ukuran Ban, Merk, Harga Jual, Stok, Keterangan),
// dengan baris judul kelompok ring seperti "R15" atau "R14 (Muatan + MT)".
import { normalizeSize } from './size'
import { bentukKode, kodeDasar } from '../stok/kode'

export type ParsedTire = {
  groupName: string
  ring: number
  sizeRaw: string
  sizeNorm: string
  brand: string
  price: number | null // harga asli dari pricelist
  discount: number // potongan dari keterangan "disc <angka>", 0 kalau tidak ada
  priceIssue: string // alasan harga kosong atau janggal, kosong kalau normal
  stock: number
  note: string
}

export type PriceProblem = {
  line: number // nomor baris di berkas (mulai 1)
  group: string
  size: string
  brand: string
  priceRaw: string
  stockRaw: string
  reason: string
  imported: boolean // true kalau barisnya tetap masuk (dengan harga kosong)
}

export type ParseResult = { rows: ParsedTire[]; problems: PriceProblem[]; skipped: number }

// Parser CSV sederhana: kutip ganda, koma di dalam kutip, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// Hasil: angka, atau alasan kenapa tidak terbaca. Format janggal tidak ditebak.
export function parsePrice(raw: string): { value: number | null; reason?: string } {
  const s = raw.replace(/^rp\.?\s*/i, '').replace(/\s+/g, '')
  if (!s) return { value: null, reason: 'harga kosong (barang belum pernah dibeli toko)' }
  if (/^\d+$/.test(s) || /^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(,\d{3})+$/.test(s)) {
    return { value: Number(s.replace(/[.,]/g, '')) }
  }
  return { value: null, reason: 'format harga janggal' }
}

// Keterangan "disc 50.000" berarti harga masih dipotong lagi sebesar angka itu.
export function parseDiscount(note: string): number {
  const m = /\bdisc(?:ount)?\.?\s*(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)/i.exec(note)
  return m ? Number(m[1].replace(/[.,]/g, '')) : 0
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const RE_GROUP = /^R\s?(\d{2})\b/i

export function parsePricelist(csv: string): ParseResult {
  const table = parseCsv(csv)
  // Awal tiap kelompok kolom = kolom yang berisi "Ukuran Ban".
  const starts: number[] = []
  for (const r of table) {
    r.forEach((c, i) => {
      if (clean(c).toLowerCase() === 'ukuran ban' && !starts.includes(i)) starts.push(i)
    })
    if (starts.length) break
  }
  const rows: ParsedTire[] = []
  const problems: PriceProblem[] = []
  let skipped = 0
  const group = new Map<number, { name: string; ring: number }>()

  table.forEach((r, idx) => {
    const line = idx + 1
    for (const c0 of starts) {
      const size = clean(r[c0])
      const brand = clean(r[c0 + 1])
      const priceRaw = clean(r[c0 + 2])
      const stockRaw = clean(r[c0 + 3])
      const note = clean(r[c0 + 4])
      if (!size && !brand && !priceRaw && !stockRaw) continue
      if (size.toLowerCase() === 'ukuran ban') continue
      const g = RE_GROUP.exec(size)
      if (g && !brand && !priceRaw && !stockRaw) {
        group.set(c0, { name: size, ring: Number(g[1]) })
        continue
      }
      const cur = group.get(c0) ?? { name: '', ring: 0 }
      const base = { line, group: cur.name, size, brand, priceRaw, stockRaw }
      if (!size || !brand) {
        skipped++
        problems.push({ ...base, reason: !brand ? 'merek kosong, baris dilewati' : 'ukuran kosong, baris dilewati', imported: false })
        continue
      }
      const parsed = normalizeSize(size)
      const reasons: string[] = []
      if (!parsed) reasons.push('ukuran tidak dikenali')
      const p = parsePrice(priceRaw)
      if (p.reason) reasons.push(p.reason)
      let stock = 0
      if (/^\d+$/.test(stockRaw)) stock = Number(stockRaw)
      else reasons.push(stockRaw ? 'stok bukan angka, dianggap 0' : 'stok kosong, dianggap 0')
      let discount = parseDiscount(note)
      if (discount && p.value !== null && discount >= p.value) {
        reasons.push('potongan disc lebih besar dari harga, potongan diabaikan')
        discount = 0
      }
      rows.push({
        groupName: cur.name,
        ring: cur.ring || parsed?.ring || 0,
        sizeRaw: size,
        sizeNorm: parsed?.norm ?? size.toLowerCase().replace(/\s+/g, ''),
        brand,
        price: p.value,
        discount,
        priceIssue: p.reason ? (p.reason.startsWith('harga kosong') ? 'kosong' : `format janggal: ${priceRaw}`) : '',
        stock,
        note,
      })
      if (reasons.length) problems.push({ ...base, reason: reasons.join('; '), imported: true })
    }
  })
  return { rows, problems, skipped }
}

// ---- Baris yang diubah manual dan sinkron berikutnya ----

export type ManualRow = ParsedTire & { lockManual: boolean; kode?: string | null }

// Gabungkan baris hasil impor baru dengan baris manual yang dikunci.
// Baris dikenali lewat kode stabil (src/lib/stok/kode.ts): ukuran|merek, dengan sufiks #2, #3 untuk baris kembar.
// Baris manual yang dikunci dan ada di data baru: nilai manual dipertahankan.
// Baris manual yang dikunci tapi tidak ada di data baru: tetap disimpan (orphan).
// Baris manual yang tidak dikunci: ditimpa data baru.
export function mergeManual(fresh: ParsedTire[], manual: ManualRow[]) {
  const kode = bentukKode(fresh)
  const idx = new Map(kode.map((k, i) => [k, i]))
  const used = new Set<number>()
  let kept = 0
  const rows = fresh.map((r, i) => ({ ...r, kode: kode[i], manual: false, lockManual: true }))
  const orphans: ManualRow[] = []
  for (const m of manual.filter((x) => x.lockManual)) {
    const k = m.kode || kodeDasar(m)
    const i = idx.get(k)
    if (i === undefined || used.has(i)) {
      orphans.push(m)
      continue
    }
    used.add(i)
    rows[i] = { ...m, kode: k, manual: true, lockManual: true }
    kept++
  }
  const overwritten = manual.filter((x) => !x.lockManual).length
  return { rows, orphans, kept, overwritten }
}
