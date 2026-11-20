// Analitik kasir untuk owner: dashboard, rekap bulanan, dan ekspor CSV untuk tim data. Aturan: docs/KASIR.md.
// - Hari dan minggu dihitung dalam WIB (UTC+7, tanpa musim panas). Minggu dimulai Senin.
// - Transaksi void tidak ikut dihitung. Diskon dibaca dari detail_transaksi.diskon, jadi nilai per barang sudah bersih.
// - Kolom waktu disimpan sebagai timestamp UTC tanpa zona. Batas rentang dikirim sebagai teks ISO lalu diubah ke UTC
//   di SQL, supaya hasilnya tidak bergantung pada zona sesi basis data.
// - Alias kolom selalu dikutip ("cabangId"), karena PostgreSQL mengecilkan huruf alias tanpa kutip.
import { Prisma } from '@/generated/prisma/client'
import { db } from '../db'
import { namaPendek } from '../tire/cabang'
import { isoWib, keCsv, leadTimeHari } from './logika'

export type Rentang = { mulai: Date; akhir: Date }

const ts = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`
const filterCabang = (cabangId: number | null, kolom: Prisma.Sql) => (cabangId === null ? Prisma.empty : Prisma.sql`AND ${kolom} = ${cabangId}`)
const hariWib = (kolom: Prisma.Sql) => Prisma.sql`to_char(${kolom} + interval '7 hours', 'YYYY-MM-DD')`
const mingguWib = (kolom: Prisma.Sql) => Prisma.sql`to_char(date_trunc('week', ${kolom} + interval '7 hours'), 'YYYY-MM-DD')`
const n = (v: bigint | number | null) => Number(v ?? 0)

/* ---------- Dashboard ---------- */

export type PenjualanPeriode = { cabangId: number; periode: string; transaksi: number; kotor: number; diskon: number; bersih: number }

// Penjualan per cabang per hari atau per minggu (WIB) dalam rentang [mulai, akhir).
export async function penjualanPerPeriode(r: Rentang, kelompok: 'hari' | 'minggu', cabangId: number | null = null): Promise<PenjualanPeriode[]> {
  const kol = Prisma.sql`t."waktu_transaksi"`
  const periode = kelompok === 'hari' ? hariWib(kol) : mingguWib(kol)
  const rows = await db.$queryRaw<{ cabangId: number; periode: string; transaksi: bigint; kotor: bigint; diskon: bigint }[]>`
    SELECT t."cabang_id" AS "cabangId", ${periode} AS "periode", COUNT(DISTINCT t."id") AS "transaksi",
           SUM(d."subtotal") AS "kotor", SUM(d."diskon") AS "diskon"
    FROM "transaksi" t JOIN "detail_transaksi" d ON d."transaksi_id" = t."id"
    WHERE t."status" = 'selesai' AND t."waktu_transaksi" >= ${ts(r.mulai)} AND t."waktu_transaksi" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`t."cabang_id"`)}
    GROUP BY 1, 2 ORDER BY 2, 1`
  return rows.map((x) => ({ cabangId: x.cabangId, periode: x.periode, transaksi: n(x.transaksi), kotor: n(x.kotor), diskon: n(x.diskon), bersih: n(x.kotor) - n(x.diskon) }))
}

export type PenjualanSumber = { sumber: string; jumlah: number; kotor: number; diskon: number; bersih: number }

// Ban, jasa, dan produk situs: jumlah unit dan nilai sesudah diskon.
export async function penjualanPerSumber(r: Rentang, cabangId: number | null = null): Promise<PenjualanSumber[]> {
  const rows = await db.$queryRaw<{ sumber: string; jumlah: bigint; kotor: bigint; diskon: bigint }[]>`
    SELECT d."sumber" AS "sumber", SUM(d."jumlah") AS "jumlah", SUM(d."subtotal") AS "kotor", SUM(d."diskon") AS "diskon"
    FROM "transaksi" t JOIN "detail_transaksi" d ON d."transaksi_id" = t."id"
    WHERE t."status" = 'selesai' AND t."waktu_transaksi" >= ${ts(r.mulai)} AND t."waktu_transaksi" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`t."cabang_id"`)}
    GROUP BY 1`
  return rows.map((x) => ({ sumber: x.sumber, jumlah: n(x.jumlah), kotor: n(x.kotor), diskon: n(x.diskon), bersih: n(x.kotor) - n(x.diskon) }))
}

export type Terlaris = { sumber: string; kodeProduk: string; nama: string; jumlah: number; bersih: number }

// Barang dan jasa paling banyak terjual (unit), lalu nilai bersih.
export async function terlaris(r: Rentang, cabangId: number | null = null, batas = 10): Promise<Terlaris[]> {
  const rows = await db.$queryRaw<{ sumber: string; kodeProduk: string; nama: string; jumlah: bigint; bersih: bigint }[]>`
    SELECT d."sumber" AS "sumber", d."kode_produk" AS "kodeProduk", MAX(d."nama") AS "nama",
           SUM(d."jumlah") AS "jumlah", SUM(d."subtotal" - d."diskon") AS "bersih"
    FROM "transaksi" t JOIN "detail_transaksi" d ON d."transaksi_id" = t."id"
    WHERE t."status" = 'selesai' AND t."waktu_transaksi" >= ${ts(r.mulai)} AND t."waktu_transaksi" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`t."cabang_id"`)}
    GROUP BY 1, 2 ORDER BY 4 DESC, 5 DESC, 2 LIMIT ${batas}`
  return rows.map((x) => ({ sumber: x.sumber, kodeProduk: x.kodeProduk, nama: x.nama, jumlah: n(x.jumlah), bersih: n(x.bersih) }))
}

/* ---------- Rekap bulanan ---------- */

export type BarisRekap = { cabangId: number; sumber: 'ban' | 'produk'; barisId: number; kode: string; nama: string; masuk: number; terjual: number; nilaiTerjual: number; penyesuaian: number; stokSekarang: number | null }

// Barang masuk dan keluar per barang dan cabang untuk satu bulan WIB.
// masuk: jumlah barang masuk menurut tanggal terima. terjual: unit dari transaksi selesai (void tidak dihitung).
// penyesuaian: jumlah perubahan opname dan koreksi owner (bisa minus). Jasa tidak punya stok, jadi tidak ikut.
export async function rekapBulanan(r: Rentang, cabangId: number | null = null): Promise<BarisRekap[]> {
  const [masuk, jual, sesuai] = await Promise.all([
    db.$queryRaw<{ cabangId: number; sumber: string; barisId: number; kode: string; nama: string; jumlah: bigint }[]>`
      SELECT d."cabang_id" AS "cabangId", d."sumber" AS "sumber", d."baris_id" AS "barisId", MAX(d."kode_produk") AS "kode", MAX(d."nama") AS "nama", SUM(d."jumlah") AS "jumlah"
      FROM "detail_barang_masuk" d JOIN "barang_masuk" b ON b."id" = d."barang_masuk_id"
      WHERE b."tanggal_terima" >= ${ts(r.mulai)} AND b."tanggal_terima" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`d."cabang_id"`)}
      GROUP BY 1, 2, 3`,
    db.$queryRaw<{ cabangId: number; sumber: string; barisId: number; kode: string; nama: string; jumlah: bigint; bersih: bigint }[]>`
      SELECT t."cabang_id" AS "cabangId", d."sumber" AS "sumber", d."baris_id" AS "barisId", MAX(d."kode_produk") AS "kode", MAX(d."nama") AS "nama",
             SUM(d."jumlah") AS "jumlah", SUM(d."subtotal" - d."diskon") AS "bersih"
      FROM "transaksi" t JOIN "detail_transaksi" d ON d."transaksi_id" = t."id"
      WHERE t."status" = 'selesai' AND d."sumber" <> 'jasa' AND d."baris_id" IS NOT NULL
        AND t."waktu_transaksi" >= ${ts(r.mulai)} AND t."waktu_transaksi" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`t."cabang_id"`)}
      GROUP BY 1, 2, 3`,
    db.$queryRaw<{ cabangId: number; sumber: string; barisId: number; kode: string; jumlah: bigint }[]>`
      SELECT bt."cabang_id" AS "cabangId", bt."sumber" AS "sumber", bt."baris_id" AS "barisId", MAX(bt."kode_produk") AS "kode", SUM(bs."perubahan") AS "jumlah"
      FROM "buku_stok" bs JOIN "batch_stok" bt ON bt."id" = bs."batch_id"
      WHERE bs."tipe" IN ('opname', 'koreksi') AND bs."waktu" >= ${ts(r.mulai)} AND bs."waktu" < ${ts(r.akhir)} ${filterCabang(cabangId, Prisma.sql`bt."cabang_id"`)}
      GROUP BY 1, 2, 3`,
  ])
  const peta = new Map<string, BarisRekap>()
  const ambil = (x: { cabangId: number; sumber: string; barisId: number; kode: string; nama?: string }) => {
    const k = `${x.sumber}:${x.barisId}`
    let b = peta.get(k)
    if (!b) {
      b = { cabangId: x.cabangId, sumber: x.sumber as 'ban' | 'produk', barisId: x.barisId, kode: x.kode, nama: x.nama ?? x.kode, masuk: 0, terjual: 0, nilaiTerjual: 0, penyesuaian: 0, stokSekarang: null }
      peta.set(k, b)
    }
    return b
  }
  for (const x of masuk) ambil(x).masuk += n(x.jumlah)
  for (const x of jual) {
    const b = ambil(x)
    b.terjual += n(x.jumlah)
    b.nilaiTerjual += n(x.bersih)
  }
  for (const x of sesuai) ambil(x).penyesuaian += n(x.jumlah)
  // Nama dan stok sekarang dari baris stok (nama di detail adalah salinan saat dicatat).
  const semua = [...peta.values()]
  const idBan = semua.filter((b) => b.sumber === 'ban').map((b) => b.barisId)
  const idProduk = semua.filter((b) => b.sumber === 'produk').map((b) => b.barisId)
  const [ban, listing] = await Promise.all([
    idBan.length ? db.stockTire.findMany({ where: { id: { in: idBan } }, select: { id: true, sizeRaw: true, brand: true, stock: true } }) : [],
    idProduk.length ? db.listing.findMany({ where: { id: { in: idProduk } }, select: { id: true, stock: true, product: { select: { name: true } } } }) : [],
  ])
  for (const b of semua) {
    const s = b.sumber === 'ban' ? ban.find((x) => x.id === b.barisId) : undefined
    const l = b.sumber === 'produk' ? listing.find((x) => x.id === b.barisId) : undefined
    if (s) Object.assign(b, { nama: `${s.sizeRaw} ${s.brand}`.trim(), stokSekarang: s.stock })
    if (l) Object.assign(b, { nama: l.product.name, stokSekarang: l.stock })
  }
  return semua.toSorted((a, b) => a.cabangId - b.cabangId || a.sumber.localeCompare(b.sumber) || a.nama.localeCompare(b.nama, 'id') || a.barisId - b.barisId)
}

/* ---------- Ekspor CSV untuk tim data ---------- */

export const JENIS_EKSPOR = ['penjualan', 'stok-habis', 'barang-masuk'] as const
export type JenisEkspor = (typeof JENIS_EKSPOR)[number]
export const isJenisEkspor = (v: unknown): v is JenisEkspor => typeof v === 'string' && (JENIS_EKSPOR as readonly string[]).includes(v)

// Kolom tiap berkas. Artinya ditulis di docs/KASIR.md, bagian ekspor CSV.
export const KOLOM_EKSPOR: Record<JenisEkspor, readonly string[]> = {
  penjualan: ['minggu_mulai', 'cabang_id', 'cabang', 'sumber', 'kode_produk', 'nama', 'channel', 'jumlah', 'transaksi', 'nilai_harga_asli', 'diskon', 'nilai_bersih', 'harga_asli_rata', 'harga_efektif_rata', 'sempat_habis'],
  'stok-habis': ['waktu_wib', 'minggu_mulai', 'cabang_id', 'cabang', 'kode_produk', 'kejadian', 'tipe', 'perubahan', 'saldo_akhir'],
  'barang-masuk': ['nomor_penerimaan', 'cabang_id', 'cabang', 'pemasok', 'jenis_pemasok', 'tanggal_pesan', 'tanggal_terima', 'lead_time_hari', 'sumber', 'kode_produk', 'nama', 'jumlah', 'harga_beli', 'harga_jual_usulan', 'harga_lama', 'harga_batch', 'status_harga'],
}

const waktuIso = (d: Date) => {
  const w = new Date(d.getTime() + 7 * 3600_000).toISOString()
  return `${w.slice(0, 10)} ${w.slice(11, 16)}`
}
const bagi = (a: number, b: number) => (b ? Math.round(a / b) : 0)

type Kejadian = { waktu: Date; minggu: string; cabangId: number | null; kodeProduk: string; tipe: string; perubahan: number; saldoAkhir: number }

// Kejadian stok habis dan tersedia lagi dari buku_stok: saldo turun ke 0 (habis) atau naik dari 0 (tersedia).
async function kejadianStok(r: Rentang): Promise<(Kejadian & { kejadian: 'habis' | 'tersedia' })[]> {
  const rows = await db.$queryRaw<{ waktu: Date; minggu: string; cabangId: number | null; kodeProduk: string; tipe: string; perubahan: number; saldoAkhir: number }[]>`
    SELECT bs."waktu" AS "waktu", ${mingguWib(Prisma.sql`bs."waktu"`)} AS "minggu", bs."cabang_id" AS "cabangId", bs."kode_produk" AS "kodeProduk",
           bs."tipe" AS "tipe", bs."perubahan" AS "perubahan", bs."saldo_akhir" AS "saldoAkhir"
    FROM "buku_stok" bs
    WHERE bs."waktu" >= ${ts(r.mulai)} AND bs."waktu" < ${ts(r.akhir)} AND bs."perubahan" <> 0
      AND ((bs."saldo_akhir" <= 0 AND bs."saldo_akhir" - bs."perubahan" > 0) OR (bs."saldo_akhir" > 0 AND bs."saldo_akhir" - bs."perubahan" <= 0))
    ORDER BY bs."waktu", bs."id"`
  return rows.map((x) => ({ ...x, kejadian: x.saldoAkhir <= 0 ? 'habis' : 'tersedia' }))
}

// Isi satu berkas CSV untuk rentang [mulai, akhir).
export async function isiEkspor(jenis: JenisEkspor, r: Rentang): Promise<string> {
  const cabang = await db.branch.findMany({ select: { id: true, name: true } })
  const nama = (id: number | null) => (id === null ? '' : namaPendek(cabang.find((c) => c.id === id)?.name ?? `Cabang ${id}`))
  const kolom = KOLOM_EKSPOR[jenis]

  if (jenis === 'penjualan') {
    const [rows, kejadian] = await Promise.all([
      db.$queryRaw<{ minggu: string; cabangId: number; sumber: string; kodeProduk: string; nama: string; channel: string; jumlah: bigint; transaksi: bigint; kotor: bigint; diskon: bigint }[]>`
        SELECT ${mingguWib(Prisma.sql`t."waktu_transaksi"`)} AS "minggu", t."cabang_id" AS "cabangId", d."sumber" AS "sumber", d."kode_produk" AS "kodeProduk",
               MAX(d."nama") AS "nama", t."channel" AS "channel", SUM(d."jumlah") AS "jumlah", COUNT(DISTINCT t."id") AS "transaksi",
               SUM(d."subtotal") AS "kotor", SUM(d."diskon") AS "diskon"
        FROM "transaksi" t JOIN "detail_transaksi" d ON d."transaksi_id" = t."id"
        WHERE t."status" = 'selesai' AND t."waktu_transaksi" >= ${ts(r.mulai)} AND t."waktu_transaksi" < ${ts(r.akhir)}
        GROUP BY 1, 2, 3, 4, 6 ORDER BY 1, 2, 3, 4, 6`,
      kejadianStok(r),
    ])
    const habis = new Set(kejadian.filter((k) => k.kejadian === 'habis').map((k) => `${k.minggu}|${k.cabangId}|${k.kodeProduk}`))
    return keCsv(
      kolom,
      rows.map((x) => {
        const jumlah = n(x.jumlah)
        const kotor = n(x.kotor)
        const bersih = kotor - n(x.diskon)
        const tandai = x.sumber === 'jasa' ? '' : habis.has(`${x.minggu}|${x.cabangId}|${x.kodeProduk}`) ? 1 : 0
        return [x.minggu, x.cabangId, nama(x.cabangId), x.sumber, x.kodeProduk, x.nama, x.channel, jumlah, n(x.transaksi), kotor, n(x.diskon), bersih, bagi(kotor, jumlah), bagi(bersih, jumlah), tandai]
      }),
    )
  }

  if (jenis === 'stok-habis') {
    const rows = await kejadianStok(r)
    return keCsv(kolom, rows.map((x) => [waktuIso(x.waktu), x.minggu, x.cabangId, nama(x.cabangId), x.kodeProduk, x.kejadian, x.tipe, x.perubahan, x.saldoAkhir]))
  }

  const rows = await db.detailBarangMasuk.findMany({
    where: { barangMasuk: { tanggalTerima: { gte: r.mulai, lt: r.akhir } } },
    include: { barangMasuk: true },
    orderBy: [{ barangMasuk: { tanggalTerima: 'asc' } }, { barangMasukId: 'asc' }, { id: 'asc' }],
  })
  const [batch, pengajuan] = await Promise.all([
    db.batchStok.findMany({ where: { id: { in: rows.map((x) => x.batchId).filter((x): x is number => x !== null) } }, select: { id: true, hargaJual: true } }),
    db.pengajuanHarga.findMany({ where: { id: { in: rows.map((x) => x.pengajuanHargaId).filter((x): x is number => x !== null) } }, select: { id: true, status: true } }),
  ])
  return keCsv(
    kolom,
    rows.map((x) => {
      const b = x.barangMasuk
      const status = x.pengajuanHargaId === null ? (x.hargaJual === x.hargaLama ? 'tetap' : 'langsung') : (pengajuan.find((p) => p.id === x.pengajuanHargaId)?.status ?? '')
      return [
        b.nomorPenerimaan,
        b.cabangId,
        nama(b.cabangId),
        b.pemasok,
        b.jenisPemasok,
        b.tanggalPesan ? isoWib(b.tanggalPesan) : null,
        isoWib(b.tanggalTerima),
        leadTimeHari(b.tanggalPesan, b.tanggalTerima),
        x.sumber,
        x.kodeProduk,
        x.nama,
        x.jumlah,
        x.hargaBeli,
        x.hargaJual,
        x.hargaLama,
        batch.find((y) => y.id === x.batchId)?.hargaJual ?? null,
        status,
      ]
    }),
  )
}
