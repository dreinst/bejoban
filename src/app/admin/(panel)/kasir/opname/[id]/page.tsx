import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { muatBarangCabang } from '@/lib/kasir/katalog'
import { STATUS_OPNAME_LABEL, type StatusOpname } from '@/lib/kasir/opname'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'
import { finalkanOpnameAksi, hapusBarisOpnameAksi, hapusOpnameAksi, statusOpnameAksi } from '../../../../kasir-actions'
import { IsiBarisOpname } from './isi-baris'

const tanda = (n: number) => (n > 0 ? `+${n}` : String(n))

// Satu opname: baris yang sudah diisi, pengisian baris, kirim ke owner, dan finalisasi owner.
export default async function RincianOpname({ params }: PageProps<'/admin/kasir/opname/[id]'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const { id } = await params
  const o = await db.stokOpname.findUnique({ where: { id: Number(id) || 0 }, include: { detail: { orderBy: { id: 'asc' } } } })
  if (!o) notFound()
  if (!owner && s.branchId !== o.cabangId) redirect('/admin/kasir/opname?err=' + encodeURIComponent('Opname itu milik cabang lain'))
  const status = o.status as StatusOpname
  const bolehUbah = status === 'draft' || (status === 'review' && owner)
  const [cabang, barang, finalisator] = await Promise.all([
    db.branch.findUnique({ where: { id: o.cabangId }, select: { name: true } }),
    status === 'final' ? Promise.resolve([]) : muatBarangCabang(o.cabangId),
    o.finalisatorId ? db.user.findUnique({ where: { id: o.finalisatorId }, select: { name: true, username: true } }) : null,
  ])
  const namaCabang = cabang ? namaPendek(cabang.name) : `Cabang ${o.cabangId}`
  const stokSekarang = new Map(barang.map((b) => [`${b.sumber}:${b.id}`, b.stok]))
  const sudah = Object.fromEntries(o.detail.map((d) => [`${d.sumber}:${d.barisId}`, d.stokFisik]))
  const adaSelisih = o.detail.filter((d) => d.selisih !== 0).length
  const field = { opname: String(o.id) }
  type D = (typeof o.detail)[number]

  return (
    <PageBody>
      <PageHeader
        title={`Opname ${namaCabang}`}
        note={`Dimulai ${waktuWib(o.tanggal)} oleh ${o.namaPenginput}${o.catatan ? `. ${o.catatan}` : ''}`}
        actions={<Link href="/admin/kasir/opname" className="adm-btn-line min-h-11">Kembali ke daftar</Link>}
      />
      <SegarkanSaatSiaran jenis={['stok']} cabangId={o.cabangId} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status === 'final' ? 'outline' : status === 'review' ? 'dark' : 'light'}>{STATUS_OPNAME_LABEL[status] ?? status}</Badge>
        <span className="text-sm text-mute">{o.detail.length} baris, {adaSelisih} dengan selisih</span>
        {status === 'final' && o.difinalkan && <span className="text-sm text-mute">Difinalkan {waktuWib(o.difinalkan)}{finalisator ? ` oleh ${finalisator.name || finalisator.username}` : ''}</span>}
      </div>

      {bolehUbah && (
        <Section title="Isi stok fisik" description="Cari barang, isi jumlah yang dihitung di toko, lalu simpan. Barang yang sudah diisi bisa dipilih lagi untuk diubah.">
          <IsiBarisOpname opnameId={o.id} cabang={namaCabang} barang={barang} sudah={sudah} />
        </Section>
      )}

      <DataTable<D>
        caption="Baris opname"
        rows={o.detail}
        rowKey={(d) => d.id}
        columns={[
          { key: 'nama', header: 'Barang', mobile: 'title', cell: (d) => <span className="font-semibold text-ink">{d.nama}</span> },
          { key: 'sistem', header: 'Stok sistem saat diisi', align: 'right', cell: (d) => d.stokSistem },
          { key: 'fisik', header: 'Stok fisik', align: 'right', cell: (d) => <b className="text-ink">{d.stokFisik}</b> },
          { key: 'selisih', header: 'Selisih', align: 'right', cell: (d) => (d.selisih ? <b className="text-ink">{tanda(d.selisih)}</b> : '0') },
          { key: 'alasan', header: 'Alasan', cell: (d) => d.alasanSelisih || '-' },
          status === 'final'
            ? { key: 'hasil', header: 'Stok saat final', align: 'right' as const, cell: (d: D) => (d.stokSaatFinal === null ? '-' : `${d.stokSaatFinal} ke ${d.stokAkhir}`) }
            : {
                key: 'sekarang',
                header: 'Stok sekarang',
                align: 'right' as const,
                cell: (d: D) => {
                  const n = stokSekarang.get(`${d.sumber}:${d.barisId}`)
                  if (n === undefined) return '-'
                  return (
                    <span className="block">
                      {n}
                      {n !== d.stokSistem && <span className="block text-xs text-mute">berubah sejak diisi, hasil {n + d.selisih}</span>}
                    </span>
                  )
                },
              },
        ]}
        actions={
          bolehUbah
            ? (d) => (
                <form action={hapusBarisOpnameAksi}>
                  <input type="hidden" name="opname" value={o.id} />
                  <input type="hidden" name="baris" value={d.id} />
                  <SubmitButton className="adm-btn-line adm-btn-sm min-h-11" pending="Menghapus...">Hapus</SubmitButton>
                </form>
              )
            : undefined
        }
        empty={<p className="py-4 text-sm text-mute">Belum ada baris. Cari barang di atas lalu isi stok fisiknya.</p>}
      />
      {status !== 'final' && <p className="text-xs text-mute">Saat final, selisih tiap baris ditambahkan ke stok yang ada saat itu, jadi penjualan sesudah baris diisi tetap terhitung. Kalau hasilnya akan minus, finalisasi ditolak dan baris itu perlu dihitung ulang.</p>}

      {status !== 'final' && (
        <div className="adm-card flex flex-wrap items-center gap-3 p-4">
          {status === 'draft' && (
            <form action={statusOpnameAksi}>
              <input type="hidden" name="opname" value={o.id} />
              <input type="hidden" name="ke" value="review" />
              <SubmitButton className={owner ? 'adm-btn-line min-h-11' : 'adm-btn min-h-11'} pending="Mengirim...">Kirim ke owner</SubmitButton>
            </form>
          )}
          {status === 'review' && owner && (
            <form action={statusOpnameAksi}>
              <input type="hidden" name="opname" value={o.id} />
              <input type="hidden" name="ke" value="draft" />
              <SubmitButton className="adm-btn-line min-h-11" pending="Memproses...">Kembalikan ke draft</SubmitButton>
            </form>
          )}
          {status === 'review' && !owner && <p className="text-sm text-mute">Menunggu owner meninjau dan memfinalkan.</p>}
          {owner && o.detail.length > 0 && (
            <ConfirmDialog
              trigger="Finalkan"
              triggerClassName="adm-btn min-h-11"
              title="Finalkan opname?"
              message={
                <>
                  <p>{adaSelisih} dari {o.detail.length} baris punya selisih. Selisihnya akan diterapkan ke stok {namaCabang} sekarang. Pengurangan mengambil batch tertua dulu, penambahan menjadi batch baru dengan harga batch terdepan.</p>
                  <p>Opname yang sudah final tidak bisa diubah lagi.</p>
                </>
              }
              alternative={{ action: finalkanOpnameAksi, fields: field, label: 'Finalkan' }}
            />
          )}
          {status === 'draft' && (
            <span className="ml-auto">
              <ConfirmDialog
                trigger="Hapus draft"
                triggerClassName="adm-btn-ghost min-h-11"
                title="Hapus draft opname?"
                message={<p>{o.detail.length} baris yang sudah diisi ikut terhapus. Stok tidak berubah.</p>}
                confirm={{ action: hapusOpnameAksi, fields: field, label: 'Hapus draft' }}
              />
            </span>
          )}
        </div>
      )}
    </PageBody>
  )
}
