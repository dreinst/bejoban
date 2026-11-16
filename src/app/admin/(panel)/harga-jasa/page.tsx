import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteService, moveService, saveService } from '../../fitur-actions'
import { Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar } from '@/components/admin/data-table'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'
import { ReorderButtons } from '@/components/admin/row-controls'

type Jasa = {
  id: number
  groupName: string
  name: string
  variant: string
  ringMin: number | null
  ringMax: number | null
  minDiameter: number | null
  price: number | null
  unit: string
  altLabel: string
  altPrice: number | null
  note: string
  keywords: string
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const harga = (r: Jasa) => {
  if (r.price === null) return <span className="text-mute">Tanya admin</span>
  const utama = r.price === 0 ? 'Gratis' : rp(r.price)
  return (
    <span className="whitespace-nowrap">
      {utama}
      {r.altPrice !== null && <span className="text-mute"> · {r.altLabel || 'harga kedua'} {rp(r.altPrice)}</span>}
    </span>
  )
}
const rentang = (r: Jasa) => {
  if (r.ringMin !== null && r.ringMax !== null) return r.ringMin === r.ringMax ? `R${r.ringMin}` : `R${r.ringMin} sampai R${r.ringMax}`
  if (r.ringMin !== null) return `R${r.ringMin} ke atas`
  if (r.ringMax !== null) return `sampai R${r.ringMax}`
  return '-'
}

// Satu form untuk tambah dan ubah, dipakai di panel samping. Urutan diatur dengan tombol naik turun di tabel.
function FormJasa({ r }: { r?: Jasa }) {
  return (
    <form action={saveService}>
      <input type="hidden" name="id" value={r?.id ?? 0} />
      <FormGrid>
        <TextField label="Kelompok" name="groupName" defaultValue={r?.groupName ?? ''} placeholder="Spooring" maxLength={60} hint="Kosong berarti sama dengan nama." />
        <TextField label="Nama" name="name" defaultValue={r?.name ?? ''} required maxLength={80} />
        <TextField label="Variasi" name="variant" defaultValue={r?.variant ?? ''} placeholder="R12 sampai R15" maxLength={80} />
        <TextField label="Satuan" name="unit" defaultValue={r?.unit ?? ''} placeholder="per roda" maxLength={40} />
        <TextField label="Harga (Rp)" name="price" defaultValue={r?.price ?? ''} inputMode="numeric" hint="Isi 0 untuk gratis. Kosong berarti chatbot menyerahkan ke admin." />
        <TextField label="Diameter ban mulai" name="minDiameter" defaultValue={r?.minDiameter ?? ''} inputMode="numeric" placeholder="31" />
        <TextField label="Ring dari" name="ringMin" defaultValue={r?.ringMin ?? ''} inputMode="numeric" />
        <TextField label="Ring sampai" name="ringMax" defaultValue={r?.ringMax ?? ''} inputMode="numeric" />
        <TextField label="Label harga kedua" name="altLabel" defaultValue={r?.altLabel ?? ''} placeholder="paket" maxLength={40} />
        <TextField label="Harga kedua (Rp)" name="altPrice" defaultValue={r?.altPrice ?? ''} inputMode="numeric" />
        <TextField className="sm:col-span-2" label="Catatan" name="note" defaultValue={r?.note ?? ''} maxLength={200} />
        <TextField className="sm:col-span-2" label="Kata kunci pencarian bot" name="keywords" defaultValue={r?.keywords ?? ''} placeholder="spooring, spooling" maxLength={200} hint="Pisahkan dengan koma." />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{r ? 'Simpan perubahan' : 'Tambah jasa'}</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function HargaJasa({ searchParams }: PageProps<'/admin/harga-jasa'>) {
  await requireOwner()
  const q = String((await searchParams).q ?? '').trim().slice(0, 60)
  const semua = await db.servicePrice.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
  const key = q.toLowerCase()
  const list = q ? semua.filter((r) => [r.groupName, r.name, r.variant, r.keywords].some((t) => t.toLowerCase().includes(key))) : semua
  const tambah = (
    <Drawer trigger="+ Tambah jasa" triggerClassName="adm-btn" title="Tambah jasa" description="Jasa baru masuk di urutan terakhir. Geser dengan tombol naik turun di tabel.">
      <FormJasa />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader
        title="Harga jasa"
        note="Dipakai chatbot untuk menjawab harga jasa lewat WhatsApp. Jasa yang tidak ada di sini atau harganya kosong diserahkan ke admin. Harga jasa tidak tampil di situs."
        actions={tambah}
      />
      <ListToolbar
        count={list.length}
        total={q ? semua.length : undefined}
        noun="baris harga jasa"
        search={semua.length > 10 || q ? { placeholder: 'Cari nama atau kelompok jasa', value: q } : undefined}
      />
      <DataTable
        caption="Daftar harga jasa"
        rows={list}
        rowKey={(r) => r.id}
        columns={[
          { key: 'nama', header: 'Nama', mobile: 'title', cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
          { key: 'kelompok', header: 'Kelompok', cell: (r) => r.groupName },
          { key: 'variasi', header: 'Variasi', cell: (r) => r.variant || '-' },
          { key: 'harga', header: 'Harga', align: 'right', cell: harga },
          { key: 'satuan', header: 'Satuan', cell: (r) => r.unit || '-' },
          { key: 'ring', header: 'Rentang ring', className: 'whitespace-nowrap', cell: rentang },
          { key: 'kunci', header: 'Kata kunci', mobile: 'hide', className: 'max-w-[200px]', cell: (r) => r.keywords || '-' },
          { key: 'catatan', header: 'Catatan', mobile: 'hide', className: 'max-w-[200px]', cell: (r) => r.note || '-' },
          ...(q
            ? []
            : [
                {
                  key: 'urutan',
                  header: 'Urutan',
                  className: 'w-28',
                  mobileLabel: false,
                  cell: (r: (typeof list)[number]) => {
                    const i = list.indexOf(r)
                    return <ReorderButtons action={moveService} id={r.id} label={r.name} first={i === 0} last={i === list.length - 1} />
                  },
                },
              ]),
        ]}
        actions={(r) => {
          const nama = r.variant ? `${r.name} (${r.variant})` : r.name
          return (
            <>
              <Drawer trigger="Ubah" triggerLabel={`Ubah ${nama}`} title={`Ubah ${nama}`}>
                <FormJasa r={r} />
              </Drawer>
              <ConfirmDialog
                triggerLabel={`Hapus ${nama}`}
                title={`Hapus ${nama}?`}
                message={
                  <>
                    <p>Baris harga ini dihapus dan tidak bisa dikembalikan.</p>
                    <p className="text-mute">Chatbot tidak lagi menjawab harga ini dan menyerahkan pertanyaannya ke admin.</p>
                  </>
                }
                confirm={{ action: deleteService, fields: { id: r.id }, label: 'Hapus baris' }}
              />
            </>
          )
        }}
        empty={
          q ? (
            <Empty title="Jasa tidak ditemukan">Tidak ada jasa yang cocok dengan &quot;{q}&quot;. Periksa ejaannya atau hapus pencarian.</Empty>
          ) : (
            <Empty title="Belum ada harga jasa" action={tambah}>Tambah jasa pertama supaya chatbot bisa menjawab harganya.</Empty>
          )
        }
      />
    </PageBody>
  )
}
