import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { Badge, Empty, PageHeader, StatCard } from '@/components/admin/ui'
import { Card } from '@/components/admin/simple-list'

const BATAS = 200
const rp = (n: number | null) => (n === null ? '-' : 'Rp ' + n.toLocaleString('id-ID'))
const th = 'px-3 py-2 text-left text-xs font-semibold text-mute'
const td = 'px-3 py-1.5 text-sm'

// Stok ban yang perlu dicek: stok habis dan harga bermasalah. Baris nonaktif diabaikan.
export default async function Peringatan() {
  await requireOwner()
  const kosongWhere = { aktif: true, stock: 0 }
  const masalahWhere = { aktif: true, priceIssue: { not: '' } }
  const urut = [{ ring: 'asc' as const }, { sizeNorm: 'asc' as const }, { id: 'asc' as const }]
  const [kosong, nKosong, masalah, nMasalah] = await Promise.all([
    db.stockTire.findMany({ where: kosongWhere, orderBy: urut, take: BATAS }),
    db.stockTire.count({ where: kosongWhere }),
    db.stockTire.findMany({ where: masalahWhere, orderBy: urut, take: BATAS }),
    db.stockTire.count({ where: masalahWhere }),
  ])
  const sebagian = (n: number, tampil: number) => n > tampil && <p className="mt-2 text-xs text-mute">Menampilkan {tampil} dari {n} baris.</p>

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Peringatan"
        note="Stok ban yang habis dan baris pricelist yang harganya kosong atau janggal. Perbaiki di halaman stok ban atau di sumber pricelist."
        actions={<Link href="/admin/stok-ban?f=masalah" className="adm-btn-line adm-btn-sm">Buka stok ban</Link>}
      />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Stok kosong" value={nKosong} warn={nKosong > 0} hint="baris stok ban aktif" />
        <StatCard label="Harga bermasalah" value={nMasalah} href="/admin/stok-ban?f=masalah" warn={nMasalah > 0} hint="perlu diisi manual" />
      </div>

      <Card title={`Stok kosong (${nKosong} baris)`}>
        {kosong.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr><th className={th}>Ukuran</th><th className={th}>Merek</th><th className={th}>Harga</th><th className={th}>Keterangan</th></tr>
              </thead>
              <tbody>
                {kosong.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className={td}>{r.sizeRaw}</td>
                    <td className={td}>{r.brand}</td>
                    <td className={td}>{rp(r.price)}</td>
                    <td className={td}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sebagian(nKosong, kosong.length)}
          </div>
        ) : (
          <Empty>Tidak ada stok kosong.</Empty>
        )}
      </Card>

      <Card title={`Harga bermasalah (${nMasalah} baris)`}>
        {masalah.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr><th className={th}>Ukuran</th><th className={th}>Merek</th><th className={th}>Stok</th><th className={th}>Masalah</th></tr>
              </thead>
              <tbody>
                {masalah.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className={td}>{r.sizeRaw}</td>
                    <td className={td}>{r.brand}</td>
                    <td className={td}>{r.stock}</td>
                    <td className={td}>{r.priceIssue === 'kosong' ? <Badge tone="light">Harga kosong</Badge> : <Badge tone="outline">{r.priceIssue}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sebagian(nMasalah, masalah.length)}
          </div>
        ) : (
          <Empty>Tidak ada harga bermasalah.</Empty>
        )}
      </Card>
    </div>
  )
}
