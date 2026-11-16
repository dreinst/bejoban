import 'server-only'
import { db } from './db'
import { getSitus } from './situs-server'
import type { Session } from './auth'

// Syarat "perlu dicek" yang sama untuk Ringkasan, tab Perlu dicek, dan angka kecil di tab.
// Owner melihat semua cabang. Admin cabang hanya cabangnya sendiri.
// Yang dihitung hanya hal yang benar-benar perlu ditindak: harga ban kosong atau janggal, dan produk dijual
// tanpa harga selama sakelar "Tampilkan harga di situs" menyala. Stok ban habis dan produk situs stok 0
// bukan masalah (bot dan situs menjawabnya lewat WhatsApp), jadi hanya jadi keterangan.
export function syaratPerluDicek(s: Pick<Session, 'role' | 'branchId'>) {
  const owner = s.role === 'OWNER'
  const cabangBan = owner ? {} : { cabangId: s.branchId ?? -1 }
  const cabangProduk = owner ? {} : { branchId: s.branchId ?? -1 }
  return {
    stokKosong: { aktif: true, stock: 0, ...cabangBan },
    hargaMasalah: { aktif: true, priceIssue: { not: '' }, ...cabangBan },
    produkTanpaHarga: { available: true, price: 0, product: { active: true }, ...cabangProduk },
    produkStok0: { available: true, stock: 0, product: { active: true }, ...cabangProduk },
  }
}

export async function hitungPerluDicek(s: Pick<Session, 'role' | 'branchId'>) {
  const w = syaratPerluDicek(s)
  const { showPrices } = await getSitus()
  const [stokKosong, hargaMasalah, produkTanpaHarga, produkStok0] = await Promise.all([
    db.stockTire.count({ where: w.stokKosong }),
    db.stockTire.count({ where: w.hargaMasalah }),
    showPrices ? db.listing.count({ where: w.produkTanpaHarga }) : 0,
    db.listing.count({ where: w.produkStok0 }),
  ])
  return { showPrices, stokKosong, hargaMasalah, produkTanpaHarga, produkStok0, total: hargaMasalah + produkTanpaHarga }
}
