import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mergeManual, parseCsv, parseDiscount, parsePrice, parsePricelist, type ManualRow } from '../src/lib/tire/pricelist'

const sample = readFileSync(new URL('./fixtures/pricelist-contoh.csv', import.meta.url), 'utf8')

test('format harga', () => {
  assert.equal(parsePrice('680.000').value, 680000)
  assert.equal(parsePrice('1,500,000').value, 1500000)
  assert.equal(parsePrice('Rp 1.200.000').value, 1200000)
  assert.equal(parsePrice('850000').value, 850000)
  assert.equal(parsePrice('1.825.0000').value, null)
  assert.equal(parsePrice('1.825.0000').reason, 'format harga janggal')
  assert.match(parsePrice('').reason ?? '', /^harga kosong/)
})

test('parseCsv menangani kutip dan CRLF', () => {
  assert.deepEqual(parseCsv('a,"1,500",c\r\nd,e,f'), [['a', '1,500', 'c'], ['d', 'e', 'f']])
})

test('pricelist contoh: kelompok, baris masuk, dan baris bermasalah', () => {
  const r = parsePricelist(sample)
  assert.equal(r.rows.length, 7)
  assert.equal(r.skipped, 1)
  const a = r.rows.find((x) => x.sizeRaw === '165-13')!
  assert.equal(a.ring, 13)
  assert.equal(a.groupName, 'R13 (Muatan + MT)')
  assert.equal(a.price, 700000)
  assert.equal(r.rows.find((x) => x.sizeRaw === '175/80-13')?.sizeNorm, '175/80R13')
  assert.equal(r.rows.find((x) => x.brand === 'Merek Contoh C')?.ring, 15)
  const typo = r.problems.find((p) => p.priceRaw === '1.825.0000')!
  assert.equal(typo.imported, true)
  assert.equal(r.rows.find((x) => x.brand === 'Merek Contoh D' && x.ring === 15)?.price, null)
  assert.ok(r.problems.some((p) => p.reason.includes('harga kosong') && p.size === '26x7.5-13'))
  assert.ok(r.problems.some((p) => p.reason.includes('stok bukan angka')))
  assert.ok(r.problems.some((p) => !p.imported && p.size === '750-16'))
})

test('berkas tanpa kolom Ukuran Ban tidak menghasilkan baris', () => {
  assert.equal(parsePricelist('a,b,c\n1,2,3').rows.length, 0)
})

test('keterangan disc dibaca sebagai potongan, harga asli tetap disimpan', () => {
  assert.equal(parseDiscount('disc 50.000'), 50000)
  assert.equal(parseDiscount('Disc. Rp 25.000 sampai akhir bulan'), 25000)
  assert.equal(parseDiscount('dot 25'), 0)
  assert.equal(parseDiscount(''), 0)
  const csv = ',Ukuran Ban,Merk,Harga Jual,Stok,Keterangan\n,R15,,,,\n,185/65-15,Merek Contoh F,570.000,100,disc 50.000\n,185/65-15,Merek Contoh G,500.000,1,disc 900.000'
  const r = parsePricelist(csv)
  const f = r.rows.find((x) => x.brand === 'Merek Contoh F')!
  assert.deepEqual([f.price, f.discount], [570000, 50000])
  const g = r.rows.find((x) => x.brand === 'Merek Contoh G')!
  assert.equal(g.discount, 0)
  assert.ok(r.problems.some((p) => p.brand === 'Merek Contoh G' && p.reason.includes('potongan')))
})

test('harga kosong dan janggal ditandai berbeda dan tidak ditebak', () => {
  const r = parsePricelist(sample)
  const kosong = r.rows.find((x) => x.sizeRaw === '26x7.5-13')!
  assert.deepEqual([kosong.price, kosong.priceIssue], [null, 'kosong'])
  const janggal = r.rows.find((x) => x.brand === 'Merek Contoh D' && x.ring === 15)!
  assert.deepEqual([janggal.price, janggal.priceIssue], [null, 'format janggal: 1.825.0000'])
  assert.equal(r.rows.find((x) => x.brand === 'Merek Contoh C')!.priceIssue, '')
})

test('sinkron berikutnya: baris manual terkunci dipertahankan, yang tidak dikunci ditimpa', () => {
  const fresh = parsePricelist(sample).rows
  const base = fresh.find((x) => x.brand === 'Merek Contoh D' && x.ring === 15)!
  const manual: ManualRow[] = [
    { ...base, price: 1234000, priceIssue: '', lockManual: true },
    { ...fresh.find((x) => x.brand === 'Merek Contoh C')!, price: 1, lockManual: false },
    { ...base, brand: 'Merek Hilang', sizeNorm: '999/99R99', price: 5, lockManual: true },
  ]
  const m = mergeManual(fresh, manual)
  assert.equal(m.rows.length, fresh.length)
  const kept = m.rows.find((x) => x.brand === 'Merek Contoh D' && x.ring === 15)!
  assert.deepEqual([kept.price, kept.manual], [1234000, true])
  assert.equal(m.rows.find((x) => x.brand === 'Merek Contoh C')!.price, 650000, 'tidak dikunci: ditimpa data baru')
  assert.deepEqual([m.kept, m.overwritten, m.orphans.length], [1, 1, 1])
})
