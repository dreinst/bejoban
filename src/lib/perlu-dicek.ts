import 'server-only'
import { db } from './db'
import type { Session } from './auth'

// Syarat "perlu dicek" yang sama untuk Ringkasan, tab Perlu dicek, dan angka kecil di tab (tanpa stok ban habis).
// Owner melihat semua cabang. Admin cabang hanya cabangnya sendiri.
export function syaratPerluDicek(s: Pick<Session, 'role' | 'branchId'>) {
  const owner = s.role === 'OWNER'
  const cabangBan = owner ? {} : { cabangId: s.branchId ?? -1 }
  const cabangProduk = owner ? {} : { branchId: s.branchId ?? -1 }
  return {
    stokKosong: { aktif: true, stock: 0, ...cabangBan },
    hargaMasalah: { aktif: true, priceIssue: { not: '' }, ...cabangBan },
    produkStok0: { available: true, stock: 0, product: { active: true }, ...cabangProduk },
  }
}

export async function hitungPerluDicek(s: Pick<Session, 'role' | 'branchId'>) {
  const w = syaratPerluDicek(s)
  const [stokKosong, hargaMasalah, produkStok0] = await Promise.all([
    db.stockTire.count({ where: w.stokKosong }),
    db.stockTire.count({ where: w.hargaMasalah }),
    db.listing.count({ where: w.produkStok0 }),
  ])
  // Stok ban habis sering ratusan baris dan tidak butuh tindakan, jadi tidak ikut angka di tab.
  return { stokKosong, hargaMasalah, produkStok0, total: hargaMasalah + produkStok0 }
}
