// Satu-satunya jalan untuk mengubah stok. Stok dan baris buku_stok ditulis dalam satu transaksi.
// Dua target: baris StockTire (stok ban, cabang_id ikut baris itu, null untuk baris tanpa cabang) dan Listing (produk per cabang).
import type { Prisma } from '@/generated/prisma/client'
import { db } from '../db'
import { bentukKode, kodeKembar } from './kode'
import { GalatStok, hitungSaldo, type PerubahanStok } from './logika'
import { keputusanPeringatan } from '../kasir/logika'

export type Tx = Prisma.TransactionClient

export type TargetStok =
  | { jenis: 'stok_ban'; id: number }
  | { jenis: 'stok_ban'; kode: string; cabangId?: number | null } // kode unik per cabang, null: baris tanpa cabang
  | { jenis: 'listing'; productId: number; branchId: number }

export type UbahStokInput = PerubahanStok & {
  target: TargetStok
  refId?: string | null
  batchId?: number | null
  pengguna?: string | null
  // true hanya dari src/lib/kasir. Baris milik cabang bermode kasir hanya boleh berubah lewat jalur itu,
  // supaya stok baris selalu sama dengan jumlah sisa batch.
  jalurKasir?: boolean
}

export type HasilUbahStok = {
  perubahan: number
  saldoAkhir: number
  dicatat: boolean
  kodeProduk: string
  cabangId: number | null
  peringatan: 'buat' | 'tutup' | 'tetap'
}

export const PESAN_MODE_KASIR = 'Stok cabang ini diatur lewat Kasir. Barang datang dicatat di Kasir, Barang masuk. Selisih hitung lewat Opname.'

// Mode stok cabang (sheet atau kasir). Dibaca sesudah baris stok dikunci, jadi perubahan mode yang sedang berjalan
// sudah selesai saat nilainya dibaca (pengaktifan kasir mengunci baris yang sama).
export async function modeCabangTx(tx: Tx, cabangId: number | null) {
  if (cabangId === null) return 'sheet'
  const [b] = await tx.$queryRaw<{ mode: string }[]>`SELECT "mode_stok" AS "mode" FROM "Branch" WHERE "id" = ${cabangId}`
  return b?.mode ?? 'sheet'
}

// Peringatan stok menipis sesudah stok baris berubah atau batas minimumnya diganti (docs/KASIR.md, bagian peringatan).
export async function cekPeringatanTx(
  tx: Tx,
  p: { sumber: 'ban' | 'produk'; barisId: number; kodeProduk: string; cabangId: number | null; stok: number; batas: number | null },
) {
  const aktif = await tx.peringatanStok.findFirst({ where: { sumber: p.sumber, barisId: p.barisId, status: 'aktif' }, select: { id: true } })
  const k = keputusanPeringatan(p.stok, p.batas, !!aktif)
  if (k === 'buat')
    await tx.peringatanStok.create({ data: { sumber: p.sumber, barisId: p.barisId, kodeProduk: p.kodeProduk, cabangId: p.cabangId, jumlahSaatItu: p.stok, batasMinimum: p.batas! } })
  if (k === 'tutup' && aktif) await tx.peringatanStok.update({ where: { id: aktif.id }, data: { status: 'ditutup', ditutup: new Date() } })
  return k
}

