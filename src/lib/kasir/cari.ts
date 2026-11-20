// Pencarian dan hitungan keranjang di layar kasir. Modul murni, dipakai komponen klien dan tes.
import { findSizes } from '../tire/size'
import { bagiDiskon, GalatKasir, pecahFifo } from './logika'

export type Dicari = { sumber: string; kode: string; barcode: string; nama: string; keterangan: string; ukuran: string; stok: number | null }

const rapikan = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9/.,x-]+/g, ' ').replace(/\s+/g, ' ').trim()

// Teks yang persis sama dengan kode atau barcode (pemindai barcode USB mengetik kode lalu Enter).
export function cocokPersis<T extends Dicari>(items: T[], q: string): T | null {
  const t = q.trim().toLowerCase()
  if (!t) return null
  return items.find((i) => (i.barcode && i.barcode.toLowerCase() === t) || (i.kode && i.kode.toLowerCase() === t)) ?? null
}

// Cari di nama, merek, kode, barcode, dan ukuran. "185 65 15" menemukan 185/65 R15 lewat normalisasi ukuran.
export function cariKatalog<T extends Dicari>(items: T[], q: string, batas = 40): T[] {
  const t = rapikan(q)
  if (!t) return []
  const ukuran = findSizes(q).map((s) => s.norm.toLowerCase())
  // Kata sisa sesudah angka ukuran dibuang, mis. "185 65 15 hankook" menyisakan "hankook".
  const kata = (ukuran.length ? t.replace(/\d+/g, ' ') : t).split(' ').filter((w) => w.length > 0 && !/^[/.,x-]+$/.test(w) && !(ukuran.length && /^r$/.test(w)))
  const hasil = items.filter((i) => {
    if (ukuran.length && !ukuran.includes(i.ukuran.toLowerCase())) return false
    const teks = rapikan(`${i.nama} ${i.keterangan} ${i.kode} ${i.barcode} ${i.ukuran}`)
    return kata.every((w) => teks.includes(w))
  })
  // Barang berstok dulu, lalu jasa, lalu yang habis.
  const nilai = (i: T) => (i.stok === null ? 1 : i.stok > 0 ? 0 : 2)
  return hasil.toSorted((a, b) => nilai(a) - nilai(b)).slice(0, batas)
}

export type BarisKeranjang = { key: string; nama: string; jumlah: number; batch: { sisa: number; harga: number }[]; hargaJasa: number | null }

// Pratinjau harga di layar: pecahan per batch, subtotal, diskon, total. Server menghitung ulang saat bayar.
export function hitungKeranjang(baris: BarisKeranjang[], diskon: number) {
  const rinci = baris.map((b) => {
    if (b.hargaJasa !== null) return { key: b.key, potongan: [{ jumlah: b.jumlah, harga: b.hargaJasa }], galat: b.hargaJasa > 0 ? '' : 'Harga jasa belum diatur' }
    try {
      const p = pecahFifo(
        b.batch.map((x, i) => ({ id: i + 1, sisa: x.sisa, hargaJual: x.harga, tanggalMasuk: new Date(i) })),
        b.jumlah,
      ).map((x) => ({ jumlah: x.jumlah, harga: x.harga }))
      return { key: b.key, potongan: p, galat: p.some((x) => x.harga <= 0) ? 'Harga belum diatur owner' : '' }
    } catch (e) {
      return { key: b.key, potongan: [] as { jumlah: number; harga: number }[], galat: e instanceof GalatKasir ? e.message : 'Tidak bisa dihitung' }
    }
  })
  const subtotal = rinci.reduce((n, r) => n + r.potongan.reduce((m, p) => m + p.jumlah * p.harga, 0), 0)
  const d = Number.isInteger(diskon) && diskon > 0 ? Math.min(diskon, subtotal) : 0
  const nilai = rinci.flatMap((r) => r.potongan.map((p) => p.jumlah * p.harga))
  return { rinci, subtotal, diskon: d, total: subtotal - d, bagian: nilai.length ? bagiDiskon(nilai, d) : [], galat: rinci.some((r) => r.galat) || diskon > subtotal }
}
