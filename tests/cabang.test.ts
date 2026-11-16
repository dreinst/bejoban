// Logika murni stok per cabang: kolom Cabang di pricelist, pencocokan nama cabang, filter /api/stok, banding cabang.
// Semua data karangan untuk tes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePricelist } from '../src/lib/tire/pricelist'
import { bandingCabang, cocokCabang, namaPendek, pisahPerCabang, saringStokBan } from '../src/lib/tire/cabang'

const branches = [
  { id: 1, slug: 'batu', name: 'Bejo Ban Batu (Contoh Masters)' },
  { id: 2, slug: 'karanglo', name: 'Bejo Ban Karanglo' },
]

test('nama pendek cabang tanpa "Bejo Ban" dan tanpa kurung', () => {
  assert.equal(namaPendek('Bejo Ban Batu (Contoh Masters)'), 'Batu')
  assert.equal(namaPendek('Bejo Ban Karanglo'), 'Karanglo')
})

test('nilai kolom Cabang dicocokkan ke slug atau nama, tidak ditebak', () => {
  assert.equal(cocokCabang('Batu', branches)?.id, 1)
  assert.equal(cocokCabang(' KARANGLO ', branches)?.id, 2)
  assert.equal(cocokCabang('Bejo Ban Batu', branches)?.id, 1)
  assert.equal(cocokCabang('bejo ban batu (contoh masters)', branches)?.id, 1)
  assert.equal(cocokCabang('Malang', branches), null)
  assert.equal(cocokCabang('Bat', branches), null)
  assert.equal(cocokCabang('', branches), null)
})

const CSV = [
  'Cabang,Ukuran Ban,Merk,Harga Jual,Stok,Keterangan',
  ',R15,,,,',
  'Batu,185/65-15,Merek Contoh A,600.000,4,',
  'Karanglo,185/65-15,Merek Contoh A,610.000,0,',
  'Malang,195/60-15,Merek Contoh B,500.000,2,',
  ',205/65-15,Merek Contoh C,700.000,1,',
].join('\n')

test('pricelist dengan kolom Cabang dipisah per cabang, nilai tak dikenal dilaporkan', () => {
  const r = parsePricelist(CSV)
  assert.equal(r.adaKolomCabang, true)
  assert.equal(r.rows.length, 4)
  const { bagian, masalah } = pisahPerCabang(r, branches)
  assert.deepEqual(bagian.map((b) => [b.cabang.slug, b.hasil.rows.length, b.hasil.rows[0].price]), [['batu', 1, 600000], ['karanglo', 1, 610000]])
  assert.deepEqual(masalah.map((x) => [x.line, x.reason]), [[5, 'cabang "Malang" tidak dikenal, baris dilewati'], [6, 'kolom Cabang kosong, baris dilewati']])
  assert.ok(masalah.every((x) => !x.imported))
})

test('pricelist tanpa kolom Cabang tetap seperti dulu', () => {
  const r = parsePricelist(',Ukuran Ban,Merk,Harga Jual,Stok,Keterangan\n,185/65-15,Merek Contoh A,600.000,4,')
  assert.equal(r.adaKolomCabang, false)
  assert.equal(r.rows.length, 1)
  assert.equal(r.asal?.[0].cabang, undefined)
})

test('dua kelompok kolom berdampingan dengan satu kolom Cabang: berlaku untuk keduanya', () => {
  const r = parsePricelist('Cabang,Ukuran Ban,Merk,Harga Jual,Stok,Keterangan,Ukuran Ban,Merk,Harga Jual,Stok,Keterangan\nBatu,185/65-15,Merek A,600.000,4,,195/60-15,Merek B,500.000,2,')
  assert.deepEqual(r.asal?.map((a) => a.cabang), ['Batu', 'Batu'])
})

test('/api/stok: cabang_id menyaring baris cabang itu saja, tanpa cabang_id semua ikut', () => {
  const rows = [{ cabangId: null }, { cabangId: 1 }, { cabangId: 2 }, { cabangId: 1 }]
  assert.equal(saringStokBan(rows, 1).length, 2)
  assert.ok(saringStokBan(rows, 1).every((r) => r.cabangId === 1))
  assert.equal(saringStokBan(rows, 3).length, 0)
  assert.deepEqual(saringStokBan(rows, null), rows)
})

test('banding cabang: satu baris per kode dengan isi tiap cabang', () => {
  const g = bandingCabang([
    { kode: 'a', cabangId: 1, stock: 4 },
    { kode: 'a', cabangId: 2, stock: 0 },
    { kode: 'b', cabangId: null, stock: 3 },
    { kode: null, cabangId: 1, stock: 1 },
  ])
  assert.deepEqual(g.map((x) => [x.kode, [...x.isi.keys()]]), [['a', [1, 2]], ['b', [null]]])
})
