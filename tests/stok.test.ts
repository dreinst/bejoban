// Tes logika murni modul stok: saldo, kode stok ban, pengaman CSV, rentang tanggal, dan kalender.
import test from 'node:test'
import assert from 'node:assert/strict'
import { GalatStok, hitungSaldo, isTipeBukuStok } from '../src/lib/stok/logika'
import { bentukKode, kodeDasar, kodeKembar } from '../src/lib/stok/kode'
import { barisCsv, rentangJakarta, selCsv, waktuJakarta } from '../src/lib/stok/csv'
import { tanggalKalenderSah } from '../src/lib/stok/kalender'
import { mergeManual, type ManualRow, type ParsedTire } from '../src/lib/tire/pricelist'

test('saldo: delta dan setKe', () => {
  assert.deepEqual(hitungSaldo(5, { tipe: 'jual', delta: -2 }), { perubahan: -2, saldoAkhir: 3 })
  assert.deepEqual(hitungSaldo(5, { tipe: 'masuk', delta: 4 }), { perubahan: 4, saldoAkhir: 9 })
  assert.deepEqual(hitungSaldo(5, { tipe: 'impor', setKe: 1 }), { perubahan: -4, saldoAkhir: 1 })
  assert.deepEqual(hitungSaldo(5, { tipe: 'opname', setKe: 5 }), { perubahan: 0, saldoAkhir: 5 })
})

test('saldo: tolak negatif kecuali koreksi eksplisit', () => {
  assert.throws(() => hitungSaldo(2, { tipe: 'jual', delta: -3 }), GalatStok)
  assert.throws(() => hitungSaldo(2, { tipe: 'koreksi', setKe: -1 }), /Stok tidak cukup/)
  assert.deepEqual(hitungSaldo(2, { tipe: 'koreksi', delta: -3, izinkanNegatif: true }), { perubahan: -3, saldoAkhir: -1 })
  assert.throws(() => hitungSaldo(2, { tipe: 'jual', delta: -3, izinkanNegatif: true }), /hanya boleh untuk tipe koreksi/)
})

test('saldo: validasi tipe dan angka', () => {
  for (const t of ['jual', 'masuk', 'opname', 'transfer', 'void', 'impor', 'koreksi']) assert.ok(isTipeBukuStok(t))
  assert.equal(isTipeBukuStok('hilang'), false)
  assert.throws(() => hitungSaldo(1, { tipe: 'hilang', delta: 1 }), /Tipe buku stok tidak dikenal/)
  assert.throws(() => hitungSaldo(1, { tipe: 'jual' }), /salah satu/)
  assert.throws(() => hitungSaldo(1, { tipe: 'jual', delta: 1, setKe: 2 }), /salah satu/)
  assert.throws(() => hitungSaldo(1, { tipe: 'masuk', delta: 1.5 }), /bilangan bulat/)
  assert.throws(() => hitungSaldo(1, { tipe: 'masuk', delta: Number.NaN }), /bilangan bulat/)
})

test('kode stok ban: ukuran dan merek dinormalkan, baris kembar diberi sufiks berurutan', () => {
  assert.equal(kodeDasar({ sizeNorm: '185/65R15', brand: '  Merek  Contoh   A ' }), '185/65R15|merek contoh a')
  const rows = [
    { sizeNorm: '185/65R15', brand: 'Merek Contoh A' },
    { sizeNorm: '185/65R15', brand: 'merek contoh a' },
    { sizeNorm: '195/60R15', brand: 'Merek Contoh B' },
    { sizeNorm: '185/65R15', brand: 'MEREK CONTOH A' },
  ]
  const kode = bentukKode(rows)
  assert.deepEqual(kode, ['185/65R15|merek contoh a', '185/65R15|merek contoh a#2', '195/60R15|merek contoh b', '185/65R15|merek contoh a#3'])
  assert.deepEqual(bentukKode(rows), kode, 'deterministik')
  assert.deepEqual(kode.map(kodeKembar), [false, true, false, true])
})

