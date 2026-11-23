// Tes kasir yang menyentuh database: pengaktifan, jual, FIFO, idempotency, balapan unit terakhir, void, hak cabang,
// penolakan impor, peringatan stok, dan invarian sesudah urutan acak. Basis data PostgreSQL sementara (tests/db-uji.ts).
// Semua data di sini karangan.
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { siapkanDbUji } from './db-uji'
import type { ParseResult } from '../src/lib/tire/pricelist'

let dbUji: Awaited<ReturnType<typeof siapkanDbUji>> | undefined

type Mod = {
  db: typeof import('../src/lib/db').db
  stok: typeof import('../src/lib/kasir/stok')
  trx: typeof import('../src/lib/kasir/transaksi')
  ubah: typeof import('../src/lib/stok/ubah')
  applyImport: typeof import('../src/lib/tire/import').applyImport
  tetapkanTanpaCabang: typeof import('../src/lib/stok/tetapkan').tetapkanTanpaCabang
  GalatKasir: typeof import('../src/lib/kasir/logika').GalatKasir
  GalatStok: typeof import('../src/lib/stok/logika').GalatStok
}
let m: Mod

type Sesi = import('../src/lib/kasir/transaksi').SesiKasir
let A = 0 // cabang mode kasir
let B = 0 // cabang mode kasir kedua
let C = 0 // cabang mode sheet
let owner: Sesi
let adminA: Sesi
let adminB: Sesi
let banA = 0 // ban di cabang A, stok 20, harga 100.000
let banTipis = 0 // ban di cabang A, stok 1
let banNol = 0 // ban di cabang A berharga kosong
let banC = 0 // ban di cabang C (mode sheet)
let listingA = 0 // produk situs di cabang A
let jasa = 0

before(async () => {
  dbUji = await siapkanDbUji('kasir')
  const [{ db }, stok, trx, ubah, { applyImport }, { tetapkanTanpaCabang }, { GalatKasir }, { GalatStok }] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/kasir/stok'),
    import('../src/lib/kasir/transaksi'),
    import('../src/lib/stok/ubah'),
    import('../src/lib/tire/import'),
    import('../src/lib/stok/tetapkan'),
    import('../src/lib/kasir/logika'),
    import('../src/lib/stok/logika'),
  ])
  m = { db, stok, trx, ubah, applyImport, tetapkanTanpaCabang, GalatKasir, GalatStok }
  A = (await db.branch.create({ data: { slug: 'contoh-a', name: 'Cabang Contoh A' } })).id
  B = (await db.branch.create({ data: { slug: 'contoh-b', name: 'Cabang Contoh B' } })).id
  C = (await db.branch.create({ data: { slug: 'contoh-c', name: 'Cabang Contoh C' } })).id
  const u = async (username: string, role: 'OWNER' | 'BRANCH_ADMIN', branchId: number | null) => {
    const x = await db.user.create({ data: { username, passwordHash: '-', role, branchId } })
    return { uid: x.id, role, branchId, name: username }
  }
  owner = await u('owner-uji', 'OWNER', null)
  adminA = await u('admin-a', 'BRANCH_ADMIN', A)
  adminB = await u('admin-b', 'BRANCH_ADMIN', B)
  const ban = (cabangId: number, sizeNorm: string, stock: number, price: number | null, discount = 0) =>
    db.stockTire.create({ data: { cabangId, ring: 15, sizeRaw: sizeNorm, sizeNorm, brand: 'Merek Contoh', price, discount, stock, kode: `${sizeNorm}|merek contoh`, groupName: 'R15' } })
  banA = (await ban(A, '185/65R15', 20, 110_000, 10_000)).id
  banTipis = (await ban(A, '195/60R15', 1, 500_000)).id
  banNol = (await ban(A, '205/65R15', 4, null)).id
  await ban(B, '185/65R15', 7, 115_000) // kode sama dengan banA, untuk stok cabang lain
  banC = (await ban(C, '185/65R15', 3, 100_000)).id
  const p = await db.product.create({ data: { slug: 'oli-contoh', name: 'Oli Contoh 1L', kode: 'OLI-CONTOH' } })
  listingA = (await db.listing.create({ data: { productId: p.id, branchId: A, price: 75_000, stock: 10 } })).id
  await db.listing.create({ data: { productId: p.id, branchId: C, price: 75_000, stock: 4 } })
  jasa = (await db.servicePrice.create({ data: { groupName: 'Balancing', name: 'Balancing', price: 25_000, unit: 'per roda', altLabel: 'paket 4 roda', altPrice: 90_000 } })).id
})

