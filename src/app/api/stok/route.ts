// Stok saat ini dengan nama kolom gaya BejoStock. Hanya untuk sesi admin (dicek di sini, proxy hanya menjaga /admin).
// Owner melihat semua. Admin cabang hanya melihat listing cabangnya dan tidak melihat stok ban.
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const s = await getSession()
  if (!s) return Response.json({ error: 'Belum login' }, { status: 401, headers: NO_STORE })
  const raw = new URL(req.url).searchParams.get('cabang_id')
  let cabangId: number | null = null
  if (raw !== null && raw !== '') {
    if (!/^\d{1,9}$/.test(raw)) return Response.json({ error: 'cabang_id harus angka' }, { status: 400, headers: NO_STORE })
    cabangId = Number(raw)
  }
  if (s.role !== 'OWNER') {
    if (cabangId !== null && cabangId !== s.branchId) return Response.json({ error: 'Tidak punya akses ke cabang itu' }, { status: 403, headers: NO_STORE })
    cabangId = s.branchId ?? -1
  }

  const [listing, ban, terakhir] = await Promise.all([
    db.listing.findMany({
      where: cabangId !== null ? { branchId: cabangId } : {},
      select: { productId: true, branchId: true, stock: true, product: { select: { kode: true, slug: true } } },
      orderBy: [{ branchId: 'asc' }, { productId: 'asc' }],
    }),
    // Stok ban belum per cabang, jadi hanya ikut kalau tidak menyaring cabang.
    cabangId === null
      ? db.stockTire.findMany({ where: { aktif: true }, select: { kode: true, stock: true, importedAt: true, manualAt: true }, orderBy: { id: 'asc' } })
      : Promise.resolve([]),
    db.bukuStok.groupBy({ by: ['kodeProduk', 'cabangId'], _max: { waktu: true } }),
  ])
  const waktu = new Map(terakhir.map((t) => [`${t.kodeProduk}|${t.cabangId ?? ''}`, t._max.waktu]))
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

  const data = [
    ...listing.map((l) => {
      const kode = l.product.kode || l.product.slug
      return { sumber: 'listing', produk_id: l.productId, kode, cabang_id: l.branchId, jumlah: l.stock, batas_minimum: null, diperbarui: iso(waktu.get(`${kode}|${l.branchId}`)) }
    }),
    ...ban.map((b) => {
      const tAlt = b.manualAt && b.manualAt > b.importedAt ? b.manualAt : b.importedAt
      return { sumber: 'stok_ban', produk_id: null, kode: b.kode, cabang_id: null, jumlah: b.stock, batas_minimum: null, diperbarui: iso(waktu.get(`${b.kode}|`) ?? tAlt) }
    }),
  ]
  return Response.json({ data }, { headers: NO_STORE })
}
