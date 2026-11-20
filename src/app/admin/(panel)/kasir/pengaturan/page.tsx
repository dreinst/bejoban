import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { hitungCalonAktivasi, periksaInvarian } from '@/lib/kasir/stok'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, Empty, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { CheckField, FormActions, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'
import { aktifkanKasirAksi } from '../../../kasir-actions'

const saranKode = (nama: string) => namaPendek(nama).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
const rp = (n: number | null) => (n === null ? 'kosong' : `Rp ${n.toLocaleString('id-ID')}`)

// Pengaturan kasir untuk owner: aktifkan kasir per cabang, pemeriksa invarian, dan cari barang untuk mengatur batch,
// koreksi stok, dan batas minimum.
export default async function PengaturanKasir({ searchParams }: PageProps<'/admin/kasir/pengaturan'>) {
  await requireOwner()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true, kodeNota: true, kasirAktifSejak: true } })
  const calon = await Promise.all(branches.map((b) => (b.modeStok === 'kasir' ? null : hitungCalonAktivasi(b.id))))
  const batch = await db.batchStok.groupBy({ by: ['cabangId'], where: { sisa: { gt: 0 } }, _count: true, _sum: { sisa: true } })
  const periksa = sp.periksa === '1' ? await periksaInvarian() : null
  const nama = (id: number | null) => (id === null ? 'Tanpa cabang' : namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`))
  const adaKasir = branches.some((b) => b.modeStok === 'kasir')

  const qBersih = q.replace(/\s/g, '')
  const [ban, produk] = q
    ? await Promise.all([
        db.stockTire.findMany({
          where: { aktif: true, cabangId: { not: null }, OR: [{ brand: { contains: q, mode: 'insensitive' } }, { sizeRaw: { contains: q, mode: 'insensitive' } }, { sizeNorm: { contains: qBersih, mode: 'insensitive' } }] },
          select: { id: true, sizeRaw: true, brand: true, stock: true, price: true, discount: true, cabangId: true, batasMinimum: true },
          orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }],
          take: 40,
        }),
        db.listing.findMany({
          where: { product: { name: { contains: q, mode: 'insensitive' } } },
          select: { id: true, stock: true, price: true, branchId: true, batasMinimum: true, product: { select: { name: true } } },
          orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
          take: 40,
        }),
      ])
    : [[], []]
  const hasil = [
    ...ban.map((r) => ({ key: `ban:${r.id}`, href: `/admin/kasir/barang?sumber=ban&id=${r.id}`, nama: `${r.sizeRaw} ${r.brand}`, jenis: 'Ban', cabangId: r.cabangId, stok: r.stock, harga: r.price === null ? null : r.price - r.discount, batas: r.batasMinimum })),
    ...produk.map((l) => ({ key: `produk:${l.id}`, href: `/admin/kasir/barang?sumber=produk&id=${l.id}`, nama: l.product.name, jenis: 'Produk situs', cabangId: l.branchId as number | null, stok: l.stock, harga: l.price as number | null, batas: l.batasMinimum })),
  ]
  type H = (typeof hasil)[number]

  return (
    <PageBody>
      <PageHeader title="Pengaturan kasir" note="Kasir diaktifkan per cabang. Sesudah aktif, stok cabang itu hanya berubah lewat transaksi kasir, void, dan koreksi owner." />

      <div className="grid gap-5 lg:grid-cols-2">
        {branches.map((b, i) => {
          const c = calon[i]
          const bt = batch.find((x) => x.cabangId === b.id)
          return (
            <Section key={b.id} id={`cabang-${b.id}`} title={`Cabang ${namaPendek(b.name)}`} actions={b.modeStok === 'kasir' ? <Badge>Kasir aktif</Badge> : <Badge tone="outline">Mode sheet</Badge>}>
              {b.modeStok === 'kasir' ? (
                <div className="space-y-2 text-sm">
                  <p>Kode nota <b>{b.kodeNota}</b>, aktif sejak {b.kasirAktifSejak ? waktuWib(b.kasirAktifSejak) : '-'}.</p>
                  <p className="text-mute">{bt?._count ?? 0} batch masih bersisa, total {bt?._sum.sisa ?? 0} unit.</p>
                  <p className="text-mute">Impor dan sinkron pricelist untuk cabang ini ditolak. Belum ada jalan kembali ke mode sheet.</p>
                  <Link href={`/admin/kasir?cabang=${b.id}`} className="adm-btn-line adm-btn-sm inline-flex">Buka kasir</Link>
                </div>
              ) : (
                <form action={aktifkanKasirAksi} className="space-y-3 text-sm">
                  <input type="hidden" name="cabang" value={b.id} />
                  <ul className="list-disc space-y-1 pl-5 text-ink">
                    <li>{c!.banStok} dari {c!.ban} baris ban dan {c!.produkStok} dari {c!.produk} produk situs berstok akan mendapat batch awal dengan stok dan harga sekarang.</li>
                    {c!.hargaNol > 0 && <li>{c!.hargaNol} ban berstok belum punya harga, jadi belum bisa dijual sampai harga batch-nya diatur.</li>}
                    {c!.tanpaCabang > 0 && (
                      <li>
                        {c!.tanpaCabang} ban belum punya cabang dan tidak bisa dijual kasir.{' '}
                        <Link href="/admin/stok-ban?cb=tanpa" className="font-semibold underline underline-offset-2">Tetapkan baris tanpa cabang</Link> dulu kalau ban itu milik cabang ini.
                      </li>
                    )}
                    <li>Sesudah aktif, impor dan sinkron pricelist untuk cabang ini ditolak, dan isian stok serta harga di Stok ban dan Produk situs terkunci.</li>
                    <li>Belum ada jalan kembali ke mode sheet.</li>
                  </ul>
                  <TextField id={`kode-${b.id}`} label="Kode nota" name="kodeNota" defaultValue={saranKode(b.name)} required minLength={2} maxLength={5} pattern="[A-Za-z]{2,5}" hint="2 sampai 5 huruf, dipakai di depan nomor transaksi, mis. BTU-261120-0001." className="max-w-xs" />
                  <CheckField id={`yakin-${b.id}`} name="yakin" label={`Saya paham, aktifkan kasir untuk ${namaPendek(b.name)}`} />
                  <FormActions>
                    <SubmitButton pending="Mengaktifkan...">Aktifkan kasir</SubmitButton>
                  </FormActions>
                </form>
              )}
            </Section>
          )
        })}
      </div>

      {adaKasir && (
        <Section
          id="invarian"
          title="Pemeriksa stok kasir"
          description="Memastikan stok tiap baris sama dengan jumlah sisa batch, dan harganya sama dengan harga batch terdepan."
          actions={<Link href="/admin/kasir/pengaturan?periksa=1#invarian" className="adm-btn-line adm-btn-sm">Periksa sekarang</Link>}
        >
          {periksa ? (
            periksa.masalah.length ? (
              <div role="alert" className="space-y-1 text-sm">
                <p className="font-semibold text-red-800">{periksa.masalah.length} ketidakcocokan dari {periksa.diperiksa} baris.</p>
                <ul className="list-disc pl-5 text-ink">{periksa.masalah.slice(0, 50).map((m, i) => <li key={i}>{nama(m.cabangId)}: {m.pesan}</li>)}</ul>
              </div>
            ) : (
              <p role="status" className="text-sm font-semibold text-ink">Semua cocok. {periksa.diperiksa} baris diperiksa di {periksa.cabang} cabang.</p>
            )
          ) : (
            <p className="text-sm text-mute">Tekan Periksa sekarang untuk menjalankan pemeriksaan.</p>
          )}
        </Section>
      )}

      <Section id="barang" title="Batch, koreksi, dan batas minimum" description="Cari ban atau produk situs, lalu buka untuk mengubah harga batch, mengoreksi stok, atau mengatur batas minimum.">
        <form role="search" className="flex flex-wrap items-end gap-2">
          <TextField className="min-w-0 flex-1 basis-60" id="cari-barang" label="Cari barang" name="q" defaultValue={q} placeholder="Ukuran, merek, atau nama produk" />
          <button className="adm-btn-line min-h-11">Cari</button>
        </form>
        {q && (
          <div className="mt-4">
            <DataTable<H>
              caption="Hasil cari barang"
              tanpaBingkai
              rows={hasil}
              rowKey={(h) => h.key}
              columns={[
                { key: 'nama', header: 'Barang', mobile: 'title', cell: (h) => <span className="font-semibold text-ink">{h.nama}</span> },
                { key: 'jenis', header: 'Jenis', cell: (h) => h.jenis },
                { key: 'cabang', header: 'Cabang', cell: (h) => nama(h.cabangId) },
                { key: 'stok', header: 'Stok', align: 'right', cell: (h) => h.stok },
                { key: 'harga', header: 'Harga', align: 'right', mobile: 'hide', cell: (h) => rp(h.harga) },
                { key: 'batas', header: 'Batas minimum', align: 'right', mobile: 'hide', cell: (h) => h.batas ?? '-' },
              ]}
              actions={(h) => <Link href={h.href} className="adm-btn-line adm-btn-sm" aria-label={`Buka ${h.nama}`}>Buka</Link>}
              empty={<Empty title="Tidak ada yang cocok">Baris tanpa cabang tidak ikut dicari.</Empty>}
            />
          </div>
        )}
      </Section>
    </PageBody>
  )
}
