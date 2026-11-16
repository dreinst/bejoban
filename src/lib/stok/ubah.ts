// Satu-satunya jalan untuk mengubah stok. Stok dan baris buku_stok ditulis dalam satu transaksi.
// Dua target: baris StockTire (stok ban global, cabang_id null) dan Listing (produk per cabang).
import type { Prisma } from '@/generated/prisma/client'
import { db } from '../db'
import { bentukKode, kodeKembar } from './kode'
import { GalatStok, hitungSaldo, type PerubahanStok } from './logika'

export type Tx = Prisma.TransactionClient

export type TargetStok =
  | { jenis: 'stok_ban'; id: number }
  | { jenis: 'stok_ban'; kode: string }
  | { jenis: 'listing'; productId: number; branchId: number }

export type UbahStokInput = PerubahanStok & {
  target: TargetStok
  refId?: string | null
  batchId?: number | null
  pengguna?: string | null
}

export type HasilUbahStok = { perubahan: number; saldoAkhir: number; dicatat: boolean; kodeProduk: string }

// Isi kode StockTire yang masih kosong (urut id). Kode yang sudah ada tidak diubah. Aman diulang.
export async function isiKodeKosong(tx: Tx) {
  const kosong = await tx.stockTire.findMany({ where: { kode: null }, orderBy: { id: 'asc' }, select: { id: true, sizeNorm: true, brand: true } })
  if (!kosong.length) return { diisi: 0, kembar: [] as { id: number; kode: string }[] }
  const ada = await tx.stockTire.findMany({ where: { kode: { not: null } }, select: { kode: true } })
  const kode = bentukKode(kosong, ada.map((a) => a.kode!))
  for (const [i, r] of kosong.entries()) await tx.stockTire.update({ where: { id: r.id }, data: { kode: kode[i] } })
  return { diisi: kosong.length, kembar: kosong.map((r, i) => ({ id: r.id, kode: kode[i] })).filter((x) => kodeKembar(x.kode)) }
}

// Saldo dibaca dari nilai terbaru di dalam transaksi. Tidak ada perubahan: tidak dicatat.
export async function ubahStokTx(tx: Tx, p: UbahStokInput): Promise<HasilUbahStok> {
  const t = p.target
  let saldoLama: number
  let kodeProduk: string
  let cabangId: number | null
  let simpan: (n: number) => Promise<unknown>
  if (t.jenis === 'stok_ban') {
    const cari = () => tx.stockTire.findUnique({ where: 'id' in t ? { id: t.id } : { kode: t.kode }, select: { id: true, stock: true, kode: true } })
    let row = await cari()
    if (!row) throw new GalatStok('Baris stok ban tidak ditemukan')
    if (!row.kode) {
      await isiKodeKosong(tx)
      row = (await cari())!
    }
    const id = row.id
    saldoLama = row.stock
    kodeProduk = row.kode!
    cabangId = null
    simpan = (n) => tx.stockTire.update({ where: { id }, data: { stock: n } })
  } else {
    const where = { productId_branchId: { productId: t.productId, branchId: t.branchId } }
    const l = await tx.listing.findUnique({ where, select: { stock: true, product: { select: { kode: true, slug: true } } } })
    if (!l) throw new GalatStok('Produk ini belum terdaftar di cabang tersebut')
    saldoLama = l.stock
    kodeProduk = l.product.kode || l.product.slug
    cabangId = t.branchId
    simpan = (n) => tx.listing.update({ where, data: { stock: n } })
  }
  const { perubahan, saldoAkhir } = hitungSaldo(saldoLama, p)
  if (perubahan === 0) return { perubahan, saldoAkhir, dicatat: false, kodeProduk }
  await simpan(saldoAkhir)
  await tx.bukuStok.create({
    data: { tipe: p.tipe, perubahan, saldoAkhir, refId: p.refId ?? null, batchId: p.batchId ?? null, cabangId, kodeProduk, pengguna: p.pengguna ?? null },
  })
  return { perubahan, saldoAkhir, dicatat: true, kodeProduk }
}

export const ubahStok = (p: UbahStokInput) => db.$transaction((tx) => ubahStokTx(tx, p))

type DataListing = { price: number; comparePrice: number; available: boolean; flashSale: boolean }

// Simpan harga dan status listing, lalu setel stoknya lewat buku stok (tipe koreksi). Satu transaksi.
export function simpanListing(p: { productId: number; branchId: number; data: DataListing; stok: number; pengguna?: string | null; refId?: string | null }) {
  const { productId, branchId } = p
  return db.$transaction(async (tx) => {
    await tx.listing.upsert({ where: { productId_branchId: { productId, branchId } }, create: { productId, branchId, ...p.data }, update: p.data })
    return ubahStokTx(tx, { target: { jenis: 'listing', productId, branchId }, setKe: p.stok, tipe: 'koreksi', pengguna: p.pengguna, refId: p.refId })
  })
}

// Hapus listing. Sisa stoknya dicatat keluar (koreksi ke 0) supaya buku stok tetap seimbang.
export function hapusListing(p: { productId: number; branchId: number; pengguna?: string | null; refId?: string | null }) {
  const { productId, branchId } = p
  return db.$transaction(async (tx) => {
    const where = { productId_branchId: { productId, branchId } }
    if (!(await tx.listing.findUnique({ where, select: { id: true } }))) return false
    await ubahStokTx(tx, { target: { jenis: 'listing', productId, branchId }, setKe: 0, tipe: 'koreksi', pengguna: p.pengguna, refId: p.refId })
    await tx.listing.delete({ where })
    return true
  })
}
