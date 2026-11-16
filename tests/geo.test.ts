import test from 'node:test'
import assert from 'node:assert/strict'
import { matchCity } from '../src/lib/geo/match'
import { mapNominatim } from '../src/lib/geo/nominatim'
import { mapGoogle } from '../src/lib/geo/google'
import { distanceKm } from '../src/lib/geo/distance'
import type { Place } from '../src/lib/geo/types'

const place = (p: Partial<Place>): Place => ({ name: 'X', kecamatan: '', city: '', province: '', lat: 0, lon: 0, display: '', ...p })

test('kota hasil pencarian dicocokkan dengan tabel tarif tanpa awalan Kota atau Kabupaten', () => {
  const cities = ['Surabaya', 'Malang', 'Jakarta']
  assert.deepEqual(matchCity(place({ city: 'Kota Surabaya' }), cities).city, 'Surabaya')
  assert.equal(matchCity(place({ city: 'Kabupaten Malang' }), cities).city, 'Malang')
  assert.equal(matchCity(place({ city: 'surabaya' }), cities).via, 'kota')
})

test('kecamatan didahulukan, nama tempat jadi cadangan, tidak ada kecocokan hasilnya null', () => {
  const cities = ['Singosari', 'Surabaya']
  const m = matchCity(place({ kecamatan: 'Singosari', city: 'Kabupaten Malang' }), cities)
  assert.deepEqual([m.city, m.via], ['Singosari', 'kecamatan'])
  assert.equal(matchCity(place({ name: 'Surabaya', city: '' }), cities).via, 'nama')
  const none = matchCity(place({ city: 'Kabupaten Blitar', kecamatan: 'Wlingi' }), cities)
  assert.equal(none.city, null)
  assert.deepEqual(none.tried, ['Wlingi', 'Kabupaten Blitar', 'X'])
})

test('pemetaan hasil Nominatim', () => {
  const res = mapNominatim([
    { name: 'Wonokromo', display_name: 'Wonokromo, Kota Surabaya, Jawa Timur, Indonesia', lat: '-7.3050', lon: '112.7340', address: { suburb: 'Jagir', municipality: 'Wonokromo', city: 'Surabaya', state: 'Jawa Timur' } },
    { display_name: 'rusak', lat: 'x', lon: 'y' },
  ])
  assert.equal(res.length, 1)
  assert.deepEqual([res[0].kecamatan, res[0].city, res[0].province], ['Wonokromo', 'Surabaya', 'Jawa Timur'])
  assert.equal(res[0].lat, -7.305)
})

test('pemetaan hasil Google Maps', () => {
  const res = mapGoogle([{
    formatted_address: 'Singosari, Malang, Jawa Timur',
    geometry: { location: { lat: -7.9, lng: 112.6 } },
    address_components: [
      { long_name: 'Singosari', types: ['administrative_area_level_3'] },
      { long_name: 'Kabupaten Malang', types: ['administrative_area_level_2'] },
      { long_name: 'Jawa Timur', types: ['administrative_area_level_1'] },
    ],
  }])
  assert.deepEqual([res[0].kecamatan, res[0].city, res[0].province, res[0].lon], ['Singosari', 'Kabupaten Malang', 'Jawa Timur', 112.6])
})

test('jarak garis lurus', () => {
  const jakarta = { lat: -6.2088, lon: 106.8456 }
  const surabaya = { lat: -7.2575, lon: 112.7521 }
  const km = distanceKm(jakarta, surabaya)
  assert.ok(km > 650 && km < 700, String(km))
  assert.equal(Math.round(distanceKm(jakarta, jakarta)), 0)
})
