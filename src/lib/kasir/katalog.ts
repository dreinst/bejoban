// Katalog layar kasir: ban, produk situs, dan jasa dalam satu daftar cari untuk satu cabang.
// Tiap barang membawa batch bersisanya (urut FIFO) supaya layar bisa menampilkan harga yang akan terjual.
// Harga tetap dihitung ulang di server saat bayar (src/lib/kasir/transaksi.ts).
import 'server-only'
import { db } from '../db'
import { namaPendek } from '../tire/cabang'
import type { Sumber } from './logika'

export type ItemKatalog = {
  key: string // "ban:12", "produk:5", "jasa:3" atau "jasa:3:alt"
  sumber: Sumber
  id: number
  alt?: boolean
  nama: string
  keterangan: string // merek, varian, atau satuan
  kode: string
  barcode: string
  ukuran: string // ukuran baku ban untuk pencarian, mis. 185/65R15
  stok: number | null // null untuk jasa
  batch: { sisa: number; harga: number }[] // kosong untuk jasa
  harga: number // harga batch terdepan, atau harga jasa
  stokLain: { cabang: string; stok: number }[]
}

export async function muatKatalog(cabangId: number): Promise<ItemKatalog[]> {
  const [cabang, ban, listing, jasa, batch] = await Promise.all([
    db.branch.findMany({ select: { id: true, name: true }, orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
    db.stockTire.findMany({ where: { cabangId, aktif: true }, select: { id: true, sizeRaw: true, sizeNorm: true, brand: true, kode: true, stock: true, price: true, discount: true }, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }] }),
    db.listing.findMany({
      where: { branchId: cabangId },
      select: { id: true, stock: true, price: true, productId: true, product: { select: { name: true, kode: true, slug: true, barcode: true, spec: true, brand: { select: { name: true } } } } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
    }),
    db.servicePrice.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
    db.batchStok.findMany({ where: { cabangId, sisa: { gt: 0 } }, select: { sumber: true, barisId: true, sisa: true, hargaJual: true }, orderBy: [{ tanggalMasuk: 'asc' }, { id: 'asc' }] }),
  ])
  const nama = (id: number | null) => (id === null ? 'Tanpa cabang' : namaPendek(cabang.find((c) => c.id === id)?.name ?? `Cabang ${id}`))
  const perBaris = new Map<string, { sisa: number; harga: number }[]>()
  for (const b of batch) {
    const k = `${b.sumber}:${b.barisId}`
    perBaris.set(k, [...(perBaris.get(k) ?? []), { sisa: b.sisa, harga: b.hargaJual }])
  }
  // Stok cabang lain untuk kode ban dan produk yang sama.
  const kodeBan = ban.map((b) => b.kode).filter((k): k is string => !!k)
  const [banLain, listingLain] = await Promise.all([
    db.stockTire.findMany({ where: { aktif: true, kode: { in: kodeBan }, NOT: { cabangId } }, select: { kode: true, cabangId: true, stock: true } }),
    db.listing.findMany({ where: { productId: { in: listing.map((l) => l.productId) }, NOT: { branchId: cabangId } }, select: { productId: true, branchId: true, stock: true } }),
  ])

  const items: ItemKatalog[] = []
  for (const b of ban) {
    const bt = perBaris.get(`ban:${b.id}`) ?? []
    items.push({
      key: `ban:${b.id}`,
      sumber: 'ban',
      id: b.id,
      nama: b.sizeRaw,
      keterangan: b.brand,
      kode: b.kode ?? '',
      barcode: '',
      ukuran: b.sizeNorm,
      stok: b.stock,
      batch: bt,
      harga: bt[0]?.harga ?? (b.price === null ? 0 : Math.max(0, b.price - b.discount)),
      stokLain: banLain.filter((x) => x.kode === b.kode).map((x) => ({ cabang: nama(x.cabangId), stok: x.stock })),
    })
  }
  for (const l of listing) {
    const bt = perBaris.get(`produk:${l.id}`) ?? []
    items.push({
      key: `produk:${l.id}`,
      sumber: 'produk',
      id: l.id,
      nama: l.product.name,
      keterangan: [l.product.brand?.name, l.product.spec].filter(Boolean).join(' · '),
      kode: l.product.kode || l.product.slug,
      barcode: l.product.barcode ?? '',
      ukuran: '',
      stok: l.stock,
      batch: bt,
      harga: bt[0]?.harga ?? l.price,
      stokLain: listingLain.filter((x) => x.productId === l.productId).map((x) => ({ cabang: nama(x.branchId), stok: x.stock })),
    })
  }
  for (const j of jasa) {
    const dasar = [j.name === j.groupName ? '' : j.groupName, j.variant].filter(Boolean).join(' · ')
    items.push({ key: `jasa:${j.id}`, sumber: 'jasa', id: j.id, nama: [j.name, j.variant].filter(Boolean).join(' '), keterangan: [dasar, j.unit].filter(Boolean).join(' · '), kode: `jasa:${j.id}`, barcode: '', ukuran: '', stok: null, batch: [], harga: j.price ?? 0, stokLain: [] })
    if (j.altLabel)
      items.push({ key: `jasa:${j.id}:alt`, sumber: 'jasa', id: j.id, alt: true, nama: [j.name, j.variant, j.altLabel].filter(Boolean).join(' '), keterangan: [dasar, j.altLabel].filter(Boolean).join(' · '), kode: `jasa:${j.id}:alt`, barcode: '', ukuran: '', stok: null, batch: [], harga: j.altPrice ?? 0, stokLain: [] })
  }
  return items
}
