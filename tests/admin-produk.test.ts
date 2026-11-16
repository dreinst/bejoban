import test from 'node:test'
import assert from 'node:assert/strict'
import { aksesSimpanProduk } from '../src/lib/admin/produk'
import { bisaTampilHarga, waktuWib } from '../src/lib/format'

test('owner boleh mengubah semua, termasuk produk baru', () => {
  assert.equal(aksesSimpanProduk('OWNER', 0), 'penuh')
  assert.equal(aksesSimpanProduk('OWNER', 7), 'penuh')
})

test('admin cabang hanya menyimpan harga dan stok produk yang sudah ada', () => {
  assert.equal(aksesSimpanProduk('BRANCH_ADMIN', 7), 'harga')
  assert.equal(aksesSimpanProduk('BRANCH_ADMIN', 0), 'tolak')
})

test('harga 0 tidak pernah tampil sebagai Rp 0 di situs', () => {
  assert.equal(bisaTampilHarga(true, 450000), true)
  assert.equal(bisaTampilHarga(true, 0), false)
  assert.equal(bisaTampilHarga(false, 450000), false)
  assert.equal(bisaTampilHarga(false, 0), false)
})

test('waktu admin memakai zona Jakarta dan satu format', () => {
  assert.equal(waktuWib('2026-11-16T10:23:00Z'), '16 Nov 2026, 17.23')
  assert.equal(waktuWib('2026-12-31T20:05:00Z'), '1 Jan 2027, 03.05')
})
