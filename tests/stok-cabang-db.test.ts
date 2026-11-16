// Tes database untuk stok ban per cabang. Memakai file SQLite sementara sendiri, data/bejoban.db tidak tersentuh.
// Semua data di sini karangan (contoh).
import test, { after, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'bejoban-uji-cabang-'))
// Harus diset sebelum modul db diimpor (impor dinamis di bawah).
process.env.DATABASE_URL = `file:${join(dir, 'uji.db')}`

type Mod = {
  db: typeof import('../src/lib/db').db
}
let m: Mod
let batu: number
let karanglo: number

before(async () => {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' })
  const [{ db }] = await Promise.all([import('../src/lib/db')])
  m = { db }
  batu = (await db.branch.create({ data: { slug: 'batu', name: 'Cabang Contoh Batu' } })).id
  karanglo = (await db.branch.create({ data: { slug: 'karanglo', name: 'Cabang Contoh Karanglo' } })).id
})

after(async () => {
  await m?.db.$disconnect()
  rmSync(dir, { recursive: true, force: true })
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
