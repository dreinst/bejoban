import test from 'node:test'
import assert from 'node:assert/strict'
import { pilihanUnik } from '../src/lib/geo/pilihan'
import type { Place } from '../src/lib/geo/types'

const tempat = (display: string, o: Partial<Place> = {}): Place => ({ name: 'Jalan Raya Darmo', kecamatan: 'Wonokromo', city: 'Surabaya', province: 'Jawa Timur', lat: -7.28, lon: 112.73, display, precision: 'alamat', ...o })

test('pilihan berteks sama dibuang, indeks asli tetap dipakai untuk pick', () => {
  const hasil = pilihanUnik([
    tempat('Jalan Raya Darmo, Darmo, Wonokromo, Surabaya, Jawa Timur, 60264, Indonesia'),
    tempat('Jalan Raya Darmo, Darmo, Wonokromo, Surabaya, Jawa Timur, 60264, Indonesia', { lat: -7.29 }),
    tempat('Jalan Raya Darmo, Keputran, Tegalsari, Surabaya, Jawa Timur, 60265, Indonesia'),
  ])
  assert.deepEqual(hasil.map((h) => h.i), [0, 2])
  assert.equal(hasil[0].pembeda, 'Darmo, Wonokromo, Surabaya, Jawa Timur')
  assert.equal(hasil[1].pembeda, 'Keputran, Tegalsari, Surabaya, Jawa Timur')
})

test('tanpa alamat lengkap pembeda memakai kecamatan, kota, provinsi', () => {
  const [h] = pilihanUnik([tempat('')])
  assert.equal(h.pembeda, 'Kec. Wonokromo, Surabaya, Jawa Timur')
})
