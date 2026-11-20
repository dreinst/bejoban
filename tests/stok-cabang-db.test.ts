// Tes database untuk stok ban per cabang. Memakai basis data PostgreSQL sementara sendiri (tests/db-uji.ts), basis data dev tidak tersentuh.
// Semua data di sini karangan (contoh).
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { siapkanDbUji } from './db-uji'
import type { ParsedTire, ParseResult } from '../src/lib/tire/pricelist'

let dbUji: Awaited<ReturnType<typeof siapkanDbUji>> | undefined

type Mod = {
  db: typeof import('../src/lib/db').db
  applyImport: typeof import('../src/lib/tire/import').applyImport
  tetapkanTanpaCabang: typeof import('../src/lib/stok/tetapkan').tetapkanTanpaCabang
  ubahStok: typeof import('../src/lib/stok/ubah').ubahStok
}
let m: Mod
let batu: number
let karanglo: number

before(async () => {
  dbUji = await siapkanDbUji('cabang')
  const [{ db }, { applyImport }, { tetapkanTanpaCabang }, { ubahStok }] = await Promise.all([
    import('../src/lib/db'),
    import('../src/lib/tire/import'),
    import('../src/lib/stok/tetapkan'),
    import('../src/lib/stok/ubah'),
  ])
  m = { db, applyImport, tetapkanTanpaCabang, ubahStok }
  batu = (await db.branch.create({ data: { slug: 'batu', name: 'Cabang Contoh Batu' } })).id
  karanglo = (await db.branch.create({ data: { slug: 'karanglo', name: 'Cabang Contoh Karanglo' } })).id
})

after(async () => {
  await m?.db.$disconnect()
  await dbUji?.hapus()
})

const baris = (kode: string, cabangId: number | null) => ({ sizeRaw: '185/65R15', sizeNorm: '185/65R15', brand: 'Merek Contoh', kode, cabangId })

test('kode unik per cabang, termasuk baris tanpa cabang (indeks parsial)', async () => {
  const kode = '185/65R15|merek contoh unik'
  await m.db.stockTire.create({ data: baris(kode, null) })
  await m.db.stockTire.create({ data: baris(kode, batu) })
  await m.db.stockTire.create({ data: baris(kode, karanglo) })
  // Kode sama di cabang yang sama ditolak.
  await assert.rejects(m.db.stockTire.create({ data: baris(kode, batu) }), /Unique constraint/)
  // Dua baris tanpa cabang dengan kode sama juga ditolak, walau SQLite menganggap NULL berbeda.
  await assert.rejects(m.db.stockTire.create({ data: baris(kode, null) }), /Unique constraint/)
  assert.equal(await m.db.stockTire.count({ where: { kode } }), 3)
  await m.db.stockTire.deleteMany({ where: { kode } })
})

