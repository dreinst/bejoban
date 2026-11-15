import test from 'node:test'
import assert from 'node:assert/strict'
import { calcQuote, mergeSettings, normCity } from '../src/lib/ongkir/calc'
import { summaryText } from '../src/lib/ongkir/format'
import type { Rate } from '../src/lib/ongkir/types'

const rate: Rate = { carrier: 'JNT_CARGO', city: 'Surabaya', perKg: 5000, minWeight: 10, etaDays: '2-3', note: '', isSample: false }
const s = mergeSettings({
  ringPack: { '15': { weightKg: 9, lengthCm: 60, widthCm: 60, heightCm: 20 } },
  ringPackSample: false,
  packingPerTire: 3000,
})

test('berat volume menang kalau lebih besar dari berat asli', () => {
  // 4 ban: asli 36 kg, volume 4 x 72000 / 4000 = 72 kg
  const q = calcQuote('JNT_CARGO', 'Surabaya', rate, { tires: { count: 4, ring: 15 }, usePacking: false }, s)
  assert.equal(q.status, 'OK')
  if (q.status !== 'OK') return
  assert.equal(q.actualKg, 36)
  assert.equal(q.volumeKg, 72)
  assert.equal(q.billedKg, 72)
  assert.equal(q.total, 360000)
  assert.equal(q.isSample, false)
})

test('berat minimum dipakai kalau paket ringan', () => {
  const q = calcQuote('JNT_CARGO', 'Surabaya', rate, { manualWeightKg: 3, usePacking: false }, s)
  assert.ok(q.status === 'OK' && q.billedKg === 10 && q.total === 50000)
})

test('pembulatan ke atas per kg dan packing per ban', () => {
  const q = calcQuote('JNT_CARGO', 'Surabaya', rate, { tires: { count: 1, ring: 15 }, usePacking: true }, s)
  // volume 18 kg, asli 9 kg, minimum 10 -> 18
  assert.ok(q.status === 'OK' && q.billedKg === 18 && q.packing === 3000 && q.total === 18 * 5000 + 3000)
  const m = calcQuote('JNT_CARGO', 'Surabaya', rate, { manualWeightKg: 10.2, usePacking: false }, s)
  assert.ok(m.status === 'OK' && m.billedKg === 11)
})

test('tarif belum ada dan kemasan ring belum ada', () => {
  assert.equal(calcQuote('BARAKA', 'Surabaya', null, { manualWeightKg: 5, usePacking: false }, s).status, 'NO_RATE')
  assert.equal(calcQuote('JNT_CARGO', 'Surabaya', rate, { tires: { count: 1, ring: 20 }, usePacking: false }, s).status, 'NO_PACK')
})

test('angka contoh selalu berlabel di ringkasan', () => {
  const sample = mergeSettings({ ringPack: s.ringPack, ringPackSample: true })
  const q = calcQuote('JNT_CARGO', 'Surabaya', { ...rate, isSample: true }, { tires: { count: 1, ring: 15 }, usePacking: false }, sample)
  assert.ok(q.status === 'OK' && q.isSample)
  const text = summaryText([q, calcQuote('BARAKA', 'Surabaya', null, { manualWeightKg: 1, usePacking: false }, s)], '1 ban', 'Batu')
  assert.match(text, /contoh, belum dari agen/)
  assert.match(text, /Baraka ke Surabaya: tarif belum diisi/)
})

test('nama kota dicocokkan tanpa peduli huruf besar dan awalan Kota', () => {
  assert.equal(normCity('Kota  Surabaya'), normCity('surabaya'))
})