after(async () => {
  await m?.db.$disconnect()
  await dbUji?.hapus()
})

const kunci = () => randomUUID()
// Tanpa totalDilihat di `lain`, cek total dilewati (totalDilihat null), seperti pemanggil server tanpa layar.
const input = (cabangId: number, baris: { sumber: 'ban' | 'produk' | 'jasa'; id: number; jumlah: number; alt?: boolean }[], lain: Partial<import('../src/lib/kasir/transaksi').InputJual> = {}) => {
  const x = m.trx.bacaInputJual({ cabangId, channel: 'toko', metode: 'qris', diskon: 0, alasanDiskon: '', dibayar: null, kunci: kunci(), totalDilihat: 0, baris, ...lain })
  return 'totalDilihat' in lain ? x : { ...x, totalDilihat: null }
}
const stokBan = async (id: number) => (await m.db.stockTire.findUniqueOrThrow({ where: { id } })).stock
const sisaBatch = async (sumber: string, barisId: number) => (await m.db.batchStok.findMany({ where: { sumber, barisId }, orderBy: { id: 'asc' } })).map((b) => b.sisa)
const invarianBersih = async () => assert.deepEqual((await m.stok.periksaInvarian()).masalah, [])

test('pengaktifan kasir: batch awal sesuai stok dan harga efektif, harga baris disamakan', async () => {
  const calon = await m.stok.hitungCalonAktivasi(A)
  assert.equal(calon.banStok, 3)
  assert.equal(calon.hargaNol, 1)
  const h = await m.stok.aktifkanKasir({ cabangId: A, kodeNota: 'cta', pengguna: String(owner.uid) })
  assert.equal(h.kodeNota, 'CTA')
  assert.equal(h.batch, 4) // tiga ban berstok dan satu listing
  await m.stok.aktifkanKasir({ cabangId: B, kodeNota: 'CTB', pengguna: String(owner.uid) })
  await assert.rejects(m.stok.aktifkanKasir({ cabangId: C, kodeNota: 'CTA', pengguna: null }), /sudah dipakai/)
  await assert.rejects(m.stok.aktifkanKasir({ cabangId: A, kodeNota: 'CTX', pengguna: null }), /sudah aktif/)
  const b = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banA } })
  assert.deepEqual([b.jenis, b.jumlahAwal, b.sisa, b.hargaJual], ['awal', 20, 20, 100_000])
  const r = await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })
  assert.deepEqual([r.price, r.discount], [100_000, 0])
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banNol } })).price, null)
  assert.equal(await m.db.riwayatHarga.count(), 5)
  await invarianBersih()
})

