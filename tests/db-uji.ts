// Basis data PostgreSQL sementara untuk tes yang menyentuh database.
// Server diambil dari TEST_DATABASE_URL, atau dari DATABASE_URL di .env kalau kosong. Yang dipakai hanya alamat
// server dan akunnya: tiap berkas tes membuat basis data baru bernama acak, memigrasinya, lalu menghapusnya
// sesudah selesai. Basis data dev (nama di DATABASE_URL) tidak pernah dibuka. Cara menjalankan: docs/POSTGRES.md.
import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import pg from 'pg'

export async function siapkanDbUji(awalan: string) {
  const dasar = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!dasar?.startsWith('postgres')) throw new Error('Tes database butuh TEST_DATABASE_URL atau DATABASE_URL berupa alamat PostgreSQL (lihat docs/POSTGRES.md)')
  const nama = `bejoban_uji_${awalan}_${randomBytes(4).toString('hex')}`
  const alamat = (db: string) => {
    const u = new URL(dasar)
    u.pathname = `/${db}`
    return u.toString()
  }
  // Perintah CREATE dan DROP dijalankan dari basis data bawaan "postgres", bukan dari basis data dev.
  const admin = async (sql: string) => {
    const c = new pg.Client({ connectionString: alamat('postgres') })
    await c.connect()
    try {
      await c.query(sql)
    } finally {
      await c.end()
    }
  }
  await admin(`CREATE DATABASE "${nama}"`)
  const url = alamat(nama)
  // Harus diset sebelum modul db diimpor (berkas tes memakai impor dinamis).
  process.env.DATABASE_URL = url
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' })
  return { url, hapus: () => admin(`DROP DATABASE IF EXISTS "${nama}" WITH (FORCE)`) }
}
