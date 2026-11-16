import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLevels, parseAddress, precisionOf } from '../src/lib/geo/address'
import { mapPhoton } from '../src/lib/geo/photon'
import { mapNominatim } from '../src/lib/geo/nominatim'
import { walkLevels, cacheUsable, TTL_EMPTY_MS, type Attempt } from '../src/lib/geo/search'
import { matchCity } from '../src/lib/geo/match'
import type { Place } from '../src/lib/geo/types'

const WAGIR = 'Jl. Raya Pandanlandung No.16, Krajan, Bandulan, Kec. Wagir, Kabupaten Malang, Jawa Timur 65146'
const JAKARTA = 'Jl. Jend. Sudirman No. 12, Kel. Pasar Baru, Kec. Sawah Besar, Kota Jakarta Pusat, DKI Jakarta 10710'
const MAKASSAR = 'Jl. Urip Sumoharjo No. 20, Karampuang, Kec. Panakkukang, Kota Makassar, Sulawesi Selatan 90231'
const PONTIANAK = 'Jalan Gajah Mada No 5, Benua Melayu Darat, Kecamatan Pontianak Selatan, Kota Pontianak, Kalimantan Barat 78121'
const BATU = 'Jalan Brantas No 35, Batu 65311'

test('alamat gaya Google Maps dipecah dengan penanda Indonesia', () => {
  const p = parseAddress(WAGIR)
  assert.deepEqual([p.jalan, p.nomor, p.kecamatan, p.kota, p.provinsi, p.kodepos], ['Jalan Raya Pandanlandung', '16', 'Wagir', 'Kabupaten Malang', 'Jawa Timur', '65146'])
  assert.deepEqual(p.kelurahan, ['Krajan', 'Bandulan'])
  const j = parseAddress(JAKARTA)
  assert.deepEqual([j.jalan, j.kecamatan, j.kota, j.provinsi], ['Jalan Jend. Sudirman', 'Sawah Besar', 'Kota Jakarta Pusat', 'DKI Jakarta'])
  assert.deepEqual(j.kelurahan, ['Pasar Baru'])
})

test('penanda Kab., Kota, Kel., Desa, dan Kecamatan dikenali', () => {
  const p = parseAddress('Gg. Mawar No. 3, Desa Sukamaju, Kecamatan Cikarang, Kab. Bekasi, Jawa Barat')
  assert.deepEqual([p.jalan, p.kelurahan[0], p.kecamatan, p.kota, p.provinsi], ['Gang Mawar', 'Sukamaju', 'Cikarang', 'Kabupaten Bekasi', 'Jawa Barat'])
  assert.equal(parseAddress('Kota Batu, Jawa Timur').kota, 'Kota Batu')
})

test('kueri bertingkat dari paling lengkap ke paling pendek, tanpa duplikat', () => {
  const l = buildLevels(WAGIR)
  assert.deepEqual(l.map((x) => x.key), ['utuh', 'bersih', 'jalan', 'kecamatan', 'kota'])
  assert.equal(l[0].q, WAGIR)
  assert.equal(l[1].q, 'Jalan Raya Pandanlandung, Krajan, Bandulan, Kecamatan Wagir, Kabupaten Malang, Jawa Timur')
  assert.equal(l[2].q, 'Jalan Raya Pandanlandung, Wagir, Kabupaten Malang')
  assert.equal(l[3].q, 'Wagir, Kabupaten Malang, Jawa Timur')
  assert.equal(l[4].q, 'Kabupaten Malang, Jawa Timur')
  assert.deepEqual(l.map((x) => x.precision), ['alamat', 'alamat', 'alamat', 'kecamatan', 'kota'])
  // Teks pendek tanpa penanda: hanya satu tingkat.
  assert.equal(buildLevels('Surabaya').length, 1)
})

test('alamat di luar Jawa menghasilkan tingkat yang sama', () => {
  for (const a of [JAKARTA, MAKASSAR, PONTIANAK]) {
    const l = buildLevels(a)
    assert.equal(l.at(-1)?.key, 'kota', a)
    assert.ok(!/\d{5}/.test(l[1].q), 'kode pos dibuang di tingkat 2')
    assert.ok(!/No\.?\s*\d/.test(l[1].q), 'nomor rumah dibuang di tingkat 2')
  }
  assert.equal(buildLevels(MAKASSAR).at(-1)?.q, 'Kota Makassar, Sulawesi Selatan')
  assert.equal(buildLevels(PONTIANAK).at(-1)?.q, 'Kota Pontianak, Kalimantan Barat')
  assert.equal(parseAddress(BATU).kodepos, '65311')
})

