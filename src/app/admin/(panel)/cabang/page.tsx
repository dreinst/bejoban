import { db } from '@/lib/db'
import { requireUser, canEditBranch } from '@/lib/auth'
import { moveBranch, saveBranch } from '../../actions'
import { Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, Thumb } from '@/components/admin/data-table'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { CloseButton, Drawer, SubmitButton } from '@/components/admin/overlay'
import { ReorderButtons } from '@/components/admin/row-controls'
import { ImageField } from '@/components/admin/image-input'

type Cabang = { id: number; name: string; whatsapp: string; address: string; hours: string; instagram: string; mapsUrl: string; services: string; photo: string }

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormCabang({ b }: { b?: Cabang }) {
  return (
    <form action={saveBranch}>
      <input type="hidden" name="id" value={b?.id ?? 0} />
      <FormGrid>
        <TextField label="Nama cabang" name="name" defaultValue={b?.name} required maxLength={100} autoComplete="off" />
        <TextField label="WhatsApp" name="whatsapp" defaultValue={b?.whatsapp} placeholder="0823..." inputMode="tel" maxLength={20} />
        <TextField className="sm:col-span-2" label="Alamat" name="address" defaultValue={b?.address} maxLength={300} />
        <TextField label="Jam buka" name="hours" defaultValue={b?.hours ?? '08.00 sampai 17.00'} maxLength={60} />
        <TextField label="Instagram (tanpa @)" name="instagram" defaultValue={b?.instagram} maxLength={60} />
        <TextField label="Link Google Maps" name="mapsUrl" defaultValue={b?.mapsUrl} maxLength={500} />
        <TextField label="Layanan" name="services" defaultValue={b?.services} maxLength={200} />
        <div className="sm:col-span-2">
          <ImageField label="Foto cabang" name="photo" value={b?.photo} preset="branch" />
        </div>
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{b ? 'Simpan perubahan' : 'Tambah cabang'}</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function Cabang() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const list = (await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] })).filter((b) => canEditBranch(s, b.id))
  const tambah = owner ? (
    <Drawer trigger="+ Tambah cabang" triggerClassName="adm-btn" title="Tambah cabang" description="Cabang baru masuk di urutan terakhir. Geser dengan tombol naik turun di tabel.">
      <FormCabang />
    </Drawer>
  ) : undefined

  return (
    <PageBody>
      <PageHeader title={owner ? 'Cabang' : 'Data cabang saya'} note="Alamat, jam buka, WhatsApp, dan foto yang tampil di situs." actions={tambah} />
      <DataTable
        caption="Daftar cabang"
        rows={list}
        rowKey={(b) => b.id}
        thumb={(b) => <Thumb src={b.photo} alt={`Foto ${b.name}`} variant="photo" />}
        columns={[
          { key: 'nama', header: 'Nama', cell: (b) => <span className="font-semibold text-ink">{b.name}</span> },
          { key: 'alamat', header: 'Alamat', cell: (b) => <span className="block max-w-xs truncate max-md:max-w-none" title={b.address}>{b.address || '-'}</span> },
          { key: 'wa', header: 'WhatsApp', className: 'whitespace-nowrap', cell: (b) => b.whatsapp || '-' },
          { key: 'jam', header: 'Jam buka', className: 'whitespace-nowrap', cell: (b) => b.hours || '-' },
          ...(owner
            ? [
                {
                  key: 'urutan',
                  header: 'Urutan',
                  className: 'w-28',
                  cell: (b: (typeof list)[number]) => {
                    const i = list.indexOf(b)
                    return <ReorderButtons action={moveBranch} id={b.id} label={b.name} first={i === 0} last={i === list.length - 1} />
                  },
                },
              ]
            : []),
        ]}
        actions={(b) => (
          <Drawer trigger="Ubah" triggerLabel={`Ubah ${b.name}`} title={`Ubah cabang ${b.name}`}>
            <FormCabang b={b} />
          </Drawer>
        )}
        empty={<Empty title="Belum ada cabang">Tambah cabang pertama lewat tombol di kanan atas. Datanya tampil di situs dan jadi pilihan di harga dan stok.</Empty>}
      />
    </PageBody>
  )
}
