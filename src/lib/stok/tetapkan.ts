// Tetapkan semua baris stok ban tanpa cabang ke satu cabang. Dipakai owner setelah tahu pricelist lama milik cabang mana.
import { db } from '../db'
import { isiKodeKosong, kunciSusunanStok } from './ubah'

// Baris tanpa cabang yang kodenya sudah dimiliki cabang tujuan dilewati (tetap tanpa cabang), supaya tidak bentrok.
// Buku stok tetap seimbang per kode dan cabang: sisa stok dicatat keluar dari "tanpa cabang" dan masuk ke cabang
// tujuan (dua baris tipe koreksi dengan ref_id yang sama). Stok di baris itu sendiri tidak berubah.
export async function tetapkanTanpaCabang(cabangId: number, pengguna: string | null = null) {
  return db.$transaction(
    async (tx) => {
      if (!(await tx.branch.findUnique({ where: { id: cabangId }, select: { id: true } }))) throw new Error('Cabang tidak ditemukan')
      await kunciSusunanStok(tx)
      await isiKodeKosong(tx)
      // Kunci baris tanpa cabang supaya stoknya tidak berubah di tengah jalan (saldonya dicatat di buku stok).
      await tx.$executeRaw`SELECT "id" FROM "StockTire" WHERE "cabang_id" IS NULL ORDER BY "id" FOR UPDATE`
      const tanpa = await tx.stockTire.findMany({ where: { cabangId: null }, select: { id: true, kode: true, stock: true }, orderBy: { id: 'asc' } })
      const sudah = new Set((await tx.stockTire.findMany({ where: { cabangId }, select: { kode: true } })).map((r) => r.kode))
      const pindah = tanpa.filter((r) => !sudah.has(r.kode))
      if (pindah.length) await tx.stockTire.updateMany({ where: { id: { in: pindah.map((r) => r.id) } }, data: { cabangId } })
      const refId = `tetapkan_cabang:${cabangId}:${new Date().toISOString()}`
      for (const r of pindah.filter((x) => x.stock !== 0)) {
        await tx.bukuStok.create({ data: { tipe: 'koreksi', perubahan: -r.stock, saldoAkhir: 0, cabangId: null, kodeProduk: r.kode!, refId, pengguna } })
        await tx.bukuStok.create({ data: { tipe: 'koreksi', perubahan: r.stock, saldoAkhir: r.stock, cabangId, kodeProduk: r.kode!, refId, pengguna } })
      }
      return { dipindah: pindah.length, dilewati: tanpa.length - pindah.length }
    },
    { timeout: 60_000, maxWait: 10_000 },
  )
}
