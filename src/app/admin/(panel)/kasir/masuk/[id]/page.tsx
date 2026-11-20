import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { JENIS_PEMASOK_LABEL, leadTimeHari, SUMBER_LABEL, type JenisPemasok, type Sumber } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const tanggalLabel = (d: Date) => waktuWib(d).replace(/, \d{2}\.\d{2}$/, '')
const STATUS: Record<string, string> = { menunggu: 'Menunggu owner', disetujui: 'Disetujui', ditolak: 'Ditolak, harga lama' }

// Rincian satu penerimaan: kepala, baris, batch yang terbentuk, dan status usulan harga.
export default async function RincianBarangMasuk({ params }: PageProps<'/admin/kasir/masuk/[id]'>) {
  const s = await requireUser()
  const { id } = await params
  const k = await db.barangMasuk.findUnique({ where: { id: Number(id) || 0 }, include: { detail: { orderBy: { id: 'asc' } } } })
  if (!k) notFound()
  if (s.role !== 'OWNER' && s.branchId !== k.cabangId) redirect('/admin/kasir/masuk?err=' + encodeURIComponent('Penerimaan itu milik cabang lain'))
  const [cabang, batch, pengajuan] = await Promise.all([
    db.branch.findUnique({ where: { id: k.cabangId }, select: { name: true } }),
    db.batchStok.findMany({ where: { id: { in: k.detail.map((d) => d.batchId).filter((x): x is number => x !== null) } }, select: { id: true, hargaJual: true, sisa: true } }),
    db.pengajuanHarga.findMany({ where: { id: { in: k.detail.map((d) => d.pengajuanHargaId).filter((x): x is number => x !== null) } }, select: { id: true, status: true } }),
  ])
  const lead = leadTimeHari(k.tanggalPesan, k.tanggalTerima)
  const total = k.detail.reduce((n, d) => n + d.jumlah, 0)
  type D = (typeof k.detail)[number]
  const statusHarga = (d: D) => {
    const p = pengajuan.find((x) => x.id === d.pengajuanHargaId)
    if (p) return <Badge tone={p.status === 'menunggu' ? 'light' : p.status === 'disetujui' ? 'dark' : 'outline'}>{STATUS[p.status] ?? p.status}</Badge>
    return d.hargaJual === d.hargaLama ? <span className="text-mute">harga tetap</span> : <span className="text-mute">diubah owner</span>
  }

  return (
    <PageBody>
      <PageHeader title={k.nomorPenerimaan} note={`${cabang ? namaPendek(cabang.name) : `Cabang ${k.cabangId}`}, dicatat ${k.namaPengguna} pada ${waktuWib(k.dibuat)}`} actions={<Link href="/admin/kasir/masuk" className="adm-btn-line min-h-11">Kembali ke daftar</Link>} />
      <Section title="Penerimaan">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-mute">Pemasok</dt>
            <dd className="font-semibold text-ink">{k.pemasok}</dd>
            <dd className="text-mute">{JENIS_PEMASOK_LABEL[k.jenisPemasok as JenisPemasok] ?? k.jenisPemasok}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Tanggal pesan</dt>
            <dd className="font-semibold text-ink">{k.tanggalPesan ? tanggalLabel(k.tanggalPesan) : '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-mute">Tanggal terima</dt>
            <dd className="font-semibold text-ink">{tanggalLabel(k.tanggalTerima)}</dd>
            {lead !== null && <dd className="text-mute">{lead} hari sejak dipesan</dd>}
          </div>
          <div>
            <dt className="text-xs text-mute">Jumlah</dt>
            <dd className="font-semibold text-ink">{total} pcs, {k.detail.length} barang</dd>
          </div>
        </dl>
        {k.catatan && <p className="mt-4 border-t border-line pt-3 text-sm"><span className="text-xs text-mute">Catatan: </span>{k.catatan}</p>}
      </Section>
      <DataTable<D>
        caption="Barang yang diterima"
        rows={k.detail}
        rowKey={(d) => d.id}
        columns={[
          { key: 'nama', header: 'Barang', mobile: 'title', cell: (d) => <span className="block"><span className="block font-semibold text-ink">{d.nama}</span><span className="text-xs text-mute">{SUMBER_LABEL[d.sumber as Sumber] ?? d.sumber}</span></span> },
          { key: 'jumlah', header: 'Jumlah', align: 'right', cell: (d) => `${d.jumlah} pcs` },
          { key: 'beli', header: 'Harga beli', align: 'right', cell: (d) => (d.hargaBeli === null ? '-' : rp(d.hargaBeli)) },
          { key: 'usulan', header: 'Harga jual diisi', align: 'right', cell: (d) => rp(d.hargaJual) },
          { key: 'batch', header: 'Harga batch sekarang', align: 'right', cell: (d) => { const b = batch.find((x) => x.id === d.batchId); return b ? <span className="block">{rp(b.hargaJual)}<span className="block text-xs text-mute">sisa {b.sisa}</span></span> : '-' } },
          { key: 'status', header: 'Harga', cell: statusHarga },
        ]}
      />
      <p className="text-xs text-mute">Harga lama barang saat dicatat dipakai untuk batch baru sampai owner menyetujui usulan harga dari admin. Usulan yang menunggu ada di Tinjau pengajuan (owner).</p>
    </PageBody>
  )
}
