import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { syaratPerluDicek } from '@/lib/perlu-dicek'
import { getSitus } from '@/lib/situs-server'
import { Badge, Empty, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { waktuWib } from '@/lib/format'

const BATAS = 200
const pendek = (name: string) => name.replace(/\s*\(.*\)/, '')

// Perlu dicek: harga ban yang kosong atau janggal dan produk dijual tanpa harga (hanya bila sakelar harga menyala).
// Stok ban habis dan produk situs stok 0 bukan masalah, jadi hanya jadi keterangan satu baris.
// Owner melihat semua cabang. Admin cabang hanya cabangnya, dan stok ban tetap diperbaiki owner.
export default async function Peringatan() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const w = syaratPerluDicek(s)
  const urut = [{ ring: 'asc' as const }, { sizeNorm: 'asc' as const }, { id: 'asc' as const }]
  const { showPrices } = await getSitus()
  const [produk, nProduk, nKosong, masalah, nMasalah, nStok0, menipis, branches] = await Promise.all([
    showPrices ? db.listing.findMany({ where: w.produkTanpaHarga, include: { product: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } }, orderBy: [{ branchId: 'asc' }, { productId: 'asc' }], take: BATAS }) : [],
    showPrices ? db.listing.count({ where: w.produkTanpaHarga }) : 0,
    db.stockTire.count({ where: w.stokKosong }),
    db.stockTire.findMany({ where: w.hargaMasalah, orderBy: urut, take: BATAS }),
    db.stockTire.count({ where: w.hargaMasalah }),
    db.listing.count({ where: w.produkStok0 }),
    db.peringatanStok.findMany({ where: w.stokMenipis, orderBy: { dibuat: 'desc' }, take: BATAS }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ])
  // Nama dan stok sekarang untuk tiap peringatan (peringatan menyimpan id baris, bukan relasi).
  const [banMenipis, listingMenipis] = await Promise.all([
    db.stockTire.findMany({ where: { id: { in: menipis.filter((x) => x.sumber === 'ban').map((x) => x.barisId) } }, select: { id: true, sizeRaw: true, brand: true, stock: true } }),
    db.listing.findMany({ where: { id: { in: menipis.filter((x) => x.sumber === 'produk').map((x) => x.barisId) } }, select: { id: true, stock: true, product: { select: { name: true } } } }),
  ])
  const infoMenipis = (x: (typeof menipis)[number]) => {
    if (x.sumber === 'ban') {
      const r = banMenipis.find((b) => b.id === x.barisId)
      return { nama: r ? `${r.sizeRaw} ${r.brand}` : x.kodeProduk, stok: r?.stock ?? x.jumlahSaatItu }
    }
    const l = listingMenipis.find((b) => b.id === x.barisId)
    return { nama: l?.product.name ?? x.kodeProduk, stok: l?.stock ?? x.jumlahSaatItu }
  }
  const sebagian = (n: number, tampil: number) => n > tampil && <p className="mt-2 text-xs text-mute">Menampilkan {tampil} dari {n}.</p>
  const semuaBeres = nProduk + nMasalah + menipis.length === 0
  const tautan = 'adm-btn-line adm-btn-sm'

  return (
    <PageBody>
      <PageHeader
        title="Perlu dicek"
        note={owner ? 'Hal yang perlu ditindaklanjuti di stok dan harga.' : 'Hal yang perlu ditindaklanjuti di cabang kamu. Stok dan harga ban diperbaiki owner, jadi sampaikan ke owner kalau ada yang salah.'}
      />
      {semuaBeres && <Empty title="Semua beres">Tidak ada yang perlu kamu tindak sekarang. Stok yang kosong bukan masalah: bot dan situs menjawabnya lewat WhatsApp.</Empty>}

      {menipis.length > 0 && (
        <Section
          id="menipis"
          title={`Stok menipis (${menipis.length})`}
          description="Stoknya sudah di batas minimum atau di bawahnya. Peringatan tertutup sendiri saat stok naik di atas batas."
        >
          <DataTable
            caption="Stok menipis"
            rows={menipis}
            rowKey={(x) => x.id}
            columns={[
              { key: 'barang', header: 'Barang', cell: (x) => <span className="font-semibold text-ink">{infoMenipis(x).nama}</span> },
              ...(owner ? [{ key: 'cabang', header: 'Cabang', cell: (x: (typeof menipis)[number]) => pendek(branches.find((b) => b.id === x.cabangId)?.name ?? 'Tanpa cabang') }] : []),
              { key: 'stok', header: 'Stok sekarang', align: 'right', cell: (x) => infoMenipis(x).stok },
              { key: 'batas', header: 'Batas', align: 'right', cell: (x) => x.batasMinimum },
              { key: 'sejak', header: 'Sejak', mobile: 'hide', cell: (x) => waktuWib(x.dibuat) },
            ]}
            actions={owner ? (x) => <Link href={`/admin/kasir/barang?sumber=${x.sumber}&id=${x.barisId}`} className={tautan} aria-label={`Atur ${infoMenipis(x).nama}`}>Atur</Link> : undefined}
          />
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
      {nProduk > 0 && (
        <Section
          id="produk"
          title={`Produk dijual tanpa harga (${nProduk})`}
          description="Sakelar harga di situs menyala, jadi produk ini tampil sebagai ajakan tanya harga. Isi harganya, atau matikan sakelar di Produk situs."
          actions={<Link href="/admin/harga" className={tautan}>Buka Produk situs</Link>}
        >
          <DataTable
            caption="Produk dijual tanpa harga"
            rows={produk}
            rowKey={(l) => l.id}
            columns={[
              { key: 'produk', header: 'Produk', cell: (l) => <span className="font-semibold text-ink">{l.product.name}</span> },
              ...(owner ? [{ key: 'cabang', header: 'Cabang', cell: (l: (typeof produk)[number]) => pendek(l.branch.name) }] : []),
            ]}
            actions={(l) => (
              <Link
                href={`/admin/produk/${l.product.id}#harga`}
                className={tautan}
                aria-label={`Isi harga ${l.product.name}`}
              >
                Isi harga
              </Link>
            )}
          />
          {sebagian(nProduk, produk.length)}
        </Section>
      )}

      {nStok0 > 0 && (
        <p className="adm-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 text-sm text-ink">
          <span>
            <b>{nStok0.toLocaleString('id-ID')} produk situs berstok 0.</b> <span className="text-mute">Situs menulis &quot;Stok ditanyakan lewat WhatsApp&quot;, tidak perlu diubah kalau memang belum ada barang.</span>
          </span>
          <Link href="/admin/harga?f=stok0" className={tautan}>Lihat di Produk situs</Link>
        </p>
      )}
      {nKosong > 0 && (
        <p className="adm-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 text-sm text-ink">
          <span>
            <b>{nKosong.toLocaleString('id-ID')} ban stoknya habis.</b> <span className="text-mute">Bot menjawabnya sebagai habis, tidak perlu diubah kalau memang kosong.</span>
          </span>
          {owner && <Link href="/admin/stok-ban?f=habis" className={tautan}>Lihat di Stok ban</Link>}
        </p>
      )}
    </PageBody>
  )
}
