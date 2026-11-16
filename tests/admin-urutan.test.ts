import test from 'node:test'
import assert from 'node:assert/strict'
import { arahDari, aturanHapus, geserUrutan, urutanBerikut } from '../src/lib/admin/urutan'

const daftar = [
  { id: 10, sort: 1 },
  { id: 11, sort: 2 },
  { id: 12, sort: 3 },
]

test('naik menukar item dengan tetangga di atasnya', () => {
  assert.deepEqual(geserUrutan(daftar, 12, 'naik'), [
    { id: 12, sort: 2 },
    { id: 11, sort: 3 },
  ])
})

test('turun menukar item dengan tetangga di bawahnya', () => {
  assert.deepEqual(geserUrutan(daftar, 10, 'turun'), [
    { id: 11, sort: 1 },
    { id: 10, sort: 2 },
  ])
})

test('item di ujung atau yang tidak ada tidak mengubah apa pun', () => {
  assert.deepEqual(geserUrutan(daftar, 10, 'naik'), [])
  assert.deepEqual(geserUrutan(daftar, 12, 'turun'), [])
  assert.deepEqual(geserUrutan(daftar, 99, 'naik'), [])
})

test('nilai sort kembar dan loncat dirapikan jadi 1, 2, 3 saat digeser', () => {
  const kacau = [
    { id: 1, sort: 0 },
    { id: 2, sort: 0 },
    { id: 3, sort: 99 },
  ]
  assert.deepEqual(geserUrutan(kacau, 2, 'naik'), [
    { id: 2, sort: 1 },
    { id: 1, sort: 2 },
    { id: 3, sort: 3 },
  ])
})

test('arah hanya naik atau turun, item baru di akhir daftar', () => {
  assert.equal(arahDari('naik'), 'naik')
  assert.equal(arahDari('turun'), 'turun')
  assert.equal(arahDari('kiri'), null)
  assert.equal(urutanBerikut(daftar), 4)
  assert.equal(urutanBerikut([]), 1)
})

test('item yang tidak dipakai boleh dihapus', () => {
  assert.deepEqual(aturanHapus('Hankook', [{ jumlah: 0, satuan: 'produk' }]), { boleh: true, dipakai: '' })
  assert.deepEqual(aturanHapus('Hankook', []), { boleh: true, dipakai: '' })
})

test('item yang masih dipakai tidak boleh dihapus dan alasannya menyebut nama serta jumlahnya', () => {
  assert.deepEqual(aturanHapus('Hankook', [{ jumlah: 6, satuan: 'produk' }]), { boleh: false, dipakai: 'Hankook dipakai 6 produk.' })
  assert.equal(aturanHapus('Batu', [{ jumlah: 2, satuan: 'pengguna' }, { jumlah: 0, satuan: 'produk' }, { jumlah: 1200, satuan: 'baris stok' }]).dipakai, 'Batu dipakai 2 pengguna dan 1.200 baris stok.')
})
