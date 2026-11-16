import test from 'node:test'
import assert from 'node:assert/strict'
import { handle, matchServices, parseBranchPick, type BotContext, type Service, type Tire } from '../src/lib/bot/engine'

// Semua angka di bawah karangan untuk tes, bukan data asli.
const t = (id: number, ring: number, sizeRaw: string, sizeNorm: string, brand: string, price: number | null, stock: number, note = '', discount = 0): Tire => ({ id, ring, sizeRaw, sizeNorm, brand, price, discount, stock, note })
const tires: Tire[] = [
  t(1, 15, '185/65-15', '185/65R15', 'Alfa Contoh', 600000, 5),
  t(2, 15, '185/65-15', '185/65R15', 'Beta Contoh', 550000, 0),
  t(3, 15, '185/65-15', '185/65R15', 'Gamma Contoh', 650000, 3, 'disc 50.000', 50000),
  t(4, 15, '195/55-15', '195/55R15', 'Alfa Contoh', 700000, 0),
  t(5, 15, '195/55-15', '195/55R15', 'Beta Contoh', null, 2),
  t(6, 13, '165-13', '165-13', 'Alfa Contoh', 650000, 4),
  t(7, 16, '205/55-16', '205/55R16', 'Delta Contoh', null, 8),
  t(8, 15, '31x10.5-15', '31x10.5-15', 'Gamma Contoh', 1500000, 2),
]
const sv = (o: Partial<Service> & Pick<Service, 'groupName' | 'name' | 'price'>): Service => ({
  id: 0, variant: '', ringMin: null, ringMax: null, minDiameter: null, unit: '', altLabel: '', altPrice: null, note: '', keywords: '', ...o,
})
const services: Service[] = [
  sv({ groupName: 'Spooring', name: 'Spooring', variant: 'R12 sampai R15', ringMin: 12, ringMax: 15, price: 100000, altLabel: 'paket', altPrice: 180000, keywords: 'spooring' }),
  sv({ groupName: 'Spooring', name: 'Spooring', variant: 'R16 ke atas', ringMin: 16, price: 120000, altLabel: 'paket', altPrice: 200000, keywords: 'spooring' }),
  sv({ groupName: 'Balance', name: 'Balance', variant: 'R12 sampai R19', ringMin: 12, ringMax: 19, price: 20000, unit: 'per roda', keywords: 'balance' }),
  sv({ groupName: 'Balance', name: 'Balance', variant: 'ban 31 ke atas', minDiameter: 31, price: 35000, unit: 'per roda', keywords: 'balance' }),
  sv({ groupName: 'Ganti oli', name: 'Ganti oli', price: 0, note: 'kalau beli oli di toko', keywords: 'ganti oli' }),
  sv({ groupName: 'Nitrogen', name: 'Cek nitrogen', price: 10000, keywords: 'cek nitrogen, nitrogen' }),
  sv({ groupName: 'Nitrogen', name: 'Nitrogen', price: 4000, unit: 'per ban', keywords: 'nitrogen' }),
]
const ctx: BotContext = {
  branches: [{ slug: 'batu', name: 'Bejo Ban Batu (Contoh)' }, { slug: 'karanglo', name: 'Bejo Ban Karanglo', aliases: ['singosari'] }],
  adminNumbers: { batu: '6281100000001', karanglo: '6281100000002' },
  ownerNumber: '6281100000009',
  services,
  jamBuka: '08.00 sampai 17.00',
}
const BATU = 'Halo kak Bejo Ban Batu, '

test('stok ada: harga dan stok asli dari data, potongan disebut bersama harga asal', () => {
  const o = handle(BATU + 'ada ban 185/65 R15?', tires, ctx)
  assert.equal(o.kind, 'stok_ada')
  assert.equal(o.status, 'DIJAWAB_BOT')
  assert.ok(o.reply.includes('Alfa Contoh: Rp 600.000, stok 5'))
  assert.ok(o.reply.includes('Gamma Contoh: Rp 600.000 (harga asal Rp 650.000, potongan Rp 50.000), stok 3'))
  assert.ok(!o.reply.includes('Beta Contoh'), 'stok 0 tidak ikut daftar')
})