test('berhenti di tingkat pertama yang memberi hasil dan mencatat yang gagal (jaringan di-mock)', async () => {
  const place: Place = { name: 'Wagir', kecamatan: 'Wagir', city: 'Kabupaten Malang', province: 'Jawa Timur', lat: -7.97, lon: 112.57, display: '' }
  const asked: string[] = []
  const attempts: Attempt[] = []
  const r = await walkLevels(
    buildLevels(WAGIR),
    async (l) => {
      asked.push(l.key)
      return { places: l.key === 'kecamatan' ? [place] : [], cached: false }
    },
    'mock',
    attempts,
  )
  assert.deepEqual(asked, ['utuh', 'bersih', 'jalan', 'kecamatan'], 'tingkat kota tidak dicoba lagi')
  assert.equal(r?.level?.key, 'kecamatan')
  assert.equal(r?.places[0].precision, 'kecamatan', 'ketepatan mengikuti tingkat yang berhasil')
  assert.equal(attempts.length, 4)
  assert.equal(attempts[0].count, 0)
})

test('kalau semua tingkat kosong hasilnya null dan semua percobaan tercatat; galat jaringan tidak menghentikan penelusuran', async () => {
  const attempts: Attempt[] = []
  let n = 0
  const r = await walkLevels(buildLevels(WAGIR), async () => {
    if (n++ === 0) throw new Error('timeout')
    return { places: [], cached: false }
  }, 'mock', attempts)
  assert.equal(r, null)
  assert.equal(attempts.length, 5)
  assert.equal(attempts[0].error, 'timeout')
})

test('hanya kabupaten yang ketemu: tarif tetap bisa dicocokkan', () => {
  const kab: Place = { name: 'Kabupaten Malang', kecamatan: '', city: 'Kabupaten Malang', province: 'Jawa Timur', lat: -8, lon: 112.6, display: '', precision: 'kota' }
  assert.equal(matchCity(kab, ['Surabaya', 'Malang']).city, 'Malang')
})

test('cache: hasil kosong hanya berlaku beberapa menit, hasil berisi lama', () => {
  const now = Date.now()
  const old = (ms: number) => new Date(now - ms)
  assert.equal(cacheUsable({ results: '[]', createdAt: old(TTL_EMPTY_MS - 1000) }, now), true)
  assert.equal(cacheUsable({ results: '[]', createdAt: old(TTL_EMPTY_MS + 1000) }, now), false)
  assert.equal(cacheUsable({ results: '[{"a":1}]', createdAt: old(24 * 3600_000) }, now), true)
  assert.equal(cacheUsable(null, now), false)
})

test('ketepatan dari jenis tempat penyedia', () => {
  assert.equal(precisionOf('house', 'kota'), 'alamat')
  assert.equal(precisionOf('municipality', 'kota'), 'kecamatan')
  assert.equal(precisionOf('county', 'alamat'), 'kota')
  assert.equal(precisionOf('town', 'kota'), 'kecamatan', 'permukiman setingkat kecamatan, bukan kota')
  assert.equal(precisionOf(undefined, 'kecamatan'), 'kecamatan')
})

test('pemetaan Photon dan addresstype Nominatim', () => {
  const ph = mapPhoton([
    { geometry: { coordinates: [112.5, -7.9] }, properties: { name: 'Wagir', district: 'Wagir', county: 'Kabupaten Malang', state: 'Jawa Timur', countrycode: 'ID', type: 'district' } },
    { geometry: { coordinates: [100, 5] }, properties: { name: 'Luar negeri', countrycode: 'MY' } },
  ])
  assert.equal(ph.length, 1)
  assert.deepEqual([ph[0].city, ph[0].precision], ['Kabupaten Malang', 'kecamatan'])
  const nm = mapNominatim([{ name: 'Wagir', lat: '-7.9', lon: '112.5', addresstype: 'municipality', address: { municipality: 'Wagir', county: 'Kabupaten Malang', state: 'Jawa Timur' } }])
  assert.deepEqual([nm[0].kecamatan, nm[0].city, nm[0].precision], ['Wagir', 'Kabupaten Malang', 'kecamatan'])
  const town = mapNominatim([{ name: 'Wagir', lat: '-8.01', lon: '112.59', addresstype: 'town', address: { town: 'Wagir', county: 'Kabupaten Malang', state: 'Jawa Timur' } }])
  assert.deepEqual([town[0].kecamatan, town[0].city, town[0].precision], ['Wagir', 'Kabupaten Malang', 'kecamatan'])
})
