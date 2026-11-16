import { db } from '@/lib/db'
import { requireUser, canEditBranch } from '@/lib/auth'
import { moveBranch, saveBranch } from '../../actions'
import { Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, Thumb } from '@/components/admin/data-table'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { CloseButton, Drawer, SubmitButton } from '@/components/admin/overlay'
import { ReorderButtons } from '@/components/admin/row-controls'
import { ImageField } from '@/components/admin/image-input'
import { FormPulih } from '@/components/admin/form-pulih'

type Cabang = { id: number; name: string; whatsapp: string; address: string; hours: string; instagram: string; mapsUrl: string; services: string; photo: string }

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormCabang({ b, tanpaBatal }: { b?: Cabang; tanpaBatal?: boolean }) {
  return (
    <form action={saveBranch}>
      <input type="hidden" name="id" value={b?.id ?? 0} />
      <FormGrid>
        <TextField label="Nama cabang" name="name" defaultValue={b?.name} required maxLength={100} autoComplete="off" />
        <TextField
          label="WhatsApp"
          name="whatsapp"
          defaultValue={b?.whatsapp}
          placeholder="0823..."
          inputMode="tel"
          maxLength={20}
          hint="Nomor tombol WhatsApp cabang ini di situs. Kalau owner mengisi satu Nomor WhatsApp utama (Situs, Tautan WhatsApp), nomor utama itulah yang dipakai di situs."
        />
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
        {!tanpaBatal && <CloseButton />}
        <SubmitButton>{b ? 'Simpan perubahan' : 'Tambah cabang'}</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function Cabang() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const list = (await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] })).filter((b) => canEditBranch(s, b.id))
  const tambah = (kosong = false) => owner ? (
    <Drawer trigger="+ Tambah cabang" triggerClassName="adm-btn" title="Tambah cabang" kunci={kosong ? 'tambah-cabang-kosong' : undefined} description="Cabang baru masuk di urutan terakhir. Geser dengan tombol naik turun di tabel.">
      <FormCabang />
    </Drawer>
  ) : undefined

  // Admin cabang hanya punya satu cabang, jadi formnya langsung tampil tanpa tabel dan tombol Ubah.
  if (!owner) {
    const b = list[0]
    return (
      <PageBody width="form">
        <PageHeader title="Cabang" note="Data cabang kamu: alamat, jam buka, WhatsApp, dan foto yang tampil di situs." />
        {b ? (
          <div className="adm-card p-5">
            <FormPulih nama="cabang">
              <FormCabang b={b} tanpaBatal />
            </FormPulih>
          </div>
        ) : (
          <Empty title="Akun ini belum punya cabang">Minta owner mengatur cabang untuk akun kamu di Pengaturan, tab Pengguna.</Empty>
        )}
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader title="Cabang" note="Alamat, jam buka, WhatsApp, dan foto yang tampil di situs." actions={tambah()} />
      <DataTable
        caption="Daftar cabang"
        rows={list}
        rowKey={(b) => b.id}
        thumb={(b) => <Thumb src={b.photo} alt={`Foto ${b.name}`} variant="photo" />}
        columns={[
          { key: 'nama', header: 'Nama', cell: (b) => <span className="font-semibold text-ink">{b.name}</span> },
          { key: 'alamat', header: 'Alamat', mobileLabel: false, cell: (b) => <span className="md:block md:max-w-xs md:truncate" title={b.address}><span className="md:hidden">Alamat: </span>{b.address || '-'}</span> },
          { key: 'wa', header: 'WhatsApp', className: 'whitespace-nowrap', cell: (b) => b.whatsapp || '-' },
          { key: 'jam', header: 'Jam buka', className: 'whitespace-nowrap', cell: (b) => b.hours || '-' },
          ...(owner
            ? [
                {
                  key: 'urutan',
                  header: 'Urutan',
                  className: 'w-28',
                  mobile: 'hide' as const,
                  cell: (b: (typeof list)[number]) => {
                    const i = list.indexOf(b)
                    return <ReorderButtons action={moveBranch} id={b.id} label={b.name} first={i === 0} last={i === list.length - 1} />
                  },
                },
              ]
            : []),
        ]}
        lainnya={
          owner
            ? (b) => (
                <div className="flex min-h-11 items-center justify-between gap-3 px-2 text-sm font-semibold">
                  Urutan
                  <ReorderButtons action={moveBranch} id={b.id} label={b.name} first={list.indexOf(b) === 0} last={list.indexOf(b) === list.length - 1} />
                </div>
              )
            : undefined
        }
        actions={(b) => (
          <Drawer trigger="Ubah" triggerLabel={`Ubah ${b.name}`} title={`Ubah cabang ${b.name}`}>
            <FormCabang b={b} />
          </Drawer>
        )}
        empty={<Empty title="Belum ada cabang" action={tambah(true)}>Tambah cabang pertama. Datanya tampil di situs dan jadi pilihan di harga dan stok.</Empty>}
      />
    </PageBody>
  )
}
