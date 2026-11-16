import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { aturanHapus } from '@/lib/admin/urutan'
import { deleteCategory, moveCategory, saveCategory, setCategoryActive } from '../../actions'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar, Thumb } from '@/components/admin/data-table'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'
import { ReorderButtons } from '@/components/admin/row-controls'
import { ImageField } from '@/components/admin/image-input'

type Kategori = { id: number; name: string; image: string }

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormKategori({ c }: { c?: Kategori }) {
  return (
    <form action={saveCategory}>
      <input type="hidden" name="id" value={c?.id ?? 0} />
      <FormGrid cols={1}>
        <TextField label="Nama kategori" name="name" defaultValue={c?.name} required maxLength={60} autoComplete="off" />
        <ImageField label="Gambar" name="image" value={c?.image} preset="category" />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{c ? 'Simpan perubahan' : 'Tambah kategori'}</SubmitButton>
      </FormActions>
    </form>
  )
}

export default async function Kategori({ searchParams }: PageProps<'/admin/kategori'>) {
  await requireOwner()
  const q = String((await searchParams).q ?? '').trim().slice(0, 60)
  const semua = await db.category.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], include: { _count: { select: { products: true } } } })
  const list = q ? semua.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : semua
  const nonaktif = semua.filter((c) => !c.aktif).length
  const tambah = (
    <Drawer trigger="+ Tambah kategori" triggerClassName="adm-btn" title="Tambah kategori" description="Kategori baru masuk di urutan terakhir. Geser dengan tombol naik turun di tabel.">
      <FormKategori />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader title="Kategori" note="Urutan di tabel sama dengan urutan chip Jenis di halaman Produk. Kategori nonaktif tidak tampil di situs, tetapi produk di dalamnya tetap tampil." actions={tambah} />
      <ListToolbar
        count={list.length}
        total={q ? semua.length : undefined}
        noun={`kategori${nonaktif && !q ? `, ${nonaktif} nonaktif` : ''}`}
        search={semua.length > 10 || q ? { placeholder: 'Cari nama kategori', value: q } : undefined}
      />
      <DataTable
        caption="Daftar kategori"
        rows={list}
        rowKey={(c) => c.id}
        muted={(c) => !c.aktif}
        thumb={(c) => <Thumb src={c.image} alt={`Gambar ${c.name}`} variant="photo" />}
        columns={[
          {
            key: 'nama',
            header: 'Nama',
            cell: (c) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{c.name}</span>
                {!c.aktif && <Badge tone="outline">Nonaktif</Badge>}
              </span>
            ),
          },
          { key: 'produk', header: 'Produk', align: 'right', className: 'w-24', cell: (c) => c._count.products.toLocaleString('id-ID') },
          ...(q
            ? []
            : [
                {
                  key: 'urutan',
                  header: 'Urutan',
                  className: 'w-28',
                  cell: (c: (typeof list)[number]) => {
                    const i = list.indexOf(c)
                    return <ReorderButtons action={moveCategory} id={c.id} label={c.name} first={i === 0} last={i === list.length - 1} />
                  },
                },
              ]),
        ]}
        actions={(c) => {
          const aturan = aturanHapus(c.name, [{ jumlah: c._count.products, satuan: 'produk' }])
          const nonaktifkan = { action: setCategoryActive, fields: { id: c.id, aktif: 0 }, label: 'Nonaktifkan' }
          return (
            <>
              <Drawer trigger="Ubah" triggerLabel={`Ubah ${c.name}`} title={`Ubah kategori ${c.name}`}>
                <FormKategori c={c} />
              </Drawer>
              {!c.aktif && (
                <form action={setCategoryActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="aktif" value="1" />
                  <SubmitButton className="adm-btn-line adm-btn-sm w-full" pending="Memproses...">Aktifkan</SubmitButton>
                </form>
              )}
              {aturan.boleh ? (
                <ConfirmDialog
                  triggerLabel={`Hapus ${c.name}`}
                  title={`Hapus kategori ${c.name}?`}
                  message={
                    <>
                      <p>{c.name} tidak dipakai produk mana pun. Gambar dan urutannya ikut terhapus dan tidak bisa dikembalikan.</p>
                      {c.aktif && <p className="text-mute">Kalau hanya ingin menyembunyikannya dari situs, pilih Nonaktifkan.</p>}
                    </>
                  }
                  alternative={c.aktif ? nonaktifkan : undefined}
                  confirm={{ action: deleteCategory, fields: { id: c.id }, label: 'Hapus kategori' }}
                />
              ) : (
                <ConfirmDialog
                  triggerLabel={`Hapus ${c.name}`}
                  title={`${c.name} tidak bisa dihapus`}
                  message={
                    <>
                      <p>{aturan.dipakai} Kategori yang masih dipakai produk tidak bisa dihapus.</p>
                      <p className="text-mute">
                        {c.aktif
                          ? 'Nonaktifkan supaya kategori ini tidak tampil di saringan produk dan pilihan kategori. Produknya tidak berubah.'
                          : 'Kategori ini sudah nonaktif. Pindahkan produknya ke kategori lain dulu kalau tetap ingin menghapusnya.'}
                      </p>
                    </>
                  }
                  alternative={c.aktif ? nonaktifkan : undefined}
                />
              )}
            </>
          )
        }}
        empty={
          q ? (
            <Empty title="Kategori tidak ditemukan">Tidak ada kategori dengan nama &quot;{q}&quot;. Periksa ejaannya atau hapus pencarian.</Empty>
          ) : (
            <Empty title="Belum ada kategori" action={tambah}>Tambah kategori pertama. Kategori jadi saringan di halaman Produk dan pilihan di form produk.</Empty>
          )
        }
      />
    </PageBody>
  )
}
