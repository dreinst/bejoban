import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { syaratPerluDicek } from '@/lib/perlu-dicek'
import { Badge, Empty, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'

const BATAS = 200
const rp = (n: number | null) => (n === null ? '-' : 'Rp ' + n.toLocaleString('id-ID'))
const pendek = (name: string) => name.replace(/\s*\(.*\)/, '')

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
  const tautan = 'adm-btn-line adm-btn-sm'

  return (
    <PageBody>
      <PageHeader
        title="Perlu dicek"
        note={owner ? 'Hal yang perlu ditindaklanjuti di stok dan harga.' : 'Hal yang perlu ditindaklanjuti di cabang kamu. Stok dan harga ban diperbaiki owner, jadi sampaikan ke owner kalau ada yang salah.'}
      />
      {semuaBeres && <Empty title="Semua beres">Tidak ada produk atau ban yang perlu dicek sekarang.</Empty>}

      {nProduk > 0 && (
        <Section
          id="produk"
          title={`Produk situs dijual tapi stok 0 (${nProduk})`}
          description="Isi stoknya, atau hilangkan centang Dijual kalau barangnya memang habis."
          actions={
            <Link href={`/admin/harga?${new URLSearchParams({ f: 'stok0' })}`} className={tautan}>Buka Produk situs</Link>
          }
        >
          <DataTable
            caption="Produk situs dijual tapi stok 0"
            rows={produk}
            rowKey={(l) => l.id}
            columns={[
              { key: 'produk', header: 'Produk', cell: (l) => <span className="font-semibold text-ink">{l.product.name}</span> },
              ...(owner ? [{ key: 'cabang', header: 'Cabang', cell: (l: (typeof produk)[number]) => pendek(l.branch.name) }] : []),
            ]}
            actions={(l) => (
              <Link
                href={`/admin/harga?${new URLSearchParams({ ...(owner && { cabang: String(l.branch.id) }), f: 'stok0' })}`}
                className={tautan}
                aria-label={`Ubah stok ${l.product.name}`}
              >
                Ubah stok
              </Link>
            )}
          />
          {sebagian(nProduk, produk.length)}
        </Section>
      )}

      {nKosong > 0 && (
        <Section
          id="stok-kosong"
          title={`Stok ban habis (${nKosong})`}
          description="Ban yang stoknya 0. Bot menjawab ban ini sebagai habis."
          actions={owner ? <Link href="/admin/stok-ban" className={tautan}>Buka Stok ban</Link> : undefined}
        >
          <DataTable
            caption="Stok ban habis"
            rows={kosong}
            rowKey={(r) => r.id}
            columns={[
              { key: 'ukuran', header: 'Ukuran', cell: (r) => <span className="font-semibold text-ink">{r.sizeRaw}</span> },
              { key: 'merek', header: 'Merek', cell: (r) => r.brand },
              { key: 'harga', header: 'Harga', align: 'right', cell: (r) => rp(r.price) },
              { key: 'ket', header: 'Keterangan', cell: (r) => r.note || '-' },
            ]}
          />
          {sebagian(nKosong, kosong.length)}
        </Section>
      )}

      {nMasalah > 0 && (
        <Section
          id="harga"
          title={`Harga ban perlu diisi (${nMasalah})`}
          description="Harganya kosong atau tidak terbaca dari pricelist. Bot tidak menyebut harga untuk ban ini."
          actions={owner ? <Link href="/admin/stok-ban?f=masalah" className={tautan}>Isi di Stok ban</Link> : undefined}
        >
          <DataTable
            caption="Harga ban perlu diisi"
            rows={masalah}
            rowKey={(r) => r.id}
            columns={[
              { key: 'ukuran', header: 'Ukuran', cell: (r) => <span className="font-semibold text-ink">{r.sizeRaw}</span> },
              { key: 'merek', header: 'Merek', cell: (r) => r.brand },
              { key: 'stok', header: 'Stok', align: 'right', cell: (r) => r.stock },
              {
                key: 'masalah',
                header: 'Masalah',
                cell: (r) =>
                  r.priceIssue === 'kosong' ? (
                    <Badge tone="light">Harga kosong</Badge>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge tone="outline">Harga janggal</Badge>
                      <span className="font-mono text-xs text-mute">{r.priceIssue.replace(/^format janggal:\s*/, '')}</span>
                    </span>
                  ),
              },
            ]}
          />
          {sebagian(nMasalah, masalah.length)}
        </Section>
      )}
    </PageBody>
  )
}