test('penjualan ban, produk, dan jasa: sisa batch, stok baris, dan buku_stok berubah dalam satu transaksi', async () => {
  const bukuAwal = await m.db.bukuStok.count({ where: { tipe: 'jual' } })
  const h = await m.trx.jual(
    adminA,
    input(A, [{ sumber: 'ban', id: banA, jumlah: 2 }, { sumber: 'produk', id: listingA, jumlah: 1 }, { sumber: 'jasa', id: jasa, jumlah: 2 }, { sumber: 'jasa', id: jasa, jumlah: 1, alt: true }], { metode: 'tunai', dibayar: 500_000 }),
  )
  assert.match(h.nomor, /^CTA-\d{6}-0001$/)
  const t = await m.db.transaksi.findUniqueOrThrow({ where: { id: h.id }, include: { detail: true } })
  assert.equal(t.subtotal, 2 * 100_000 + 75_000 + 2 * 25_000 + 90_000)
  assert.equal(t.total, t.subtotal)
  assert.equal(t.kembalian, 500_000 - t.total)
  assert.equal(t.detail.length, 4)
  assert.equal(await stokBan(banA), 18)
  assert.deepEqual(await sisaBatch('ban', banA), [18])
  assert.deepEqual(await sisaBatch('produk', listingA), [9])
  const buku = await m.db.bukuStok.findMany({ where: { tipe: 'jual', refId: `transaksi:${h.id}` }, orderBy: { id: 'asc' } })
  assert.equal(buku.length, 2)
  assert.equal(await m.db.bukuStok.count({ where: { tipe: 'jual' } }), bukuAwal + 2)
  assert.deepEqual(buku.map((x) => [x.perubahan, x.saldoAkhir, x.cabangId]), [[-2, 18, A], [-1, 9, A]])
  assert.ok(buku.every((x) => x.batchId !== null))
  const h2 = await m.trx.jual(adminA, input(A, [{ sumber: 'jasa', id: jasa, jumlah: 1 }]))
  assert.match(h2.nomor, /-0002$/)
  await invarianBersih()
})

test('FIFO lintas batch: contoh ban A dengan batch kedua lebih mahal dan diskon nota', async () => {
  // Sisa B1 sekarang 18. Terjual 16 dulu supaya tinggal 2, lalu owner menambah 100 dengan harga 120.000.
  await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 16 }]))
  await m.stok.koreksiStok({ sumber: 'ban', barisId: banA, setKe: 102, alasan: 'barang datang (uji)', harga: 120_000, pengguna: String(owner.uid) })
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })).price, 100_000) // batch terdepan masih B1
  const h1 = await m.trx.jual(owner, input(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { diskon: 20_000, alasanDiskon: 'diskon event' }))
  const t1 = await m.db.transaksi.findUniqueOrThrow({ where: { id: h1.id }, include: { detail: true } })
  assert.deepEqual([t1.detail[0].hargaSatuan, t1.detail[0].diskon, t1.total], [100_000, 20_000, 80_000])
  assert.equal(await m.db.pengajuanHarga.count({ where: { transaksiId: h1.id } }), 0) // diskon owner tanpa pengajuan
  const h2 = await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 3 }]))
  const d = await m.db.detailTransaksi.findMany({ where: { transaksiId: h2.id }, orderBy: { id: 'asc' } })
  assert.deepEqual(d.map((x) => [x.jumlah, x.hargaSatuan]), [[1, 100_000], [2, 120_000]])
  assert.deepEqual(await sisaBatch('ban', banA), [0, 98])
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })).price, 120_000)
  await invarianBersih()
})

test('diskon admin: dibagi ke baris, membuat pengajuan menunggu, dan batal saat transaksi di-void', async () => {
  const h = await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 1 }, { sumber: 'produk', id: listingA, jumlah: 2 }], { diskon: 10_001, alasanDiskon: 'kenalan pemilik' }))
  const t = await m.db.transaksi.findUniqueOrThrow({ where: { id: h.id }, include: { detail: true } })
  assert.equal(t.detail.reduce((n, x) => n + x.diskon, 0), 10_001)
  assert.equal(t.total, 120_000 + 150_000 - 10_001)
  const p = await m.db.pengajuanHarga.findFirstOrThrow({ where: { transaksiId: h.id } })
  assert.deepEqual([p.tipe, p.status, p.hargaLama, p.hargaBaru], ['diskon', 'menunggu', 270_000, 259_999])
  await m.trx.voidTransaksi(adminA, { transaksiId: h.id, alasan: 'pelanggan batal' })
  assert.equal((await m.db.pengajuanHarga.findUniqueOrThrow({ where: { id: p.id } })).status, 'batal')
  await assert.rejects(m.trx.putuskanPengajuan(owner, { id: p.id, keputusan: 'disetujui' }), /sudah diputuskan/)
  await assert.rejects(async () => m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 1 }], { diskon: 5_000 })), /alasan diskon/)
})

