// Salin isi berkas SQLite lama ke basis data PostgreSQL yang sudah dimigrasi dan masih kosong.
// Dipakai sekali per tempat (data dev lokal, replika, produksi) saat pindah dari SQLite ke PostgreSQL.
//
//   DATABASE_URL=postgresql://... npx tsx scripts/salin-sqlite-ke-pg.ts data/bejoban.db
//   DATABASE_URL=postgresql://... npx tsx scripts/salin-sqlite-ke-pg.ts data/bejoban.db --periksa-saja
//
// Berkas SQLite dibuka hanya baca. Tabel disalin urut menurut relasi dengan id aslinya dalam satu transaksi,
// lalu tiap sequence disetel ke id terbesar (atau nilai sqlite_sequence kalau lebih besar, supaya id baru sama
// dengan yang akan dipakai SQLite). Sesudahnya isi kedua sisi dibandingkan: jumlah baris, sidik isi tiap tabel,
// dan beberapa jumlah penting. Kalau ada yang beda, skrip keluar dengan kode 1.
// --periksa-saja: hanya membandingkan, tidak menyalin. Rinciannya di docs/POSTGRES.md.
import 'dotenv/config'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'

// Urutan menurut relasi: tabel induk dulu. Tabel tanpa relasi menyusul.
const URUTAN = [
  'Branch', 'Category', 'Brand', 'Product', 'Listing', 'User', 'Setting', 'StockTire', 'ShippingRate',
  'BotProcessed', 'BotLog', 'BotConversation', 'ServicePrice', 'GeoCache', 'BotBranchChoice', 'WaClick',
  'buku_stok', 'log_aktivitas', 'kalender',
]
const INT32 = 2 ** 31

type Kolom = { nama: string; tipe: string }
type Nilai = string | number | boolean | null

const gagal = (pesan: string): never => {
  console.error(`GAGAL: ${pesan}`)
  process.exit(1)
}

// Nilai DateTime dari SQLite: teks ISO dari Prisma ("2026-11-15T17:07:50.618+00:00"), teks CURRENT_TIMESTAMP
// ("2026-11-15 17:07:50", UTC), atau angka milidetik. Hasilnya teks UTC tanpa zona untuk kolom timestamp(3).
// Sengaja teks, bukan objek Date: driver pg mengubah Date ke zona waktu lokal mesin.
function waktu(v: unknown, tempat: string): string {
  let d: Date
  if (typeof v === 'number' || typeof v === 'bigint') d = new Date(Number(v))
  else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v)) d = new Date(`${v.replace(' ', 'T')}Z`)
  else if (typeof v === 'string') d = new Date(v)
  else return gagal(`${tempat}: nilai waktu tidak dikenal (${typeof v})`)
  if (Number.isNaN(d.getTime())) gagal(`${tempat}: waktu tidak terbaca (${String(v)})`)
  return d.toISOString().slice(0, 23)
}

function ubahNilai(v: unknown, k: Kolom, tempat: string): Nilai {
  if (v === null || v === undefined) return null
  switch (k.tipe) {
    case 'boolean':
      if ((typeof v === 'number' || typeof v === 'bigint') && (Number(v) === 0 || Number(v) === 1)) return Number(v) === 1
      return gagal(`${tempat}: boolean bukan 0 atau 1 (${String(v)})`)
    case 'integer': {
      const n = Number(v)
      if (typeof v === 'string' || !Number.isSafeInteger(n)) gagal(`${tempat}: bukan bilangan bulat (${String(v)})`)
      if (n >= INT32 || n < -INT32) gagal(`${tempat}: ${n} tidak muat di integer 32 bit`)
      return n
    }
    case 'double precision':
      if (typeof v !== 'number' && typeof v !== 'bigint') gagal(`${tempat}: bukan angka (${String(v)})`)
      return Number(v)
    case 'text':
      if (typeof v !== 'string') gagal(`${tempat}: bukan teks (${typeof v})`)
      return v as string
    case 'timestamp without time zone':
      return waktu(v, tempat)
    default:
      return gagal(`${tempat}: tipe kolom ${k.tipe} belum ditangani skrip ini`)
  }
}