// Kunci proses yang mengubah susunan baris stok ban (impor, tetapkan cabang, isi kode kosong), berlaku sampai
// transaksi selesai. Di SQLite semua penulisan berjalan satu per satu. Di PostgreSQL dua impor bisa berjalan
// bersamaan dan saling bentrok di indeks unik kode, jadi proses ini diantrekan. Kunci ini selalu diambil
// sebelum kunci baris, supaya tidak terjadi saling tunggu.
export const KUNCI_SUSUNAN_STOK = 4207001
export const kunciSusunanStok = (tx: Tx) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${KUNCI_SUSUNAN_STOK})`

// Isi kode StockTire yang masih kosong (urut id). Kode yang sudah ada tidak diubah. Aman diulang.
// Kode unik per cabang, jadi baris dikelompokkan per cabang_id (null juga satu kelompok).
export async function isiKodeKosong(tx: Tx) {
  const cariKosong = () => tx.stockTire.findMany({ where: { kode: null }, orderBy: { id: 'asc' }, select: { id: true, sizeNorm: true, brand: true, cabangId: true } })
  if (!(await cariKosong()).length) return { diisi: 0, kembar: [] as { id: number; kode: string }[] }
  // Ada yang kosong: antre dulu, lalu baca ulang karena transaksi lain mungkin baru saja mengisinya.
  await kunciSusunanStok(tx)
  const kosong = await cariKosong()
  if (!kosong.length) return { diisi: 0, kembar: [] as { id: number; kode: string }[] }
  const kembar: { id: number; kode: string }[] = []
  for (const cabangId of new Set(kosong.map((r) => r.cabangId))) {
    const baris = kosong.filter((r) => r.cabangId === cabangId)
    const ada = await tx.stockTire.findMany({ where: { kode: { not: null }, cabangId }, select: { kode: true } })
    const kode = bentukKode(baris, ada.map((a) => a.kode!))
    for (const [i, r] of baris.entries()) {
      await tx.stockTire.update({ where: { id: r.id }, data: { kode: kode[i] } })
      if (kodeKembar(kode[i])) kembar.push({ id: r.id, kode: kode[i] })
    }
  }
  return { diisi: kosong.length, kembar }
}

// Saldo dibaca dari nilai terbaru di dalam transaksi. Tidak ada perubahan: tidak dicatat.
// Baris stok dikunci (SELECT ... FOR UPDATE) sebelum saldonya dibaca. Dengan isolasi Read Committed di PostgreSQL,
// tanpa kunci ini dua transaksi bisa membaca saldo yang sama dan salah satu perubahan hilang. Transaksi kedua
// menunggu sampai transaksi pertama selesai, lalu membaca saldo yang sudah diperbarui.
export async function ubahStokTx(tx: Tx, p: UbahStokInput): Promise<HasilUbahStok> {
  const t = p.target
  let saldoLama: number
  let kodeProduk: string
  let cabangId: number | null
  let barisId: number
  let batas: number | null
  let simpan: (n: number) => Promise<unknown>
  if (t.jenis === 'stok_ban') {
    const sel = { id: true, stock: true, kode: true, cabangId: true } as const
    const cari = () =>
      'id' in t ? tx.stockTire.findUnique({ where: { id: t.id }, select: sel }) : tx.stockTire.findFirst({ where: { kode: t.kode, cabangId: t.cabangId ?? null }, select: sel })
    let row = await cari()
    if (!row) throw new GalatStok('Baris stok ban tidak ditemukan')
    if (!row.kode) {
      await isiKodeKosong(tx)
      row = (await cari())!
    }
    const id = row.id
    const [kunci] = await tx.$queryRaw<{ stock: number; kode: string | null; cabangId: number | null; batas: number | null }[]>`
      SELECT "stock", "kode", "cabang_id" AS "cabangId", "batas_minimum" AS "batas" FROM "StockTire" WHERE "id" = ${id} FOR UPDATE`
    if (!kunci) throw new GalatStok('Baris stok ban tidak ditemukan')
    saldoLama = kunci.stock
    kodeProduk = kunci.kode ?? row.kode!
    cabangId = kunci.cabangId
    barisId = id
    batas = kunci.batas
    simpan = (n) => tx.stockTire.update({ where: { id }, data: { stock: n } })
  } else {
    const where = { productId_branchId: { productId: t.productId, branchId: t.branchId } }
    const l = await tx.listing.findUnique({ where, select: { id: true, stock: true, product: { select: { kode: true, slug: true } } } })
    if (!l) throw new GalatStok('Produk ini belum terdaftar di cabang tersebut')
    const [kunci] = await tx.$queryRaw<{ stock: number; batas: number | null }[]>`
      SELECT "stock", "batas_minimum" AS "batas" FROM "Listing" WHERE "productId" = ${t.productId} AND "branchId" = ${t.branchId} FOR UPDATE`
    if (!kunci) throw new GalatStok('Produk ini belum terdaftar di cabang tersebut')
    saldoLama = kunci.stock
    kodeProduk = l.product.kode || l.product.slug
    cabangId = t.branchId
    barisId = l.id
    batas = kunci.batas
    simpan = (n) => tx.listing.update({ where, data: { stock: n } })
  }
  const { perubahan, saldoAkhir } = hitungSaldo(saldoLama, p)
  if (perubahan === 0) return { perubahan, saldoAkhir, dicatat: false, kodeProduk, cabangId, peringatan: 'tetap' }
  if (!p.jalurKasir && (await modeCabangTx(tx, cabangId)) === 'kasir') throw new GalatStok(PESAN_MODE_KASIR)
  await simpan(saldoAkhir)
  await tx.bukuStok.create({
    data: { tipe: p.tipe, perubahan, saldoAkhir, refId: p.refId ?? null, batchId: p.batchId ?? null, cabangId, kodeProduk, pengguna: p.pengguna ?? null },
  })
  const peringatan = await cekPeringatanTx(tx, { sumber: t.jenis === 'stok_ban' ? 'ban' : 'produk', barisId, kodeProduk, cabangId, stok: saldoAkhir, batas })
  return { perubahan, saldoAkhir, dicatat: true, kodeProduk, cabangId, peringatan }
}

export const ubahStok = (p: UbahStokInput) => db.$transaction((tx) => ubahStokTx(tx, p))

type DataListing = { price: number; comparePrice: number; available: boolean; flashSale: boolean }

// Simpan harga dan status listing, lalu setel stoknya lewat buku stok (tipe koreksi). Satu transaksi.
// Cabang bermode kasir: harga dan stok diatur lewat kasir, jadi keduanya diabaikan dan hanya harga coret,
// Dijual, dan promo kilat yang disimpan. Listing baru di cabang itu mulai dengan harga 0 dan stok 0.
export function simpanListing(p: { productId: number; branchId: number; data: DataListing; stok: number; pengguna?: string | null; refId?: string | null }) {
  const { productId, branchId } = p
  return db.$transaction(async (tx) => {
    const where = { productId_branchId: { productId, branchId } }
    if ((await modeCabangTx(tx, branchId)) === 'kasir') {
      const { price: _harga, ...lain } = p.data
      void _harga
      await tx.listing.upsert({ where, create: { productId, branchId, ...lain, price: 0 }, update: lain })
      return { perubahan: 0, saldoAkhir: 0, dicatat: false, kodeProduk: '', cabangId: branchId, peringatan: 'tetap' as const }
    }
    await tx.listing.upsert({ where, create: { productId, branchId, ...p.data }, update: p.data })
    return ubahStokTx(tx, { target: { jenis: 'listing', productId, branchId }, setKe: p.stok, tipe: 'koreksi', pengguna: p.pengguna, refId: p.refId })
  })
}

// Baris yang sudah dipakai kasir (punya batch atau baris nota) tidak boleh dihapus: batch, riwayat harga, dan void
// nota lama menunjuk ke baris itu. Stok ban tidak punya jalan hapus (impor hanya menonaktifkan baris yang hilang).
export class GalatDipakaiKasir extends GalatStok {
  constructor(nama: string) {
    super(`${nama} sudah dipakai kasir (punya batch stok atau nota), jadi tidak bisa dihapus. Nonaktifkan saja supaya riwayat dan void nota lamanya tetap jalan.`)
    this.name = 'GalatDipakaiKasir'
  }
}

async function cekBelumDipakaiKasirTx(tx: Tx, listingIds: number[], nama: string) {
  if (!listingIds.length) return
  const [r] = await tx.$queryRaw<{ ada: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM "batch_stok" WHERE "sumber" = 'produk' AND "baris_id" = ANY(${listingIds}))
        OR EXISTS (SELECT 1 FROM "detail_transaksi" WHERE "sumber" = 'produk' AND "baris_id" = ANY(${listingIds})) AS "ada"`
  if (r?.ada) throw new GalatDipakaiKasir(nama)
}

