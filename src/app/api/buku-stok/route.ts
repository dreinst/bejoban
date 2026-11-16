// Ekspor CSV buku_stok per rentang tanggal (waktu Jakarta, paling banyak 366 hari). Hanya untuk sesi admin.
// Owner mengunduh semua baris. Admin cabang hanya baris cabangnya.
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { barisCsv, rentangJakarta, waktuJakarta } from '@/lib/stok/csv'

const KOLOM = ['id', 'tipe', 'perubahan', 'saldo_akhir', 'ref_id', 'batch_id', 'cabang_id', 'kode_produk', 'waktu', 'pengguna']

export async function GET(req: Request) {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Belum login' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  const sp = new URL(req.url).searchParams
  const dari = sp.get('dari') ?? ''
  const sampai = sp.get('sampai') ?? ''
  const r = rentangJakarta(dari, sampai)
  if (!r.ok) return Response.json({ error: r.error }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const rows = await db.bukuStok.findMany({
    where: { waktu: { gte: r.gte, lt: r.lt }, ...(s.role !== 'OWNER' && { cabangId: s.branchId ?? -1 }) },
    orderBy: { id: 'asc' },
  })
  const isi = [
    barisCsv(KOLOM),
    ...rows.map((b) => barisCsv([b.id, b.tipe, b.perubahan, b.saldoAkhir, b.refId, b.batchId, b.cabangId, b.kodeProduk, waktuJakarta(b.waktu), b.pengguna])),
  ].join('\r\n')
  // BOM supaya Excel membaca UTF-8 dengan benar.
  return new Response(`\uFEFF${isi}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="buku-stok_${dari}_${sampai}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