const q = (nama: string) => `"${nama.replaceAll('"', '""')}"`

async function main() {
  const [berkas, ...opsi] = process.argv.slice(2)
  const periksaSaja = opsi.includes('--periksa-saja')
  if (!berkas) gagal('Sebutkan berkas SQLite, misalnya data/bejoban.db')
  const url = process.env.DATABASE_URL
  if (!url?.startsWith('postgres')) gagal('DATABASE_URL harus alamat PostgreSQL')

  const lite = new DatabaseSync(berkas, { readOnly: true })
  const pgc = new pg.Client({ connectionString: url })
  await pgc.connect()
  try {
    // Kedua sisi harus punya tabel yang sama dengan URUTAN.
    const tabelPg = (await pgc.query<{ t: string }>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`)).rows.map((r) => r.t)
    const tabelLite = (lite.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'`).all() as { name: string }[]).map((r) => r.name)
    for (const [sisi, daftar] of [['PostgreSQL', tabelPg], ['SQLite', tabelLite]] as const) {
      const lebih = daftar.filter((t) => !URUTAN.includes(t))
      const kurang = URUTAN.filter((t) => !daftar.includes(t))
      if (lebih.length || kurang.length) gagal(`tabel ${sisi} tidak sesuai. Lebih: ${lebih.join(', ') || '-'}. Kurang: ${kurang.join(', ') || '-'}`)
    }

    const kolom = new Map<string, Kolom[]>()
    for (const t of URUTAN) {
      const kp = (await pgc.query<{ nama: string; tipe: string }>(`SELECT column_name AS nama, data_type AS tipe FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [t])).rows
      const kl = (lite.prepare(`SELECT name FROM pragma_table_info(?)`).all(t) as { name: string }[]).map((r) => r.name)
      const beda = [...kp.map((k) => k.nama).filter((n) => !kl.includes(n)), ...kl.filter((n) => !kp.some((k) => k.nama === n))]
      if (beda.length) gagal(`kolom tabel ${t} beda antara SQLite dan PostgreSQL: ${beda.join(', ')}`)
      kolom.set(t, kp)
    }

    // Nama sequence kolom id. Tabel berkunci teks (Setting, BotProcessed, dan lainnya) tidak punya.
    const urutanId = async (t: string) =>
      kolom.get(t)!.some((k) => k.nama === 'id' && k.tipe === 'integer')
        ? (await pgc.query<{ s: string | null }>(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [q(t)])).rows[0].s
        : null

    const bacaLite = (t: string) => {
      const ks = kolom.get(t)!
      return (lite.prepare(`SELECT ${ks.map((k) => q(k.nama)).join(', ')} FROM ${q(t)}`).all() as Record<string, unknown>[]).map((r, i) =>
        ks.map((k) => ubahNilai(r[k.nama], k, `${t} baris ${i + 1} kolom ${k.nama}`)),
      )
    }

    if (!periksaSaja) {
      for (const t of URUTAN) {
        const { rows } = await pgc.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${q(t)}`)
        if (rows[0].n) gagal(`tabel ${t} di PostgreSQL sudah berisi ${rows[0].n} baris. Penyalinan hanya ke basis data yang baru dimigrasi.`)
      }
      const seq = new Map((lite.prepare(`SELECT name, seq FROM sqlite_sequence`).all() as { name: string; seq: number }[]).map((r) => [r.name, Number(r.seq)]))
      await pgc.query('BEGIN')
      for (const t of URUTAN) {
        const ks = kolom.get(t)!
        const baris = bacaLite(t)
        for (let i = 0; i < baris.length; i += 200) {
          const potong = baris.slice(i, i + 200)
          const tempat = potong.map((_, j) => `(${ks.map((_, c) => `$${j * ks.length + c + 1}`).join(', ')})`).join(', ')
          await pgc.query(`INSERT INTO ${q(t)} (${ks.map((k) => q(k.nama)).join(', ')}) VALUES ${tempat}`, potong.flat())
        }
        // Sequence kolom id (hanya tabel berid angka).
        const s = await urutanId(t)
        if (s) {
          const maks = (await pgc.query<{ m: number | null }>(`SELECT max("id") AS m FROM ${q(t)}`)).rows[0].m ?? 0
          const nilai = Math.max(maks, seq.get(t) ?? 0)
          if (nilai > 0) await pgc.query(`SELECT setval($1, $2, true)`, [s, nilai])
          else await pgc.query(`SELECT setval($1, 1, false)`, [s])
        }
        console.log(`disalin ${t}: ${baris.length} baris`)
      }
      await pgc.query('COMMIT')
    }

    // Bandingkan. Tiap baris dijadikan teks JSON, diurutkan, lalu di-hash. Waktu dibaca sebagai teks UTC dari
    // PostgreSQL supaya tidak melewati zona waktu mesin.
    let beda = 0
    for (const t of URUTAN) {
      const ks = kolom.get(t)!
      const pilih = ks.map((k) => (k.tipe === 'timestamp without time zone' ? `to_char(${q(k.nama)}, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS ${q(k.nama)}` : q(k.nama))).join(', ')
      const barisPg = (await pgc.query(`SELECT ${pilih} FROM ${q(t)}`)).rows.map((r: Record<string, Nilai>) => JSON.stringify(ks.map((k) => r[k.nama])))
      const barisLite = bacaLite(t).map((r) => JSON.stringify(r))
      const sidik = (a: string[]) => createHash('sha256').update(a.sort().join('\n')).digest('hex').slice(0, 16)
      const [sl, sp] = [sidik(barisLite), sidik(barisPg)]
      const cocok = barisLite.length === barisPg.length && sl === sp
      if (!cocok) beda++
      console.log(`${cocok ? 'sama' : 'BEDA'} ${t}: SQLite ${barisLite.length} baris (${sl}), PostgreSQL ${barisPg.length} baris (${sp})`)
    }

    const jumlah: [string, string][] = [
      ['total stok ban', `SELECT coalesce(sum("stock"), 0) AS n FROM "StockTire"`],
      ['total stok ban aktif', `SELECT coalesce(sum("stock"), 0) AS n FROM "StockTire" WHERE "aktif"`],
      ['total stok listing', `SELECT coalesce(sum("stock"), 0) AS n FROM "Listing"`],
      ['jumlah perubahan buku stok', `SELECT coalesce(sum("perubahan"), 0) AS n FROM "buku_stok"`],
      ['total harga stok ban', `SELECT coalesce(sum("price"), 0) AS n FROM "StockTire"`],
      ['total klik WhatsApp', `SELECT coalesce(sum("count"), 0) AS n FROM "WaClick"`],
    ]
    for (const [nama, sql] of jumlah) {
      const a = Number((lite.prepare(sql.replace(`WHERE "aktif"`, `WHERE "aktif" = 1`)).get() as { n: number }).n)
      const b = Number((await pgc.query<{ n: string }>(sql)).rows[0].n)
      if (a !== b) beda++
      console.log(`${a === b ? 'sama' : 'BEDA'} ${nama}: SQLite ${a}, PostgreSQL ${b}`)
    }

    // Id baru harus melanjutkan id lama.
    for (const t of URUTAN) {
      const s = await urutanId(t)
      if (!s) continue
      const r = (await pgc.query<{ last_value: string; is_called: boolean }>(`SELECT last_value, is_called FROM ${s}`)).rows[0]
      const maks = (await pgc.query<{ m: number | null }>(`SELECT max("id") AS m FROM ${q(t)}`)).rows[0].m ?? 0
      const lanjut = r.is_called ? Number(r.last_value) + 1 : Number(r.last_value)
      if (lanjut <= maks) {
        beda++
        console.log(`BEDA sequence ${t}: id berikutnya ${lanjut}, padahal id terbesar ${maks}`)
      }
    }

    if (beda) gagal(`${beda} perbandingan tidak cocok`)
    console.log('Semua perbandingan cocok.')
  } catch (e) {
    await pgc.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    await pgc.end()
    lite.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
