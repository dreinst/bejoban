import test from 'node:test'
import assert from 'node:assert/strict'
import { answer, parseCity, parseQty, type Tire } from '../src/lib/bot/engine'
import { decide, mergeBot, normalizeNumber, withinHours } from '../src/lib/bot/policy'

// Data karangan untuk tes, bukan stok asli.
const t = (id: number, ring: number, sizeRaw: string, sizeNorm: string, brand: string, price: number | null, stock: number, note = ''): Tire => ({ id, ring, sizeRaw, sizeNorm, brand, price, stock, note })
const tires: Tire[] = [
  t(1, 15, '185/65-15', '185/65R15', 'Alfa Contoh', 600000, 5),
  t(2, 15, '185/65-15', '185/65R15', 'Beta Contoh', 550000, 0),
  t(3, 15, '185/65-15', '185/65R15', 'Gamma Contoh', null, 3),
  t(4, 15, '195/55-15', '195/55R15', 'Alfa Contoh', 700000, 0),
  t(5, 15, '195/55-15', '195/55R15', 'Beta Contoh', 710000, 2, 'DATA CONTOH'),
  t(6, 13, '165-13', '165-13', 'Alfa Contoh', 650000, 4),
]

test('daftar ready lebih dulu, termurah dulu, harga kosong ditulis apa adanya', () => {
  const a = answer('ada 185/65 R15?', tires)
  assert.equal(a.handoff, false)
  const i = (s: string) => a.reply.indexOf(s)
    assert.ok(a.reply.includes('Rp 600.000'))
  assert.ok(a.reply.includes('harga belum diisi'))
  assert.ok(i('Beta Contoh: stok kosong') > i('Alfa Contoh: Rp'))
})

test('merek yang kosong menawarkan merek lain di ukuran sama', () => {
  const b = answer('alfa 195/55 r15', tires)
  assert.equal(b.handoff, false)
  assert.ok(b.reply.includes('kosong'))
  assert.ok(b.reply.includes('Merek lain'))
  assert.ok(b.reply.includes('Rp 710.000'))
})

test('ukuran muatan dan ring', () => {
  assert.ok(answer('165 - 13', tires).reply.includes('Rp 650.000'))
  const r = answer('ring 15', tires)
  assert.equal(r.handoff, false)
  assert.ok(r.reply.includes('185/65-15'))
})

test('pesan tanpa ukuran atau merek diserahkan ke admin', () => {
  const a = answer('halo selamat siang pak', tires)
  assert.equal(a.handoff, true)
  assert.equal(a.intent, 'serahkan')
  assert.ok(a.reply.length > 0)
})

test('ukuran yang tidak ada di data diserahkan ke admin, tidak dikarang', () => {
  const a = answer('ada 225/45 R17?', tires)
  assert.equal(a.handoff, true)
  assert.ok(!a.reply.includes('Rp'))
})

test('ongkir diteruskan ke modul ongkir, info kurang diserahkan', () => {
  const a = answer('ongkir 4 ban 185/65 R15 ke Surabaya', tires, { shipQuote: (r) => `${r.qty}|${r.sizeNorm}|${r.city}` })
  assert.equal(a.intent, 'ongkir')
  assert.equal(a.reply, '4|185/65R15|Surabaya')
  assert.equal(answer('ongkir ke Surabaya', tires, { shipQuote: () => 'x' }).handoff, true)
  assert.equal(answer('ongkir 185/65 R15 ke Surabaya', tires).handoff, true)
})

test('parseCity dan parseQty', () => {
  assert.equal(parseCity('ongkir 2 ban ke surabaya dong'), 'Surabaya')
  assert.equal(parseCity('kirim ke Kota Malang ya'), 'Kota Malang')
  assert.equal(parseQty('ongkir 4 ban 185/65 R15'), 4)
  assert.equal(parseQty('185/65 R15 ke Surabaya'), null)
})

test('kebijakan balasan', () => {
  const s = mergeBot({ enabled: true, numbers: ['0812-3456-7890'], startTime: '08:00', endTime: '17:00', gapSec: 20, dailyLimit: 5 })
  const noon = new Date('2026-11-16T05:00:00Z') // 12.00 WIB
  const night = new Date('2026-11-16T17:00:00Z') // 00.00 WIB
  const base = { settings: s, now: noon, sender: '6281234567890@c.us', handoff: false, adminReplied: false, sentToday: 0, lastSentAt: null }
  assert.equal(normalizeNumber('0812-3456-7890'), '6281234567890')
  assert.equal(decide(base).send, true)
  assert.equal(decide({ ...base, settings: { ...s, enabled: false } }).send, false)
  assert.equal(decide({ ...base, sender: '6289999999999' }).send, false)
  assert.equal(decide({ ...base, now: night }).send, false)
  assert.equal(decide({ ...base, adminReplied: true }).send, false)
  assert.equal(decide({ ...base, handoff: true }).send, false)
  assert.equal(decide({ ...base, sentToday: 5 }).send, false)
  assert.equal(decide({ ...base, lastSentAt: new Date(noon.getTime() - 5000) }).send, false)
  assert.equal(withinHours(noon, s), true)
})