// Hapus listing. Sisa stoknya dicatat keluar (koreksi ke 0) supaya buku stok tetap seimbang.
export function hapusListing(p: { productId: number; branchId: number; pengguna?: string | null; refId?: string | null }) {
  const { productId, branchId } = p
  return db.$transaction(async (tx) => {
    const where = { productId_branchId: { productId, branchId } }
    const l = await tx.listing.findUnique({ where, select: { id: true, product: { select: { name: true } } } })
    if (!l) return false
    await cekBelumDipakaiKasirTx(tx, [l.id], l.product.name)
    await ubahStokTx(tx, { target: { jenis: 'listing', productId, branchId }, setKe: 0, tipe: 'koreksi', pengguna: p.pengguna, refId: p.refId })
    await tx.listing.delete({ where })
    return true
  })
}

// Hapus produk. Listing ikut terhapus (cascade), jadi sisa stok tiap cabang dicatat keluar dulu (koreksi ke 0).
export function hapusProduk(p: { productId: number; pengguna?: string | null }) {
  const { productId } = p
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findMany({ where: { productId }, select: { id: true, branchId: true, product: { select: { name: true } } }, orderBy: { branchId: 'asc' } })
    await cekBelumDipakaiKasirTx(tx, listing.map((l) => l.id), listing[0]?.product.name ?? 'Produk ini')
    for (const l of listing)
      await ubahStokTx(tx, { target: { jenis: 'listing', productId, branchId: l.branchId }, setKe: 0, tipe: 'koreksi', pengguna: p.pengguna, refId: `produk:${productId}` })
    const { count } = await tx.product.deleteMany({ where: { id: productId } })
    return count > 0
  })
}
