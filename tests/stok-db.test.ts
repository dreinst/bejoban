// Tes yang menyentuh database: impor upsert stok ban dan fungsi ubah stok.
// Memakai file SQLite sementara sendiri, jadi data/bejoban.db tidak tersentuh. Semua data di sini karangan (contoh).
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ParsedTire, ParseResult } from '../src/lib/tire/pricelist'

const dir = mkdtempSync(join(tmpdir(), 'bejoban-uji-stok-'))
// Harus diset sebelum modul db diimpor (impor dinamis di bawah).
process.env.DATABASE_URL = `file:${join(dir, 'uji.db')}`

type Mod = {
  db: typeof import('../src/lib/db').db
  applyImport: typeof import('../src/lib/tire/import').applyImport
  ubahStok: typeof import('../src/lib/stok/ubah').ubahStok
  simpanListing: typeof import('../src/lib/stok/ubah').simpanListing
  hapusProduk: typeof import('../src/lib/stok/ubah').hapusProduk
  GalatStok: typeof import('../src/lib/stok/logika').GalatStok
}
let m: Mod

before(async () => {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' })
  const [{ db }, { applyImport }, ubah, { GalatStok }] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/tire/import'),
    import('../src/lib/stok/ubah'),
    import('../src/lib/stok/logika'),
  ])
  m = { db, applyImport, ubahStok: ubah.ubahStok, simpanListing: ubah.simpanListing, hapusProduk: ubah.hapusProduk, GalatStok }
})

after(async () => {
  await m?.db.$disconnect()
  rmSync(dir, { recursive: true, force: true })
})

const ban = (sizeNorm: string, brand: string, stock: number, price: number | null = 500000): ParsedTire => ({
  groupName: 'R15 (contoh)',
  ring: Number(sizeNorm.match(/R(\d+)/)?.[1] ?? 0),
  sizeRaw: sizeNorm,
  sizeNorm,
  brand,
  price,
  discount: 0,
  priceIssue: price === null ? 'kosong' : '',
  stock,
  note: '',
})
const hasil = (rows: ParsedTire[]): ParseResult => ({ rows, problems: [], skipped: 0 })

const A = ban('185/65R15', 'Merek Contoh A', 4)
const B1 = ban('195/60R15', 'Merek Contoh B', 2)
const B2 = ban('195/60R15', 'merek  contoh b', 0) // kembar dengan B1 setelah dinormalkan
const C = ban('205/65R15', 'Merek Contoh C', 6)

const semua = () => m.db.stockTire.findMany({ orderBy: { id: 'asc' } })
const jumlahBuku = () => m.db.bukuStok.count()

test('impor upsert: id tetap, baris hilang nonaktif lalu aktif lagi, buku stok hanya saat stok berubah', async () => {
  const s1 = await m.applyImport(hasil([A, B1, B2, C]), 'berkas')
  assert.equal(s1.created, 4)
  const awal = await semua()
  assert.deepEqual(
    awal.map((r) => r.kode),
    ['185/65R15|merek contoh a', '195/60R15|merek contoh b', '195/60R15|merek contoh b#2', '205/65R15|merek contoh c'],
  )
  // Baris baru dicatat sebagai selisih dari 0, stok 0 tidak dicatat.
  assert.equal(await jumlahBuku(), 3)
  const bukuA = await m.db.bukuStok.findFirst({ where: { kodeProduk: '185/65R15|merek contoh a' } })
  assert.deepEqual([bukuA?.tipe, bukuA?.perubahan, bukuA?.saldoAkhir, bukuA?.cabangId], ['impor', 4, 4, null])

  // Impor ulang data yang sama: id sama, tidak ada baris buku stok baru.
  const s2 = await m.applyImport(hasil([A, B1, B2, C]), 'berkas')
  assert.deepEqual([s2.created, s2.updated, s2.stockChanges, s2.deactivated], [0, 0, 0, 0])
  assert.deepEqual((await semua()).map((r) => r.id), awal.map((r) => r.id))
  assert.equal(await jumlahBuku(), 3)

  // C hilang dari sumber: dinonaktifkan, tidak dihapus. Stok A berubah: satu baris buku stok.
  const s3 = await m.applyImport(hasil([{ ...A, stock: 1 }, B1, B2]), 'sheet')
  assert.deepEqual([s3.deactivated, s3.stockChanges, s3.total], [1, 1, 3])
  const c = await m.db.stockTire.findFirst({ where: { kode: '205/65R15|merek contoh c' } })
  assert.equal(c?.aktif, false)
  assert.equal(c?.stock, 6, 'stok baris nonaktif tidak diubah')
  const bukuA2 = await m.db.bukuStok.findFirst({ where: { kodeProduk: '185/65R15|merek contoh a' }, orderBy: { id: 'desc' } })
  assert.deepEqual([bukuA2?.perubahan, bukuA2?.saldoAkhir], [-3, 1])
  assert.equal(await jumlahBuku(), 4)

  // C muncul lagi: aktif kembali dengan id yang sama.
  const s4 = await m.applyImport(hasil([{ ...A, stock: 1 }, B1, B2, C]), 'sheet')
  assert.deepEqual([s4.reactivated, s4.created, s4.stockChanges], [1, 0, 0])
  const c2 = await m.db.stockTire.findFirst({ where: { kode: '205/65R15|merek contoh c' } })
  assert.deepEqual([c2?.id, c2?.aktif], [c?.id, true])
  assert.deepEqual((await semua()).map((r) => r.id), awal.map((r) => r.id))
})

