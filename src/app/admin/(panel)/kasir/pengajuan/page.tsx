import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { SubmitButton } from '@/components/admin/overlay'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'
import { putuskanDiskon, putuskanRestockAksi } from '../../../kasir-actions'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const STATUS: Record<string, string> = { disetujui: 'Disetujui', ditolak: 'Ditolak', batal: 'Batal (nota di-void)', menunggu: 'Menunggu' }

// Antrean tinjau owner: usulan harga restock dari barang masuk dan diskon nota dari admin cabang.
// Keputusan diskon tidak mengubah transaksi (untuk membatalkan, pakai void). Keputusan restock mengubah harga batch.
export default async function TinjauPengajuan() {
  await requireOwner()
  const [menunggu, selesai, branches, restock, restockSelesai] = await Promise.all([
    db.pengajuanHarga.findMany({ where: { tipe: 'diskon', status: 'menunggu' }, orderBy: { dibuat: 'asc' }, take: 200 }),
    db.pengajuanHarga.findMany({ where: { tipe: 'diskon', NOT: { status: 'menunggu' } }, orderBy: { diputuskan: 'desc' }, take: 30 }),
    db.branch.findMany({ select: { id: true, name: true } }),
    db.pengajuanHarga.findMany({ where: { tipe: 'restock', status: 'menunggu' }, orderBy: { dibuat: 'asc' }, take: 200 }),
    db.pengajuanHarga.findMany({ where: { tipe: 'restock', NOT: { status: 'menunggu' } }, orderBy: { diputuskan: 'desc' }, take: 30 }),
  ])
  const semuaRestock = [...restock, ...restockSelesai]
  const [batchR, detailR] = await Promise.all([
    db.batchStok.findMany({ where: { id: { in: semuaRestock.map((p) => p.batchId).filter((x): x is number => x !== null) } }, select: { id: true, sisa: true, jumlahAwal: true, hargaJual: true } }),
    db.detailBarangMasuk.findMany({ where: { pengajuanHargaId: { in: semuaRestock.map((p) => p.id) } }, select: { pengajuanHargaId: true, nama: true, barangMasuk: { select: { id: true, nomorPenerimaan: true } } } }),
  ])
  const idTrx = [...menunggu, ...selesai].map((p) => p.transaksiId).filter((x): x is number => x !== null)
  const idUser = [...new Set([...menunggu, ...selesai, ...semuaRestock].flatMap((p) => [p.pengajuId, p.penyetujuId]).filter((x): x is number => x !== null))]
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
    return (
      <span className="block">
        {x ? <Link href={`/admin/nota/${x.id}`} className="max-md:inline-flex max-md:min-h-11 max-md:items-center whitespace-nowrap font-semibold text-ink underline underline-offset-2">{x.nomor}</Link> : '-'}
        <span className="block text-xs text-mute">{waktuWib(p.dibuat)}</span>
      </span>
    )
  }
  const kolom = [
    { key: 'nota', header: 'Nota', mobile: 'title' as const, cell: nota },
    { key: 'cabang', header: 'Cabang', sembunyiTablet: true, cell: (p: P) => cabang(p.cabangId) },
    { key: 'admin', header: 'Admin', cell: (p: P) => orang(p.pengajuId) },
    { key: 'diskon', header: 'Diskon', align: 'right' as const, cell: (p: P) => <span className="whitespace-nowrap font-semibold">{rp(p.hargaLama - p.hargaBaru)}</span> },
    { key: 'nilai', header: 'Subtotal ke total', mobile: 'hide' as const, cell: (p: P) => `${rp(p.hargaLama)} ke ${rp(p.hargaBaru)}` },
    { key: 'alasan', header: 'Alasan', cell: (p: P) => <span className="line-clamp-2">{p.alasan}</span> },
  ]

  type R = (typeof restock)[number]
  const det = (p: R) => detailR.find((d) => d.pengajuanHargaId === p.id)
  const bt = (p: R) => batchR.find((b) => b.id === p.batchId)
  const kolomR = [
    {
      key: 'barang',
      header: 'Barang',
      mobile: 'title' as const,
      cell: (p: R) => {
        const d = det(p)
        return (
          <span className="block">
            <span className="block font-semibold text-ink">{d?.nama ?? p.kodeProduk}</span>
            {d && <Link href={`/admin/kasir/masuk/${d.barangMasuk.id}`} className="max-md:inline-flex max-md:min-h-11 max-md:items-center text-xs text-mute underline underline-offset-2">{d.barangMasuk.nomorPenerimaan}</Link>}
          </span>
        )
      },
    },
    { key: 'dari', header: 'Dari', cell: (p: R) => <span className="block">{orang(p.pengajuId)}<span className="block text-xs text-mute">{cabang(p.cabangId)}</span></span> },
    {
      key: 'harga',
      header: 'Harga lama ke usulan',
      cell: (p: R) => (
        <span className="block">
          <span className="whitespace-nowrap">{p.hargaLama ? rp(p.hargaLama) : 'belum ada'} ke <b className="text-ink">{rp(p.hargaBaru)}</b></span>
          {bt(p) && <span className="block text-xs text-mute">batch sisa {bt(p)!.sisa} dari {bt(p)!.jumlahAwal}</span>}
        </span>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader title="Tinjau pengajuan" note="Usulan harga jual dari barang masuk dan diskon nota dari admin cabang." />
      <SegarkanSaatSiaran jenis={['pengajuan']} />
      <Section title="Harga barang masuk" description="Sampai diputuskan, batch baru dijual dengan harga lama. Setujui untuk memakai harga usulan pada batch itu. Tolak untuk tetap memakai harga lama.">
        {restock.length ? (
          <DataTable<R>
            caption="Usulan harga menunggu keputusan"
            tanpaBingkai
            rows={restock}
            rowKey={(p) => p.id}
            columns={kolomR}
            actionsBelow
            actions={(p) => (
              <span className="flex flex-wrap justify-end gap-2">
                <form action={putuskanRestockAksi}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="keputusan" value="ditolak" />
                  <SubmitButton className="adm-btn-line adm-btn-sm min-h-11" pending="Memproses...">Tolak</SubmitButton>
                </form>
                <form action={putuskanRestockAksi}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="keputusan" value="disetujui" />
                  <SubmitButton className="adm-btn adm-btn-sm min-h-11" pending="Memproses...">Setujui {rp(p.hargaBaru)}</SubmitButton>
                </form>
              </span>
            )}
          />
        ) : (
          <p className="text-sm text-mute">Tidak ada usulan harga yang menunggu.</p>
        )}
        {restockSelesai.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer py-2 text-sm font-semibold text-ink">Sudah diputuskan ({restockSelesai.length} terakhir)</summary>
            <DataTable<R>
              caption="Usulan harga yang sudah diputuskan"
              tanpaBingkai
              rows={restockSelesai}
              rowKey={(p) => p.id}
              columns={[...kolomR, { key: 'status', header: 'Keputusan', cell: (p: R) => <Badge tone={p.status === 'disetujui' ? 'dark' : 'outline'}>{STATUS[p.status] ?? p.status}</Badge> }]}
            />
          </details>
        )}
      </Section>
      <h2 className="font-display text-lg font-extrabold text-ink">Diskon nota</h2>
      <p className="-mt-3 text-sm text-mute">Transaksinya sudah tersimpan dan tidak berubah karena keputusan di sini. Kalau nota perlu dibatalkan, buka notanya lalu void.</p>
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
        <p className="text-sm text-mute">Tidak ada diskon yang menunggu.</p>
      )}
      {selesai.length > 0 && (
        <Section title="Diskon sudah ditinjau" description="30 keputusan terakhir.">
          <DataTable<P>
            caption="Diskon yang sudah ditinjau"
            tanpaBingkai
            rows={selesai}
            rowKey={(p) => p.id}
            columns={[
              ...kolom.filter((k) => k.key !== 'nilai' && k.key !== 'admin'),
              { key: 'status', header: 'Keputusan', cell: (p: P) => <Badge tone={p.status === 'disetujui' ? 'dark' : 'outline'}>{STATUS[p.status] ?? p.status}</Badge> },
            ]}
          />
        </Section>
      )}
    </PageBody>
  )
}
