import test from 'node:test'
import assert from 'node:assert/strict'
import { aksesSimpanProduk, dijualTanpaHarga } from '../src/lib/admin/produk'
import { waktuWib } from '../src/lib/format'

test('owner boleh mengubah semua, termasuk produk baru', () => {
  assert.equal(aksesSimpanProduk('OWNER', 0), 'penuh')
  assert.equal(aksesSimpanProduk('OWNER', 7), 'penuh')
})

test('admin cabang hanya menyimpan harga dan stok produk yang sudah ada', () => {
  assert.equal(aksesSimpanProduk('BRANCH_ADMIN', 7), 'harga')
  assert.equal(aksesSimpanProduk('BRANCH_ADMIN', 0), 'tolak')
})

test('dijual dengan harga 0 ditolak, kecuali baris lama yang tidak berubah', () => {
  assert.equal(dijualTanpaHarga({ available: true, price: 0 }), true)
  assert.equal(dijualTanpaHarga({ available: true, price: 0 }, { available: false, price: 0 }), true)
  assert.equal(dijualTanpaHarga({ available: true, price: 0 }, { available: true, price: 0 }), false)
  assert.equal(dijualTanpaHarga({ available: true, price: 500 }), false)
  assert.equal(dijualTanpaHarga({ available: false, price: 0 }), false)
})

test('waktu admin memakai zona Jakarta dan satu format', () => {
  assert.equal(waktuWib('2026-11-16T10:23:00Z'), '16 Nov 2026, 17.23')
  assert.equal(waktuWib('2026-12-31T20:05:00Z'), '1 Jan 2027, 03.05')
})