test('impor upsert: baris manual terkunci tidak ditimpa, yang tidak dikunci ditimpa', async () => {
  const a = await m.db.stockTire.findFirstOrThrow({ where: { kode: '185/65R15|merek contoh a' } })
  const b = await m.db.stockTire.findFirstOrThrow({ where: { kode: '195/60R15|merek contoh b' } })
  await m.db.stockTire.update({ where: { id: a.id }, data: { price: 123000, stock: 9, manual: true, lockManual: true, manualAt: new Date() } })
  await m.db.stockTire.update({ where: { id: b.id }, data: { price: 111000, manual: true, lockManual: false, manualAt: new Date() } })
  const sebelum = await jumlahBuku()

  const s = await m.applyImport(hasil([{ ...A, stock: 2 }, B1, B2, C]), 'berkas')
  assert.deepEqual([s.manualKept, s.manualOverwritten], [1, 1])
  const a2 = await m.db.stockTire.findUniqueOrThrow({ where: { id: a.id } })
  assert.deepEqual([a2.price, a2.stock, a2.manual, a2.lockManual], [123000, 9, true, true])
  const b2 = await m.db.stockTire.findUniqueOrThrow({ where: { id: b.id } })
  assert.deepEqual([b2.price, b2.manual], [500000, false])
  assert.equal(await jumlahBuku(), sebelum, 'stok baris terkunci tidak berubah, jadi tidak dicatat')

  // Baris manual terkunci yang hilang dari sumber tetap aktif.
  const s2 = await m.applyImport(hasil([B1, B2, C]), 'berkas')
  assert.equal(s2.manualOrphans, 1)
  assert.equal((await m.db.stockTire.findUniqueOrThrow({ where: { id: a.id } })).aktif, true)
})

test('impor pertama sesudah migrasi mengisi kode kosong dan id tetap', async () => {
  const awal = await semua()
  await m.db.stockTire.updateMany({ data: { kode: null } })
  const s = await m.applyImport(hasil([A, B1, B2, C]), 'berkas')
  assert.equal(s.codesFilled, awal.length)
  assert.equal(s.created, 0)
  const akhir = await semua()
  assert.deepEqual(akhir.map((r) => [r.id, r.kode]), awal.map((r) => [r.id, r.kode]))
})

test('ubah stok: tolak negatif dan transaksi dibatalkan utuh', async () => {
  const branch = await m.db.branch.create({ data: { slug: 'cabang-contoh', name: 'Cabang Contoh' } })
  const product = await m.db.product.create({ data: { slug: 'produk-contoh', name: 'Produk Contoh', isSample: true } })
  const data = { price: 100000, comparePrice: 0, available: true, flashSale: false }
  const h = await m.simpanListing({ productId: product.id, branchId: branch.id, data, stok: 5, pengguna: '1' })
  assert.deepEqual([h.perubahan, h.saldoAkhir, h.dicatat, h.kodeProduk], [5, 5, true, 'produk-contoh'])
  const sebelum = await jumlahBuku()

  await assert.rejects(m.ubahStok({ target: { jenis: 'listing', productId: product.id, branchId: branch.id }, delta: -6, tipe: 'jual' }), m.GalatStok)
  const l = await m.db.listing.findUniqueOrThrow({ where: { productId_branchId: { productId: product.id, branchId: branch.id } } })
  assert.equal(l.stock, 5)
  assert.equal(await jumlahBuku(), sebelum)

  const k = await m.ubahStok({ target: { jenis: 'listing', productId: product.id, branchId: branch.id }, delta: -6, tipe: 'koreksi', izinkanNegatif: true })
  assert.equal(k.saldoAkhir, -1)
  const buku = await m.db.bukuStok.findFirstOrThrow({ orderBy: { id: 'desc' } })
  assert.deepEqual([buku.tipe, buku.perubahan, buku.saldoAkhir, buku.cabangId], ['koreksi', -6, -1, branch.id])

  // Hapus produk: sisa stok dicatat keluar sebelum listing ikut terhapus.
  assert.equal(await m.hapusProduk({ productId: product.id }), true)
  const keluar = await m.db.bukuStok.findFirstOrThrow({ orderBy: { id: 'desc' } })
  assert.deepEqual([keluar.perubahan, keluar.saldoAkhir], [1, 0])
  assert.equal(await m.db.listing.count({ where: { productId: product.id } }), 0)
})

test('ubah stok ban: tipe tidak dikenal ditolak', async () => {
  const a = await m.db.stockTire.findFirstOrThrow()
  await assert.rejects(m.ubahStok({ target: { jenis: 'stok_ban', id: a.id }, setKe: 3, tipe: 'hilang' }), /Tipe buku stok tidak dikenal/)
})