test('kiriman ganda dengan kunci idempotency yang sama hanya menghasilkan satu transaksi', async () => {
  const k = kunci()
  const sebelum = await stokBan(banA)
  const isi = input(A, [{ sumber: 'ban', id: banA, jumlah: 2 }], { kunci: k })
  const hasil = await Promise.all([m.trx.jual(adminA, isi), m.trx.jual(adminA, isi), m.trx.jual(adminA, isi)])
  assert.equal(new Set(hasil.map((h) => h.id)).size, 1)
  assert.equal(hasil.filter((h) => !h.ulang).length, 1)
  const lagi = await m.trx.jual(adminA, isi)
  assert.deepEqual([lagi.id, lagi.ulang], [hasil[0].id, true])
  assert.equal(await m.db.transaksi.count({ where: { idempotencyKey: k } }), 1)
  assert.equal(await stokBan(banA), sebelum - 2)
  await invarianBersih()
})

test('dua penjualan bersamaan untuk unit terakhir: satu berhasil, satu ditolak, saldo tidak negatif', async () => {
  const hasil = await Promise.allSettled([
    m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banTipis, jumlah: 1 }])),
    m.trx.jual(owner, input(A, [{ sumber: 'ban', id: banTipis, jumlah: 1 }])),
  ])
  assert.equal(hasil.filter((h) => h.status === 'fulfilled').length, 1)
  const tolak = hasil.find((h) => h.status === 'rejected') as PromiseRejectedResult
  assert.ok(tolak.reason instanceof m.trx.GalatStokKurang, String(tolak.reason))
  assert.equal(await stokBan(banTipis), 0)
  assert.deepEqual(await sisaBatch('ban', banTipis), [0])
  await invarianBersih()
})

test('jumlah melebihi stok ditolak dan menyebut stok cabang lain', async () => {
  const sebelum = await stokBan(banA)
  await assert.rejects(
    m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: sebelum + 1 }])),
    (e: unknown) => e instanceof m.trx.GalatStokKurang && e.stokLain.some((s) => s.cabang === 'Cabang Contoh B' && s.stok === 7) && e.stokLain.some((s) => s.cabang === 'Cabang Contoh C'),
  )
  assert.equal(await stokBan(banA), sebelum)
})

test('void mengembalikan stok ke batch yang sama dan tidak bisa diulang', async () => {
  const sebelum = await sisaBatch('ban', banA)
  const h = await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 3 }]))
  const batchId = (await m.db.detailTransaksi.findFirstOrThrow({ where: { transaksiId: h.id } })).batchId
  await m.trx.voidTransaksi(adminA, { transaksiId: h.id, alasan: 'salah barang' })
  assert.deepEqual(await sisaBatch('ban', banA), sebelum)
  const buku = await m.db.bukuStok.findMany({ where: { refId: `void:${h.id}` } })
  assert.deepEqual(buku.map((x) => [x.tipe, x.perubahan, x.batchId]), [['void', 3, batchId]])
  const t = await m.db.transaksi.findUniqueOrThrow({ where: { id: h.id } })
  assert.deepEqual([t.status, t.alasanVoid, t.divoidOleh], ['void', 'salah barang', adminA.uid])
  await assert.rejects(m.trx.voidTransaksi(owner, { transaksiId: h.id, alasan: 'ulang' }), /sudah di-void/)
  await assert.rejects(m.trx.voidTransaksi(owner, { transaksiId: (await m.trx.jual(owner, input(A, [{ sumber: 'jasa', id: jasa, jumlah: 1 }]))).id, alasan: '' }), /alasan/)
  await invarianBersih()
})