test('stok 0 di semua baris: tidak menjawab harga, serah ke admin cabang', () => {
  const o = handle(BATU + 'ada ban 195/55 R15 alfa?', tires, ctx)
  assert.equal(o.kind, 'serah')
  assert.equal(o.status, 'DISERAHKAN')
  assert.ok(!o.reply.includes('Rp'))
  assert.equal(o.adminNumber, '6281100000001')
  assert.ok(o.adminNote?.includes('Bejo Ban Batu'))
  assert.ok(o.adminNote?.includes('stok 0'))
})

test('harga kosong di data dianggap tidak tersedia, bukan "harga belum diisi"', () => {
  const o = handle('Bejo Ban Karanglo, ada 205/55 R16?', tires, ctx)
  assert.equal(o.kind, 'serah')
  assert.ok(!o.reply.includes('belum diisi'))
  assert.equal(o.adminNumber, '6281100000002')
})

test('ukuran tidak ada di data: serah, tidak dikarang', () => {
  const o = handle(BATU + 'ada 225/45 R17?', tires, ctx)
  assert.equal(o.kind, 'serah')
  assert.ok(o.adminNote?.includes('tidak ada baris'))
})

test('pesan tidak dikenali dan cabang belum diketahui: bot menanyakan cabang bernomor', () => {
  const o = handle('mohon bantuannya pak', tires, ctx)
  assert.equal(o.kind, 'tanya_cabang')
  assert.ok(o.reply.includes('1. Bejo Ban Batu'))
  assert.ok(o.reply.includes('2. Bejo Ban Karanglo'))
  assert.deepEqual(o.awaiting, { action: 'serah', text: 'mohon bantuannya pak' })
})

test('cabang tidak ditanyakan sebelum menjawab stok', () => {
  const o = handle('ada ban 185/65 R15?', tires, ctx)
  assert.equal(o.kind, 'stok_ada')
  assert.equal(o.branchSlug, '')
})

test('sapaan dari kalimat pembuka tanpa ukuran', () => {
  const o = handle('Halo kak Bejo Ban Karanglo, saya mau tanya stok dan harga ban.', tires, ctx)
  assert.equal(o.kind, 'sapaan')
  assert.equal(o.branchSlug, 'karanglo')
  assert.equal(o.branchChosen, 'karanglo')
})

test('jawaban angka memilih cabang lalu serah terima ke admin cabang itu', () => {
  assert.equal(parseBranchPick('2', ctx.branches)?.slug, 'karanglo')
  assert.equal(parseBranchPick(' 1. ', ctx.branches)?.slug, 'batu')
  assert.equal(parseBranchPick('3', ctx.branches), null)
  const o = handle('2', tires, { ...ctx, awaiting: { action: 'serah', text: 'ada 225/45 R17?' } })
  assert.equal(o.kind, 'serah')
  assert.equal(o.branchChosen, 'karanglo')
  assert.equal(o.adminNumber, '6281100000002')
  assert.ok(o.adminNote?.includes('225/45'))
})

test('pelanggan tidak menjawab pertanyaan cabang: serahkan ke owner', () => {
  const o = handle('halo?', tires, { ...ctx, awaiting: { action: 'serah', text: 'ada 225/45 R17?' } })
  assert.equal(o.kind, 'serah')
  assert.equal(o.adminNumber, '6281100000009')
  assert.ok(o.adminNote?.includes('tidak menjawab pilihan cabang'))
})

