// Chatbot dengan stok per cabang dan merek by order. Semua angka dan merek karangan untuk tes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { handle, type BotContext, type Tire } from '../src/lib/bot/engine'

const t = (id: number, sizeNorm: string, brand: string, price: number | null, stock: number, cabang: string | null = null): Tire => ({
  id,
  ring: Number(/R(\d+)/.exec(sizeNorm)?.[1] ?? 0),
  sizeRaw: sizeNorm.replace('R', '-'),
  sizeNorm,
  brand,
  price,
  discount: 0,
  stock,
  note: '',
  cabang,
})

const ctx: BotContext = {
  branches: [{ slug: 'batu', name: 'Bejo Ban Batu (Contoh)' }, { slug: 'karanglo', name: 'Bejo Ban Karanglo', aliases: ['singosari'] }],
  adminNumbers: { batu: '6281100000001', karanglo: '6281100000002' },
  ownerNumber: '6281100000009',
  stokPerCabang: true,
  byOrderBrands: ['Falken', 'Maxxis'],
}

// Baris lama tanpa cabang.
const tanpa: Tire[] = [t(1, '185/65R15', 'Alfa Contoh', 600000, 5), t(2, '185/65R15', 'Beta Contoh', 550000, 0), t(3, '195/55R15', 'Alfa Contoh', 700000, 0)]
// Baris yang sudah ditetapkan cabangnya.
const bercabang: Tire[] = [
  t(11, '185/65R15', 'Alfa Contoh', 600000, 4, 'batu'),
  t(12, '185/65R15', 'Alfa Contoh', 615000, 7, 'karanglo'),
  t(13, '205/55R16', 'Gamma Contoh', 900000, 0, 'batu'),
  t(14, '205/55R16', 'Gamma Contoh', 950000, 3, 'karanglo'),
  t(15, '215/60R16', 'Delta Contoh', 800000, 0, 'batu'),
  t(16, '215/60R16', 'Delta Contoh', 800000, 0, 'karanglo'),
]

test('baris tanpa cabang: jawaban sama persis dengan saklar mati, cabang tidak ditanyakan', () => {
  for (const q of ['ada ban 185/65 R15?', 'Halo kak Bejo Ban Batu, ada 195/55 R15?', 'ada alfa?', 'mau pasang ban 185/65 R15 besok']) {
    const nyala = handle(q, tanpa, ctx)
    const mati = handle(q, tanpa, { ...ctx, stokPerCabang: false })
    assert.deepEqual(nyala, mati, q)
  }
  const o = handle('ada ban 185/65 R15?', tanpa, ctx)
  assert.equal(o.kind, 'stok_ada')
  assert.ok(o.reply.includes('Alfa Contoh: Rp 600.000, stok 5'))
})

test('baris bercabang: cabang ditanyakan dulu, tanpa menyebut stok atau harga', () => {
  const o = handle('ada ban 185/65 R15?', bercabang, ctx)
  assert.equal(o.kind, 'tanya_cabang')
  assert.equal(o.status, 'BARU')
  assert.ok(!o.reply.includes('Rp'))
  assert.ok(o.reply.includes('1. Bejo Ban Batu') && o.reply.includes('2. Bejo Ban Karanglo'))
  assert.deepEqual(o.awaiting, { action: 'stok', text: 'ada ban 185/65 R15?' })

  // Pelanggan menjawab 2: stok Karanglo saja yang disebut.
  const j = handle('2', bercabang, { ...ctx, awaiting: o.awaiting })
  assert.equal(j.kind, 'stok_ada')
  assert.equal(j.branchChosen, 'karanglo')
  assert.ok(j.reply.includes('Rp 615.000, stok 7'))
  assert.ok(!j.reply.includes('Rp 600.000'), 'harga cabang lain tidak ikut')
})

test('cabang sudah diketahui dari pesan atau ingatan: langsung dijawab stok cabang itu', () => {
  const a = handle('Halo kak Bejo Ban Batu, ada 185/65 R15?', bercabang, ctx)
  assert.equal(a.kind, 'stok_ada')
  assert.ok(a.reply.includes('Rp 600.000, stok 4') && !a.reply.includes('stok 7'))
  const b = handle('ada 185/65 R15?', bercabang, { ...ctx, knownBranch: 'karanglo' })
  assert.ok(b.reply.includes('stok 7') && !b.reply.includes('stok 4'))
})