test('kode stok ban: kode yang sudah terpakai dilewati', () => {
  const kode = bentukKode([{ sizeNorm: '185/65R15', brand: 'Merek Contoh A' }], ['185/65R15|merek contoh a', '185/65R15|merek contoh a#2'])
  assert.deepEqual(kode, ['185/65R15|merek contoh a#3'])
})

test('mergeManual memakai kode stabil untuk baris kembar', () => {
  const base: ParsedTire = { groupName: 'R15', ring: 15, sizeRaw: '185/65 R15', sizeNorm: '185/65R15', brand: 'Merek Contoh A', price: 500000, discount: 0, priceIssue: '', stock: 1, note: '' }
  const fresh = [base, { ...base, stock: 2 }]
  const manual: ManualRow[] = [{ ...base, price: 999000, stock: 7, lockManual: true, kode: '185/65R15|merek contoh a#2' }]
  const m = mergeManual(fresh, manual)
  assert.deepEqual(m.rows.map((r) => [r.kode, r.price, r.manual]), [
    ['185/65R15|merek contoh a', 500000, false],
    ['185/65R15|merek contoh a#2', 999000, true],
  ])
})

test('CSV: angka apa adanya, teks berawalan rumus dinetralkan, kutip ganda di-escape', () => {
  assert.equal(selCsv(-3), '-3')
  assert.equal(selCsv(null), '')
  assert.equal(selCsv(undefined), '')
  assert.equal(selCsv(Number.NaN), '')
  assert.equal(selCsv('=HYPERLINK("http://contoh.invalid")'), `"'=HYPERLINK(""http://contoh.invalid"")"`)
  assert.equal(selCsv('+62'), "'+62")
  assert.equal(selCsv('-1'), "'-1")
  assert.equal(selCsv('@SUM(A1)'), "'@SUM(A1)")
  assert.equal(selCsv('\tx'), "'\tx")
  assert.equal(selCsv('a,b'), '"a,b"')
  assert.equal(selCsv('baris\nbaru'), '"baris\nbaru"')
  assert.equal(selCsv('185/65R15|merek contoh a'), '185/65R15|merek contoh a')
  assert.equal(barisCsv([1, 'impor', null, '=1+1']), "1,impor,,'=1+1")
})

test('rentang tanggal Jakarta: batas UTC, validasi, dan maksimal 366 hari', () => {
  const r = rentangJakarta('2026-11-01', '2026-11-16')
  assert.ok(r.ok)
  if (r.ok) {
    assert.equal(r.gte.toISOString(), '2026-10-31T17:00:00.000Z')
    assert.equal(r.lt.toISOString(), '2026-11-16T17:00:00.000Z')
    assert.equal(r.hari, 16)
  }
  assert.equal(rentangJakarta('2026-02-30', '2026-03-01').ok, false)
  assert.equal(rentangJakarta('2026-11-16', '2026-11-01').ok, false)
  assert.equal(rentangJakarta('16-11-2026', '2026-11-20').ok, false)
  assert.equal(rentangJakarta('2025-01-01', '2026-01-01').ok, true, '366 hari masih boleh')
  assert.equal(rentangJakarta('2025-01-01', '2026-01-02').ok, false)
  assert.equal(waktuJakarta(new Date('2026-11-16T11:30:00Z')), '2026-11-16 18:30:00')
})

test('tanggal kalender harus tanggal yang benar-benar ada', () => {
  assert.ok(tanggalKalenderSah('2026-12-25'))
  assert.ok(tanggalKalenderSah('2028-02-29'))
  assert.equal(tanggalKalenderSah('2027-02-29'), false)
  assert.equal(tanggalKalenderSah('2026-13-01'), false)
  assert.equal(tanggalKalenderSah('1999-12-31'), false)
  assert.equal(tanggalKalenderSah('2026-1-5'), false)
})