test('admin tidak bisa bertransaksi atau void untuk cabang lain, dan tidak bisa void transaksi kemarin', async () => {
  await assert.rejects(m.trx.jual(adminB, input(A, [{ sumber: 'jasa', id: jasa, jumlah: 1 }])), /cabang sendiri/)
  const h = await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banA, jumlah: 1 }]))
  await assert.rejects(m.trx.voidTransaksi(adminB, { transaksiId: h.id, alasan: 'coba void' }), /cabang lain/)
  // Barang cabang lain lewat id baris juga ditolak walau cabangnya sendiri yang dikirim.
  const banB = await m.db.stockTire.findFirstOrThrow({ where: { cabangId: B } })
  await assert.rejects(m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banB.id, jumlah: 1 }])), /bukan stok cabang ini/)
  await m.db.transaksi.update({ where: { id: h.id }, data: { waktuTransaksi: new Date(Date.now() - 26 * 3600_000) } })
  await assert.rejects(m.trx.voidTransaksi(adminA, { transaksiId: h.id, alasan: 'terlambat' }), /hari ini/)
  await m.trx.voidTransaksi(owner, { transaksiId: h.id, alasan: 'dibatalkan owner' })
  await invarianBersih()
})

test('barang berharga 0 dan cabang yang masih mode sheet tidak bisa dipakai kasir', async () => {
  await assert.rejects(m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banNol, jumlah: 1 }])), /harga belum diatur/)
  await assert.rejects(m.trx.jual(owner, input(C, [{ sumber: 'ban', id: banC, jumlah: 1 }])), /belum aktif/)
  // Owner mengatur harga batch, lalu barang itu bisa dijual.
  const b = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: banNol } })
  await m.stok.ubahHargaBatch({ batchId: b.id, harga: 300_000, pengguna: String(owner.uid) })
  const r = await m.db.stockTire.findUniqueOrThrow({ where: { id: banNol } })
  assert.deepEqual([r.price, r.priceIssue], [300_000, ''])
  assert.equal((await m.db.riwayatHarga.findFirstOrThrow({ where: { batchId: b.id }, orderBy: { id: 'desc' } })).hargaLama, 0)
  await m.trx.jual(adminA, input(A, [{ sumber: 'ban', id: banNol, jumlah: 1 }]))
  await invarianBersih()
})

test('impor sheet dan ubah stok biasa ditolak untuk cabang mode kasir, cabang mode sheet tetap bisa', async () => {
  const kosong: ParseResult = { rows: [], problems: [], skipped: 0 }
  await assert.rejects(m.applyImport(kosong, 'sheet', null, A), /mode kasir/)
  await assert.rejects(m.ubah.ubahStok({ target: { jenis: 'stok_ban', id: banA }, setKe: 99, tipe: 'koreksi' }), /lewat Kasir/)
  const l = await m.db.listing.findUniqueOrThrow({ where: { id: listingA } })
  // Simpan dari Produk situs: harga dan stok diabaikan, isian lain tersimpan.
  await m.ubah.simpanListing({ productId: l.productId, branchId: A, data: { price: 1, comparePrice: 90_000, available: false, flashSale: false }, stok: 99 })
  const l2 = await m.db.listing.findUniqueOrThrow({ where: { id: listingA } })
  assert.deepEqual([l2.price, l2.stock, l2.comparePrice, l2.available], [l.price, l.stock, 90_000, false])
  // Listing ini sudah punya batch, jadi penjaga hapus (K6) menolaknya lebih dulu daripada penjaga mode kasir.
  await assert.rejects(m.ubah.hapusListing({ productId: l.productId, branchId: A }), /sudah dipakai kasir/)
  await m.ubah.ubahStok({ target: { jenis: 'stok_ban', id: banC }, setKe: 5, tipe: 'koreksi' })
  assert.equal(await stokBan(banC), 5)
  await invarianBersih()
})

test('tetapkan baris tanpa cabang ke cabang mode kasir membentuk batch awal', async () => {
  const r = await m.db.stockTire.create({ data: { ring: 16, sizeRaw: '215/60R16', sizeNorm: '215/60R16', brand: 'Merek Contoh', price: 900_000, discount: 50_000, stock: 2, kode: '215/60R16|merek contoh' } })
  const h = await m.tetapkanTanpaCabang(A, String(owner.uid))
  assert.equal(h.batch, 1)
  const b = await m.db.batchStok.findFirstOrThrow({ where: { sumber: 'ban', barisId: r.id } })
  assert.deepEqual([b.sisa, b.hargaJual], [2, 850_000])
  await invarianBersih()
})