const ban = (sizeNorm: string, brand: string, stock: number, price: number | null = 500000): ParsedTire => ({
  groupName: 'R15 (contoh)',
  ring: 15,
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
const B = ban('195/60R15', 'Merek Contoh B', 2)
const C = ban('205/65R15', 'Merek Contoh C', 6)
const potret = async () => (await m.db.stockTire.findMany({ orderBy: { id: 'asc' } })).map((r) => JSON.stringify(r))

test('impor per cabang tidak menyentuh cabang lain maupun baris tanpa cabang', async () => {
  await m.applyImport(hasil([A, B, C]), 'berkas') // tanpa cabang
  await m.applyImport(hasil([A, B]), 'sheet', null, karanglo)
  const tanpa = (await m.db.stockTire.findMany({ where: { cabangId: null } })).map((r) => JSON.stringify(r))
  const krg = (await m.db.stockTire.findMany({ where: { cabangId: karanglo } })).map((r) => JSON.stringify(r))
  assert.equal(tanpa.length, 3)
  assert.equal(krg.length, 2)

  // Impor ke Batu hanya berisi C: A dan B tidak ada di sumber, tapi baris A dan B milik cabang lain tidak dinonaktifkan.
  const s = await m.applyImport(hasil([{ ...C, stock: 9 }]), 'berkas', null, batu)
  assert.deepEqual([s.created, s.deactivated, s.total, s.cabangId], [1, 0, 1, batu])
  assert.deepEqual((await m.db.stockTire.findMany({ where: { cabangId: null } })).map((r) => JSON.stringify(r)), tanpa)
  assert.deepEqual((await m.db.stockTire.findMany({ where: { cabangId: karanglo } })).map((r) => JSON.stringify(r)), krg)
  const c = await m.db.stockTire.findFirstOrThrow({ where: { cabangId: batu } })
  assert.deepEqual([c.kode, c.stock], ['205/65R15|merek contoh c', 9])

  // Impor ulang Karanglo tanpa B: hanya B Karanglo yang dinonaktifkan.
  const s2 = await m.applyImport(hasil([A]), 'sheet', null, karanglo)
  assert.equal(s2.deactivated, 1)
  const bKrg = await m.db.stockTire.findFirstOrThrow({ where: { kode: '195/60R15|merek contoh b', cabangId: karanglo } })
  const bTanpa = await m.db.stockTire.findFirstOrThrow({ where: { kode: '195/60R15|merek contoh b', cabangId: null } })
  assert.deepEqual([bKrg.aktif, bTanpa.aktif], [false, true])
})

test('buku stok mencatat cabang untuk impor dan koreksi baris bercabang', async () => {
  const impor = await m.db.bukuStok.findFirstOrThrow({ where: { kodeProduk: '205/65R15|merek contoh c', cabangId: batu } })
  assert.deepEqual([impor.tipe, impor.perubahan, impor.saldoAkhir], ['impor', 9, 9])
  const tanpa = await m.db.bukuStok.findFirstOrThrow({ where: { kodeProduk: '205/65R15|merek contoh c', cabangId: null } })
  assert.equal(tanpa.saldoAkhir, 6)
  // Koreksi lewat kode: kode sama ada di beberapa cabang, cabangId menentukan barisnya.
  const h = await m.ubahStok({ target: { jenis: 'stok_ban', kode: '205/65R15|merek contoh c', cabangId: batu }, setKe: 7, tipe: 'koreksi' })
  assert.equal(h.saldoAkhir, 7)
  const k = await m.db.bukuStok.findFirstOrThrow({ orderBy: { id: 'desc' } })
  assert.deepEqual([k.tipe, k.perubahan, k.cabangId], ['koreksi', -2, batu])
  const cTanpa = await m.db.stockTire.findFirstOrThrow({ where: { kode: '205/65R15|merek contoh c', cabangId: null } })
  assert.equal(cTanpa.stock, 6, 'baris tanpa cabang dengan kode sama tidak ikut berubah')
})

test('tetapkan semua baris tanpa cabang: kode yang sudah ada di cabang tujuan dilewati', async () => {
  const sebelumKrg = await potret()
  // Tanpa cabang: A, B, C. Karanglo sudah punya A dan B (B nonaktif), jadi hanya C yang pindah.
  const h = await m.tetapkanTanpaCabang(karanglo, '1')
  assert.deepEqual(h, { dipindah: 1, dilewati: 2 })
  const c = await m.db.stockTire.findFirstOrThrow({ where: { kode: '205/65R15|merek contoh c', cabangId: karanglo } })
  assert.equal(c.stock, 6)
  assert.equal(await m.db.stockTire.count({ where: { cabangId: null } }), 2)
  assert.equal((await potret()).length, sebelumKrg.length, 'tidak ada baris yang dibuat atau dihapus')
  // Buku stok seimbang: keluar dari tanpa cabang, masuk ke Karanglo.
  const buku = await m.db.bukuStok.findMany({ where: { kodeProduk: '205/65R15|merek contoh c', refId: { startsWith: 'tetapkan_cabang:' } }, orderBy: { id: 'asc' } })
  assert.deepEqual(buku.map((b) => [b.cabangId, b.perubahan, b.saldoAkhir]), [[null, -6, 0], [karanglo, 6, 6]])
  // Diulang: tidak ada yang bisa dipindah lagi.
  assert.deepEqual(await m.tetapkanTanpaCabang(karanglo), { dipindah: 0, dilewati: 2 })
  await assert.rejects(m.tetapkanTanpaCabang(999), /Cabang tidak ditemukan/)
})