test('ingatan cabang dipakai, tapi nama cabang di pesan menggantinya', () => {
  const a = handle('ada 225/45 R17?', tires, { ...ctx, knownBranch: 'karanglo' })
  assert.equal(a.kind, 'serah')
  assert.equal(a.adminNumber, '6281100000002')
  assert.equal(a.branchChosen, '')
  const b = handle('ada 225/45 R17 di batu?', tires, { ...ctx, knownBranch: 'karanglo' })
  assert.equal(b.adminNumber, '6281100000001')
  assert.equal(b.branchChosen, 'batu')
})

test('ganti cabang: bertanya lalu mengonfirmasi', () => {
  const ask = handle('ganti cabang', tires, { ...ctx, knownBranch: 'batu' })
  assert.equal(ask.kind, 'tanya_cabang')
  assert.equal(ask.awaiting?.action, 'ganti')
  const done = handle('2', tires, { ...ctx, awaiting: ask.awaiting })
  assert.equal(done.kind, 'cabang_diganti')
  assert.equal(done.branchChosen, 'karanglo')
  assert.equal(handle('ganti cabang karanglo', tires, ctx).branchChosen, 'karanglo')
})

test('mau datang, pasang, atau booking: cabang ditanyakan, jawaban stok tetap dikirim', () => {
  const o = handle('mau pasang ban 185/65 R15 besok', tires, ctx)
  assert.equal(o.kind, 'tanya_cabang')
  assert.ok(o.reply.includes('Alfa Contoh'))
  assert.ok(o.reply.includes('1. Bejo Ban Batu'))
  const known = handle('mau datang besok, ada 185/65 R15?', tires, { ...ctx, knownBranch: 'batu' })
  assert.equal(known.kind, 'serah')
  assert.ok(known.reply.includes('Alfa Contoh'))
  assert.equal(known.adminNumber, '6281100000001')
})

test('harga jasa dari tabel: pilih variasi menurut ring', () => {
  const a = handle('spooring ring 15 berapa?', tires, ctx)
  assert.equal(a.kind, 'jasa_ada')
  assert.ok(a.reply.includes('Spooring R12 sampai R15: Rp 100.000, paket Rp 180.000'))
  assert.ok(!a.reply.includes('R16'))
  const b = handle('harga spooring?', tires, ctx)
  assert.ok(b.reply.includes('R12 sampai R15') && b.reply.includes('R16 ke atas'))
  const c = handle('ganti oli', tires, ctx)
  assert.ok(c.reply.includes('Ganti oli: gratis, kalau beli oli di toko'))
})

test('jasa: ukuran ban 31 ke atas memakai tarif khusus, nitrogen memilih yang paling spesifik', () => {
  const r = handle('balance 31x10.5-15', tires, ctx)
  assert.ok(r.reply.includes('Rp 35.000') && !r.reply.includes('Rp 20.000'))
  const m = matchServices('cek nitrogen', services, [], null)
  assert.deepEqual(m.rows.map((x) => x.name), ['Cek nitrogen'])
  assert.equal(matchServices('nitrogen', services, [], null).rows.length, 2)
})

test('jasa yang tidak ada di tabel atau ring tanpa tarif diserahkan ke admin', () => {
  assert.equal(handle(BATU + 'cuci mobil berapa?', tires, ctx).kind, 'serah')
  const noRing = handle(BATU + 'spooring ring 10', tires, { ...ctx, services: [services[0]] })
  assert.equal(noRing.kind, 'serah')
})

test('merek atau ring saja yang terlalu banyak hasilnya: minta ukuran, bukan kirim seluruh daftar', () => {
  const many: Tire[] = Array.from({ length: 12 }, (_, i) => t(100 + i, 15, `18${i}/65-15`, `18${i}/65R15`, 'Alfa Contoh', 500000 + i, 3))
  const o = handle('ada alfa?', many, ctx)
  assert.equal(o.kind, 'tanya_ukuran')
  assert.ok(!o.reply.includes('Rp'))
  assert.equal(handle('ring 15', tires, ctx).kind, 'tanya_ukuran')
})