test('peringatan stok menipis: aktif saat turun ke batas, satu saja, ditutup saat stok naik', async () => {
  const stok = (await m.db.listing.findUniqueOrThrow({ where: { id: listingA } })).stock
  await m.stok.aturBatasMinimum({ sumber: 'produk', barisId: listingA, batas: stok - 2 })
  const aktif = () => m.db.peringatanStok.count({ where: { sumber: 'produk', barisId: listingA, status: 'aktif' } })
  assert.equal(await aktif(), 0)
  const h1 = await m.trx.jual(adminA, input(A, [{ sumber: 'produk', id: listingA, jumlah: 2 }]))
  assert.equal(await aktif(), 1)
  assert.equal((await m.db.peringatanStok.findFirstOrThrow({ where: { sumber: 'produk', barisId: listingA, status: 'aktif' } })).jumlahSaatItu, stok - 2)
  await m.trx.jual(adminA, input(A, [{ sumber: 'produk', id: listingA, jumlah: 1 }]))
  assert.equal(await aktif(), 1)
  await m.stok.koreksiStok({ sumber: 'produk', barisId: listingA, setKe: stok + 5, alasan: 'stok datang (uji)', pengguna: String(owner.uid) })
  assert.equal(await aktif(), 0)
  assert.equal(await m.db.peringatanStok.count({ where: { sumber: 'produk', barisId: listingA, status: 'ditutup' } }), 1)
  await m.trx.voidTransaksi(adminA, { transaksiId: h1.id, alasan: 'uji void' })
  await m.stok.aturBatasMinimum({ sumber: 'produk', barisId: listingA, batas: null })
  await invarianBersih()
})

test('invarian tetap benar sesudah urutan acak penjualan, void, dan koreksi', async () => {
  // Pembangkit acak dengan benih tetap supaya hasilnya bisa diulang.
  let benih = 20261120
  const acak = (n: number) => {
    benih = (benih * 1103515245 + 12345) % 2 ** 31
    return benih % n
  }
  const barang = [
    { sumber: 'ban' as const, id: banA },
    { sumber: 'ban' as const, id: banNol },
    { sumber: 'produk' as const, id: listingA },
  ]
  const terjual: number[] = []
  for (let i = 0; i < 60; i++) {
    const pilih = acak(10)
    try {
      if (pilih < 6) {
        const x = barang[acak(barang.length)]
        const h = await m.trx.jual(acak(2) ? adminA : owner, input(A, [{ ...x, jumlah: 1 + acak(4) }], acak(3) === 0 ? { diskon: 1 + acak(5000), alasanDiskon: 'uji acak' } : {}))
        terjual.push(h.id)
      } else if (pilih < 8 && terjual.length) {
        await m.trx.voidTransaksi(owner, { transaksiId: terjual.splice(acak(terjual.length), 1)[0], alasan: 'uji acak' })
      } else {
        const x = barang[acak(barang.length)]
        await m.stok.koreksiStok({ ...{ sumber: x.sumber, barisId: x.id }, setKe: acak(15), alasan: 'uji acak', harga: acak(2) ? 100_000 + acak(5) * 10_000 : null, pengguna: String(owner.uid) })
      }
    } catch (e) {
      if (!(e instanceof m.GalatKasir)) throw e
    }
  }
  await invarianBersih()
  assert.equal(await m.db.batchStok.count({ where: { sisa: { lt: 0 } } }), 0)
  assert.equal(await m.db.stockTire.count({ where: { stock: { lt: 0 } } }), 0)
  // Buku stok seimbang: jumlah perubahan per baris sama dengan stok sekarang dikurangi stok saat dibuat.
  const r = await m.db.stockTire.findUniqueOrThrow({ where: { id: banA } })
  const buku = await m.db.bukuStok.aggregate({ where: { kodeProduk: r.kode!, cabangId: A }, _sum: { perubahan: true } })
  assert.equal(buku._sum.perubahan, r.stock - 20)
})
