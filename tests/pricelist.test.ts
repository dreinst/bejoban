import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCsv, parsePrice, parsePricelist } from '../src/lib/tire/pricelist'

const sample = readFileSync(new URL('./fixtures/pricelist-contoh.csv', import.meta.url), 'utf8')

test('format harga', () => {
  assert.equal(parsePrice('680.000').value, 680000)
  assert.equal(parsePrice('1,500,000').value, 1500000)
  assert.equal(parsePrice('Rp 1.200.000').value, 1200000)
  assert.equal(parsePrice('850000').value, 850000)
  assert.equal(parsePrice('1.825.0000').value, null)
  assert.equal(parsePrice('1.825.0000').reason, 'format harga janggal')
  assert.equal(parsePrice('').reason, 'harga kosong')
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