test('campuran: baris tanpa cabang ikut dijawab bersama baris cabang pelanggan', () => {
  const rows = [...tanpa, ...bercabang]
  assert.equal(handle('ada 185/65 R15?', rows, ctx).kind, 'tanya_cabang')
  const o = handle('ada 185/65 R15?', rows, { ...ctx, knownBranch: 'batu' })
  assert.equal(o.kind, 'stok_ada')
  assert.ok(o.reply.includes('stok 5') && o.reply.includes('stok 4') && !o.reply.includes('stok 7'))
})

test('kosong di cabang pelanggan tapi ada di cabang lain: sebut cabangnya tanpa angka, serah ke admin cabang pelanggan', () => {
  const o = handle('Halo kak Bejo Ban Batu, ada 205/55 R16?', bercabang, ctx)
  assert.equal(o.kind, 'serah')
  assert.equal(o.status, 'DISERAHKAN')
  assert.equal(o.adminNumber, '6281100000001')
  assert.ok(o.reply.includes('tersedia di cabang Bejo Ban Karanglo'))
  assert.ok(o.reply.includes('205/55'))
  assert.ok(!o.reply.includes('Rp') && !o.reply.includes('950') && !/stok \d/.test(o.reply), 'tanpa angka stok dan harga cabang lain')
  assert.ok(o.adminNote?.includes('tersedia di cabang Bejo Ban Karanglo'))
})

test('semua cabang kosong: serah ke admin seperti biasa', () => {
  const o = handle('ada 215/60 R16?', bercabang, { ...ctx, knownBranch: 'karanglo' })
  assert.equal(o.kind, 'serah')
  assert.equal(o.adminNumber, '6281100000002')
  assert.ok(o.reply.startsWith('Terima kasih kak'))
  assert.ok(!o.reply.includes('tersedia di cabang'))
})

test('saklar mati: cabang diabaikan, semua baris satu stok seperti dulu', () => {
  const o = handle('ada 185/65 R15?', bercabang, { ...ctx, stokPerCabang: false })
  assert.equal(o.kind, 'stok_ada')
  assert.ok(o.reply.includes('stok 4') && o.reply.includes('stok 7'))
  const b = handle('Halo kak Bejo Ban Batu, ada 205/55 R16?', bercabang, { ...ctx, stokPerCabang: false })
  assert.equal(b.kind, 'stok_ada', 'stok Karanglo dianggap stok bersama')
})

test('pertanyaan cabang tidak dijawab: diserahkan ke owner tanpa menyebut stok bercabang', () => {
  const o = handle('halo?', bercabang, { ...ctx, awaiting: { action: 'stok', text: 'ada 185/65 R15?' } })
  assert.equal(o.kind, 'serah')
  assert.equal(o.adminNumber, '6281100000009')
  assert.ok(!o.reply.includes('Rp'))
})

test('merek by order yang stoknya kosong: bisa dipesan dulu, diserahkan ke admin cabang', () => {
  const o = handle('Halo kak Bejo Ban Karanglo, ada falken 185/65 R15?', bercabang, ctx)
  assert.equal(o.kind, 'serah')
  assert.equal(o.status, 'DISERAHKAN')
  assert.equal(o.adminNumber, '6281100000002')
  assert.ok(o.reply.includes('Falken') && o.reply.includes('bisa dipesan dulu') && o.reply.includes('185/65 R15'))
  assert.ok(!o.reply.includes('Rp'), 'merek lain tidak ditawarkan')
  assert.ok(o.adminNote?.includes('merek by order: Falken'))

  // Cabang belum diketahui: tanya cabang dulu, lalu jawaban by order untuk cabang pilihan.
  const ask = handle('ada maxxis ring 15?', tanpa, ctx)
  assert.equal(ask.kind, 'tanya_cabang')
  const done = handle('1', tanpa, { ...ctx, awaiting: ask.awaiting })
  assert.equal(done.kind, 'serah')
  assert.equal(done.adminNumber, '6281100000001')
  assert.ok(done.reply.includes('Maxxis') && done.reply.includes('ring 15'))
})

test('merek by order yang ternyata ada stoknya dijawab biasa', () => {
  const rows = [...tanpa, t(30, '185/65R15', 'Falken Contoh', 650000, 2)]
  const o = handle('Bejo Ban Batu, ada falken 185/65 R15?', rows, ctx)
  assert.equal(o.kind, 'stok_ada')
  assert.ok(o.reply.includes('Falken Contoh: Rp 650.000, stok 2'))
  assert.ok(!o.reply.includes('Alfa Contoh'))
})
