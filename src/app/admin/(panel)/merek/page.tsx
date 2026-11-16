import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { aturanHapus } from '@/lib/admin/urutan'
import { deleteBrand, moveBrand, saveBrand, setBrandActive, setBrandByOrder } from '../../actions'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar, Thumb } from '@/components/admin/data-table'
import { CheckField, FormActions, FormGrid, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'
import { QuickToggle, ReorderButtons } from '@/components/admin/row-controls'
import { ImageField } from '@/components/admin/image-input'

type Merek = { id: number; name: string; logo: string; byOrder: boolean }

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormMerek({ b }: { b?: Merek }) {
  return (
    <form action={saveBrand}>
      <input type="hidden" name="id" value={b?.id ?? 0} />
      <FormGrid cols={1}>
        <TextField label="Nama merek" name="name" defaultValue={b?.name} required maxLength={60} autoComplete="off" />
        <ImageField label="Logo" name="logo" value={b?.logo} preset="brand" />
        <CheckField
          label="By order"
          name="byOrder"
          defaultChecked={b?.byOrder ?? false}
          hint='Merek ini tidak distok dan dipesan dulu. Di beranda diberi keterangan "by order", dan chatbot menjawab bahwa merek ini bisa dipesan kalau stoknya kosong.'
        />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{b ? 'Simpan perubahan' : 'Tambah merek'}</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function Merek({ searchParams }: PageProps<'/admin/merek'>) {
  await requireOwner()
  const q = String((await searchParams).q ?? '').trim().slice(0, 60)
  const semua = await db.brand.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true } } } })
  const list = q ? semua.filter((b) => b.name.toLowerCase().includes(q.toLowerCase())) : semua
  const nonaktif = semua.filter((b) => !b.aktif).length
  const tambah = (
    <Drawer trigger="+ Tambah merek" triggerClassName="adm-btn" title="Tambah merek" description="Merek baru masuk di urutan terakhir. Geser dengan tombol naik turun di tabel.">
      <FormMerek />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader
        title="Merek"
        note="Urutan di tabel sama dengan urutan bagian Our Brand di beranda. Logo tampil satu warna (putih) di beranda, jadi pakai SVG atau PNG transparan. Merek tanpa logo tampil sebagai nama."
        actions={tambah}
      />
      <ListToolbar
        count={list.length}
        total={q ? semua.length : undefined}
        noun={`merek${nonaktif && !q ? `, ${nonaktif} nonaktif` : ''}`}
        search={semua.length > 10 || q ? { placeholder: 'Cari nama merek', value: q } : undefined}
      />
      <DataTable
        caption="Daftar merek"
        rows={list}
        rowKey={(b) => b.id}
        muted={(b) => !b.aktif}
        thumb={(b) => <Thumb src={b.logo} alt={`Logo ${b.name}`} variant="logo" />}
        columns={[
          {
            key: 'nama',
            header: 'Nama',
            cell: (b) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{b.name}</span>
                {!b.aktif && <Badge tone="outline">Nonaktif</Badge>}
              </span>
            ),
          },
          { key: 'produk', header: 'Produk', align: 'right', className: 'w-24', cell: (b) => b._count.products.toLocaleString('id-ID') },
          {
            key: 'byorder',
            header: 'By order',
            className: 'w-36',
            mobileLabel: false,
            cell: (b) => <QuickToggle action={setBrandByOrder} fields={{ id: b.id }} checked={b.byOrder} label={`By order ${b.name}`} onText="By order" offText="Distok" />,
          },
          ...(q
            ? []
            : [
                {
                  key: 'urutan',
                  header: 'Urutan',
                  className: 'w-28',
                  cell: (b: (typeof list)[number]) => {
                    const i = list.indexOf(b)
                    return <ReorderButtons action={moveBrand} id={b.id} label={b.name} first={i === 0} last={i === list.length - 1} />
                  },
                },
              ]),
        ]}
        actions={(b) => {
          const aturan = aturanHapus(b.name, [{ jumlah: b._count.products, satuan: 'produk' }])
          const nonaktifkan = { action: setBrandActive, fields: { id: b.id, aktif: 0 }, label: 'Nonaktifkan' }
          return (
            <>
              <Drawer trigger="Ubah" triggerLabel={`Ubah ${b.name}`} title={`Ubah merek ${b.name}`}>
                <FormMerek b={b} />
              </Drawer>
              {!b.aktif && (
                <form action={setBrandActive}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="aktif" value="1" />
                  <SubmitButton className="adm-btn-line adm-btn-sm w-full" pending="Memproses...">Aktifkan</SubmitButton>
                </form>
              )}
              {aturan.boleh ? (
                <ConfirmDialog
                  triggerLabel={`Hapus ${b.name}`}
                  title={`Hapus merek ${b.name}?`}
                  message={
                    <>
                      <p>{b.name} tidak dipakai produk mana pun. Logo dan urutannya ikut terhapus dan tidak bisa dikembalikan.</p>
                      {b.aktif && <p className="text-mute">Kalau hanya ingin menyembunyikannya dari situs, pilih Nonaktifkan.</p>}
                    </>
                  }
                  alternative={b.aktif ? nonaktifkan : undefined}
                  confirm={{ action: deleteBrand, fields: { id: b.id }, label: 'Hapus merek' }}
                />
              ) : (
                <ConfirmDialog
                  triggerLabel={`Hapus ${b.name}`}
                  title={`${b.name} tidak bisa dihapus`}
                  message={
                    <>
                      <p>{aturan.dipakai} Merek yang masih dipakai produk tidak bisa dihapus.</p>
                      <p className="text-mute">
                        {b.aktif
                          ? 'Nonaktifkan supaya merek ini tidak tampil di beranda, saringan produk, dan pilihan merek. Produknya tidak berubah.'
                          : 'Merek ini sudah nonaktif. Pindahkan produknya ke merek lain dulu kalau tetap ingin menghapusnya.'}
                      </p>
                    </>
                  }
                  alternative={b.aktif ? nonaktifkan : undefined}
                />
              )}
            </>
          )
        }}
        empty={
          q ? (
            <Empty title="Merek tidak ditemukan">Tidak ada merek dengan nama &quot;{q}&quot;. Periksa ejaannya atau hapus pencarian.</Empty>
          ) : (
            <Empty title="Belum ada merek">Tambah merek pertama lewat tombol di kanan atas. Merek tampil di beranda dan jadi pilihan di form produk.</Empty>
          )
        }
      />
    </PageBody>
  )
}
