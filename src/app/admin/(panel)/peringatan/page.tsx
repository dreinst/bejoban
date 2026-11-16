import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { syaratPerluDicek } from '@/lib/perlu-dicek'
import { Badge, Empty, PageHeader } from '@/components/admin/ui'
import { Card } from '@/components/admin/simple-list'

const BATAS = 200
const rp = (n: number | null) => (n === null ? '-' : 'Rp ' + n.toLocaleString('id-ID'))
const th = 'px-3 py-2 text-left text-xs font-semibold text-mute'
const td = 'px-3 py-1.5 text-sm'

// Perlu dicek: produk situs yang dijual tapi stoknya 0, stok ban habis, dan harga ban yang kosong atau janggal.
// Owner melihat semua cabang. Admin cabang hanya cabangnya, dan stok ban tetap diperbaiki owner.
export default async function Peringatan() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const w = syaratPerluDicek(s)
  const urut = [{ ring: 'asc' as const }, { sizeNorm: 'asc' as const }, { id: 'asc' as const }]
  const [produk, nProduk, kosong, nKosong, masalah, nMasalah] = await Promise.all([
    db.listing.findMany({ where: w.produkStok0, include: { product: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } }, orderBy: [{ branchId: 'asc' }, { productId: 'asc' }], take: BATAS }),
    db.listing.count({ where: w.produkStok0 }),
    db.stockTire.findMany({ where: w.stokKosong, orderBy: urut, take: BATAS }),
    db.stockTire.count({ where: w.stokKosong }),
    db.stockTire.findMany({ where: w.hargaMasalah, orderBy: urut, take: BATAS }),
    db.stockTire.count({ where: w.hargaMasalah }),
  ])
  const sebagian = (n: number, tampil: number) => n > tampil && <p className="mt-2 text-xs text-mute">Menampilkan {tampil} dari {n}.</p>
  const semuaBeres = nProduk + nKosong + nMasalah === 0

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Perlu dicek"
        note={owner ? 'Hal yang perlu ditindaklanjuti di stok dan harga.' : 'Hal yang perlu ditindaklanjuti di cabang kamu. Stok dan harga ban diperbaiki owner, jadi sampaikan ke owner kalau ada yang salah.'}
      />
      {semuaBeres && <Empty>Tidak ada yang perlu dicek. Semua beres.</Empty>}

      {nProduk > 0 && (
        <section id="produk">
          <Card title={`Produk situs dijual tapi stok 0 (${nProduk})`}>
            <p className="mb-3 text-sm text-mute">Isi stoknya, atau hilangkan centang Dijual kalau barangnya memang habis.</p>
            <ul className="divide-y divide-line text-sm">
              {produk.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{l.product.name}</b>{owner && <span className="text-mute"> · {l.branch.name.replace(/\s*\(.*\)/, '')}</span>}</span>
                  <Link href={`/admin/harga?${new URLSearchParams({ ...(owner && { cabang: String(l.branch.id) }), f: 'stok0' })}`} className="adm-btn-line adm-btn-sm">Ubah stok</Link>
                </li>
              ))}
            </ul>
            {sebagian(nProduk, produk.length)}
          </Card>
        </section>
      )}

      {nKosong > 0 && (
        <section id="stok-kosong">
          <Card title={`Stok ban habis (${nKosong})`}>
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
          </Card>
        </section>
      )}

      {nMasalah > 0 && (
        <section id="harga">
          <Card title={`Harga ban perlu diisi (${nMasalah})`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-mute">Harganya kosong atau tidak terbaca dari pricelist. Bot tidak menyebut harga untuk ban ini.</p>
              {owner && <Link href="/admin/stok-ban?f=masalah" className="adm-btn-line adm-btn-sm">Isi di Stok ban</Link>}
            </div>
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
                      <td className={td}>{r.priceIssue === 'kosong' ? <Badge tone="light">Harga kosong</Badge> : <><Badge tone="outline">Harga janggal</Badge> <span className="font-mono text-xs text-mute">{r.priceIssue.replace(/^format janggal:\s*/, '')}</span></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sebagian(nMasalah, masalah.length)}
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
