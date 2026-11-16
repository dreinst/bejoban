import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requireUser, canEditBranch } from '@/lib/auth'
import { namaPendek } from '@/lib/tire/cabang'
import { parseImages } from '@/lib/format'
import { saveProduct, deleteProduct } from '../../../actions'
import { ImagesInput } from '@/components/admin/image-input'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { CheckField, FormActions, FormGrid, SelectField, TextAreaField, TextField } from '@/components/admin/field'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'

export default async function EditProduct({ params }: PageProps<'/admin/produk/[id]'>) {
  const s = await requireUser()
  const { id } = await params
  const isNew = id === 'baru'
  const p = isNew ? null : await db.product.findUnique({ where: { id: Number(id) }, include: { listings: true } })
  if (!isNew && !p) notFound()
  const [categories, brands, branches] = await Promise.all([
    // Kategori dan merek nonaktif tidak ditawarkan, kecuali yang sedang dipakai produk ini.
    db.category.findMany({ where: { OR: [{ aktif: true }, { id: p?.categoryId ?? -1 }] }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    db.brand.findMany({ where: { OR: [{ aktif: true }, { id: p?.brandId ?? -1 }] }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
  ])
  const owner = s.role === 'OWNER'
  // Data produk dipakai semua cabang: admin cabang hanya mengatur harga dan stok cabangnya, dan tidak menambah produk.
  if (isNew && !owner) redirect('/admin/harga')

  return (
    <PageBody>
      <Link href="/admin/harga" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink underline-offset-2 hover:underline max-md:min-h-11">
        <ArrowLeft className="size-4" aria-hidden />
        Produk situs
      </Link>
      <PageHeader title={isNew ? 'Tambah produk' : owner ? 'Ubah produk' : 'Harga dan stok produk'} note={p ? (owner ? p.name : `${p.name}. Nama, foto, dan deskripsi produk diubah owner.`) : 'Isi detail, foto, lalu harga dan stok tiap cabang.'} />
      <form action={saveProduct} className="space-y-5">
        <input type="hidden" name="id" value={p?.id ?? 0} />
        <SettingsGrid>
          {owner && (
              <>
              <Section id="detail" title="Detail produk">
                <FormGrid>
                  <TextField className="sm:col-span-2" label="Nama produk" name="name" defaultValue={p?.name} required maxLength={200} placeholder="Hankook Kinergy Eco2 185/65 R15" />
                  <SelectField label="Kategori" name="categoryId" defaultValue={p?.categoryId ?? ''}>
                    <option value="">(tanpa kategori)</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.aktif ? '' : ' (nonaktif)'}</option>)}
                  </SelectField>
                  <SelectField label="Merek" name="brandId" defaultValue={p?.brandId ?? ''}>
                    <option value="">(tanpa merek)</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}{b.aktif ? '' : ' (nonaktif)'}</option>)}
                  </SelectField>
                  <TextField label="Ukuran atau spesifikasi" name="spec" defaultValue={p?.spec} maxLength={100} placeholder="185/65 R15 atau R14 / PCD 6x139.7" />
                  <TextField label="Cocok untuk mobil" name="fitment" defaultValue={p?.fitment} maxLength={300} placeholder="Avanza, Xenia, Innova" />
                  <TextAreaField className="sm:col-span-2" label="Deskripsi" name="description" defaultValue={p?.description} rows={4} maxLength={5000} />
                  <CheckField label="Tampilkan di web" name="active" defaultChecked={p?.active ?? true} />
                  <CheckField label="Produk contoh" name="isSample" defaultChecked={p?.isSample ?? false} hint="Centang untuk data uji, bukan barang yang dijual sungguhan." />
                </FormGrid>
              </Section>

              <Section id="foto" title="Foto produk" description="Foto pertama jadi foto utama di situs.">
                <ImagesInput name="images" value={parseImages(p?.images ?? '[]')} preset="product" max={10} />
              </Section>

              </>
          )}

          <Section
            id="harga"
            title="Harga dan stok per cabang"
            description="Harga coret diisi kalau sedang diskon (harus lebih tinggi dari harga jual). Produk hanya bisa dicentang Dijual kalau harga jualnya terisi. Kosongkan harga dan hilangkan centang Dijual untuk melepas produk dari cabang."
            wide
          >
            <div className="grid gap-4 md:grid-cols-2">
              {branches.filter((b) => canEditBranch(s, b.id)).map((b) => {
                const l = p?.listings.find((x) => x.branchId === b.id)
                return (
                  <fieldset key={b.id} className="min-w-0 rounded-[10px] border border-line p-4">
                    <legend className="px-1 font-display text-sm font-extrabold text-ink">Cabang {namaPendek(b.name)}</legend>
                    <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                      <TextField id={`b${b.id}-price`} label="Harga jual" name={`b${b.id}_price`} inputMode="numeric" defaultValue={l?.price ?? ''} />
                      <TextField id={`b${b.id}-compare`} label="Harga coret" name={`b${b.id}_compare`} inputMode="numeric" defaultValue={l?.comparePrice || ''} />
                      <TextField id={`b${b.id}-stock`} label="Stok" name={`b${b.id}_stock`} inputMode="numeric" defaultValue={l?.stock ?? ''} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6">
                      <CheckField id={`b${b.id}-sell`} label="Dijual" name={`b${b.id}_sell`} defaultChecked={l?.available ?? false} />
                      <CheckField id={`b${b.id}-flash`} label="Promo kilat" name={`b${b.id}_flash`} defaultChecked={l?.flashSale ?? false} />
                    </div>
                  </fieldset>
                )
              })}
            </div>
          </Section>
        </SettingsGrid>
        <FormActions>
          <SubmitButton className="adm-btn adm-btn-lg">Simpan produk</SubmitButton>
        </FormActions>
      </form>
      {p && owner && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <ConfirmDialog
            trigger="Hapus produk"
            triggerLabel={`Hapus ${p.name}`}
            triggerClassName="adm-btn-line adm-btn-sm"
            title={`Hapus ${p.name}?`}
            message={
              <>
                <p>{p.name} dihapus permanen dari situs. Harga dan stok di semua cabang ikut terhapus dan tidak bisa dikembalikan.</p>
                <p className="text-mute">Kalau hanya ingin menyembunyikannya, hilangkan centang Tampilkan di web lalu simpan.</p>
              </>
            }
            confirm={{ action: deleteProduct, fields: { id: p.id }, label: 'Hapus produk' }}
          />
        </div>
      )}
    </PageBody>
  )
}
