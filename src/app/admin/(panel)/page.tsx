import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { PageHeader, StatCard } from '@/components/admin/ui'
import { Card } from '@/components/admin/simple-list'

const wib = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })

// Tanggal awal (waktu Jakarta) untuk hitungan 7 hari terakhir.
const sevenDaysAgo = () => new Date(Date.now() + 7 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10)

export default async function Dashboard() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const branchFilter = owner ? {} : { branchId: s.branchId! }
  const [products, listings, noPhoto, zeroListing] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.listing.count({ where: { ...branchFilter, available: true } }),
    db.product.count({ where: { active: true, images: '[]' } }),
    db.listing.count({ where: { ...branchFilter, available: true, stock: 0 } }),
  ])

  // Angka stok ban, percakapan, dan klik WhatsApp berasal dari data nyata. Khusus owner.
  let ops: React.ReactNode = null
  if (owner) {
    const since = sevenDaysAgo()
    const [stokRows, stokKosong, bermasalah, menunggu, klik, cabang, last] = await Promise.all([
      db.stockTire.count(),
      db.stockTire.count({ where: { stock: 0 } }),
      db.stockTire.count({ where: { priceIssue: { not: '' } } }),
      db.botConversation.count({ where: { status: 'DISERAHKAN' } }),
      db.waClick.groupBy({ by: ['branch'], where: { day: { gte: since } }, _sum: { count: true } }),
      db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
      db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
    ])
    const li = last ? (JSON.parse(last.value) as { at: string; source?: string; total: number; problemCount: number }) : null
    const click = (slug: string) => klik.find((k) => k.branch === slug)?._sum.count ?? 0
    ops = (
      <>
        <h2 className="mb-3 mt-8 font-display text-lg font-extrabold text-ink">Stok ban dan layanan pelanggan</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Baris stok ban" value={stokRows} href="/admin/stok-ban" />
          <StatCard label="Stok kosong" value={stokKosong} href="/admin/stok-ban" warn={stokKosong > 0} hint="dari baris stok ban" />
          <StatCard label="Harga bermasalah" value={bermasalah} href="/admin/stok-ban?f=masalah" warn={bermasalah > 0} hint="perlu diisi manual" />
          <StatCard label="Menunggu admin" value={menunggu} href="/admin/chatbot?status=DISERAHKAN#percakapan" warn={menunggu > 0} hint="percakapan chatbot" />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card title="Klik WhatsApp, 7 hari terakhir">
            <ul className="divide-y divide-line text-sm">
              {cabang.map((b) => (
                <li key={b.slug} className="flex items-center justify-between py-2"><span>{b.name.replace(/\s*\(.*\)/, '')}</span><b className="font-display text-lg">{click(b.slug)}</b></li>
              ))}
              <li className="flex items-center justify-between py-2 text-mute"><span>Tautan umum</span><b className="font-display text-lg text-ink">{click('')}</b></li>
            </ul>
            <p className="mt-2 text-xs text-mute">Hitungan dari tautan pendek /wa, tanpa data pribadi.</p>
          </Card>
          <Card title="Sinkron pricelist terakhir">
            {li ? (
              <>
                <p className="font-display text-xl font-extrabold text-ink">{wib(new Date(li.at))}</p>
                <p className="mt-1 text-sm text-mute">{li.source === 'sheet' ? 'Google Sheets' : 'Berkas CSV'}, {li.total} baris, {li.problemCount} bermasalah.</p>
              </>
            ) : (
              <p className="text-sm text-mute">Belum pernah impor atau sinkron.</p>
            )}
            <Link href="/admin/stok-ban" className="adm-btn-line adm-btn-sm mt-3">Buka stok ban</Link>
          </Card>
        </div>
      </>
    )
  }

  return (
    <div>
      <PageHeader title="Ringkasan" note={owner ? 'Angka dari data yang sedang berjalan.' : 'Ringkasan cabang kamu.'} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Produk aktif" value={products} href="/admin/produk" />
        <StatCard label="Dijual di cabang" value={listings} href="/admin/harga" />
        <StatCard label="Produk tanpa foto" value={noPhoto} href="/admin/produk" warn={noPhoto > 0} />
        <StatCard label="Stok 0 di cabang" value={zeroListing} href="/admin/harga" warn={zeroListing > 0} />
      </div>
      {ops}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/produk/baru" className="adm-btn">+ Tambah produk</Link>
        <Link href="/admin/harga" className="adm-btn-line">Update harga dan stok cepat</Link>
        <Link href="/admin/panduan-foto" className="adm-btn-line">Panduan ukuran foto</Link>
      </div>
    </div>
  )
}
