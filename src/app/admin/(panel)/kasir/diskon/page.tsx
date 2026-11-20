import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, Empty, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { SubmitButton } from '@/components/admin/overlay'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'
import { putuskanDiskon } from '../../../kasir-actions'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const STATUS: Record<string, string> = { disetujui: 'Disetujui', ditolak: 'Ditolak', batal: 'Batal (nota di-void)', menunggu: 'Menunggu' }

// Antrean tinjau diskon nota dari admin cabang. Keputusan owner tidak mengubah transaksi; untuk membatalkan, pakai void.
export default async function TinjauDiskon() {
  await requireOwner()
  const [menunggu, selesai, branches] = await Promise.all([
    db.pengajuanHarga.findMany({ where: { tipe: 'diskon', status: 'menunggu' }, orderBy: { dibuat: 'asc' }, take: 200 }),
    db.pengajuanHarga.findMany({ where: { tipe: 'diskon', NOT: { status: 'menunggu' } }, orderBy: { diputuskan: 'desc' }, take: 30 }),
    db.branch.findMany({ select: { id: true, name: true } }),
  ])
  const idTrx = [...menunggu, ...selesai].map((p) => p.transaksiId).filter((x): x is number => x !== null)
  const idUser = [...new Set([...menunggu, ...selesai].flatMap((p) => [p.pengajuId, p.penyetujuId]).filter((x): x is number => x !== null))]
  const [trx, users] = await Promise.all([
    db.transaksi.findMany({ where: { id: { in: idTrx } }, select: { id: true, nomor: true, status: true } }),
    db.user.findMany({ where: { id: { in: idUser } }, select: { id: true, name: true, username: true } }),
  ])
  const t = (id: number | null) => trx.find((x) => x.id === id)
  const orang = (id: number | null) => {
    const u = users.find((x) => x.id === id)
    return u ? u.name || u.username : '-'
  }
  const cabang = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  type P = (typeof menunggu)[number]
  const nota = (p: P) => {
    const x = t(p.transaksiId)
    return x ? <Link href={`/admin/nota/${x.id}`} className="font-semibold text-ink underline underline-offset-2">{x.nomor}</Link> : '-'
  }
  const kolom = [
    { key: 'nota', header: 'Nota', mobile: 'title' as const, cell: nota },
    { key: 'waktu', header: 'Waktu', cell: (p: P) => waktuWib(p.dibuat) },
    { key: 'cabang', header: 'Cabang', cell: (p: P) => cabang(p.cabangId) },
    { key: 'admin', header: 'Admin', cell: (p: P) => orang(p.pengajuId) },
    { key: 'diskon', header: 'Diskon', align: 'right' as const, cell: (p: P) => <span className="font-semibold">{rp(p.hargaLama - p.hargaBaru)}</span> },
    { key: 'nilai', header: 'Subtotal ke total', mobile: 'hide' as const, cell: (p: P) => `${rp(p.hargaLama)} ke ${rp(p.hargaBaru)}` },
    { key: 'alasan', header: 'Alasan', cell: (p: P) => <span className="line-clamp-2">{p.alasan}</span> },
  ]

  return (
    <PageBody>
      <PageHeader title="Tinjau diskon" note="Diskon nota dari admin cabang. Transaksinya sudah tersimpan dan tidak berubah karena keputusan di sini. Kalau nota perlu dibatalkan, buka notanya lalu void." />
      <SegarkanSaatSiaran jenis={['pengajuan']} />
      {menunggu.length ? (
        <DataTable<P>
          caption="Diskon menunggu tinjauan"
          rows={menunggu}
          rowKey={(p) => p.id}
          columns={kolom}
          actionsBelow
          actions={(p) => (
            <span className="flex flex-wrap justify-end gap-2">
              <form action={putuskanDiskon}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="keputusan" value="ditolak" />
                <SubmitButton className="adm-btn-line adm-btn-sm min-h-11" pending="Memproses...">Tolak</SubmitButton>
              </form>
              <form action={putuskanDiskon}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="keputusan" value="disetujui" />
                <SubmitButton className="adm-btn adm-btn-sm min-h-11" pending="Memproses...">Setujui</SubmitButton>
              </form>
            </span>
          )}
        />
      ) : (
        <Empty title="Tidak ada diskon yang menunggu">Diskon baru dari admin cabang akan muncul di sini.</Empty>
      )}
      {selesai.length > 0 && (
        <Section title="Sudah ditinjau" description="30 keputusan terakhir.">
          <DataTable<P>
            caption="Diskon yang sudah ditinjau"
            tanpaBingkai
            rows={selesai}
            rowKey={(p) => p.id}
            columns={[
              ...kolom.filter((k) => k.key !== 'nilai'),
              { key: 'status', header: 'Keputusan', cell: (p: P) => <Badge tone={p.status === 'disetujui' ? 'dark' : 'outline'}>{STATUS[p.status] ?? p.status}</Badge> },
              { key: 'oleh', header: 'Oleh', mobile: 'hide', cell: (p: P) => (p.penyetujuId ? orang(p.penyetujuId) : '-') },
            ]}
          />
        </Section>
      )}
    </PageBody>
  )
}
