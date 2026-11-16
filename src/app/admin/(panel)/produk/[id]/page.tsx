import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser, canEditBranch } from '@/lib/auth'
import { parseImages } from '@/lib/format'
import { saveProduct, deleteProduct } from '../../../actions'
import { ImagesInput } from '@/components/admin/image-input'
import { inputCls } from '@/components/admin/form-cls'

export default async function EditProduct({ params }: PageProps<'/admin/produk/[id]'>) {
  const s = await requireUser()
  const { id } = await params
  const isNew = id === 'baru'
  const p = isNew ? null : await db.product.findUnique({ where: { id: Number(id) }, include: { listings: true } })
  if (!isNew && !p) notFound()
  const [categories, brands, branches] = await Promise.all([
    db.category.findMany({ orderBy: { sort: 'asc' } }),
    db.brand.findMany({ orderBy: { sort: 'asc' } }),
    db.branch.findMany({ orderBy: { sort: 'asc' } }),
  ])
  const label = 'mb-1 block text-sm font-semibold text-neutral-800'
  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-ink">{isNew ? 'Tambah produk' : 'Ubah produk'}</h1>
      <form action={saveProduct} className="space-y-6">
        <input type="hidden" name="id" value={p?.id ?? 0} />
        <section className="grid gap-4 rounded-xl bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={label}>Nama produk</label>
            <input name="name" defaultValue={p?.name} required className={inputCls} placeholder="Hankook Kinergy Eco2 185/65 R15" />
          </div>
          <div>
            <label className={label}>Kategori</label>
            <select name="categoryId" defaultValue={p?.categoryId ?? ''} className={inputCls}>
              <option value="">(tanpa kategori)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Merek</label>
            <select name="brandId" defaultValue={p?.brandId ?? ''} className={inputCls}>
              <option value="">(tanpa merek)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Ukuran / spesifikasi</label>
            <input name="spec" defaultValue={p?.spec} className={inputCls} placeholder="185/65 R15 atau R14 / PCD 6x139.7" />
          </div>
          <div>
            <label className={label}>Cocok untuk mobil</label>
            <input name="fitment" defaultValue={p?.fitment} className={inputCls} placeholder="Avanza, Xenia, Innova" />
          </div>
          <div className="md:col-span-2">
            <label className={label}>Deskripsi</label>
            <textarea name="description" defaultValue={p?.description} rows={4} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> Tampilkan di web</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSample" defaultChecked={p?.isSample ?? false} /> Tandai sebagai produk contoh</label>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <p className={label}>Foto produk</p>
          <ImagesInput name="images" value={parseImages(p?.images ?? '[]')} preset="product" max={10} />
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-neutral-800">Harga & stok per cabang</p>
          <p className="mb-4 text-xs text-neutral-500">Harga coret diisi kalau sedang diskon (harus lebih tinggi dari harga jual). Kosongkan harga dan hilangkan centang Dijual untuk melepas produk dari cabang.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {branches.filter((b) => canEditBranch(s, b.id)).map((b) => {
              const l = p?.listings.find((x) => x.branchId === b.id)
              return (
                <div key={b.id} className="rounded-lg border border-neutral-200 p-4">
                  <p className="mb-3 font-semibold text-ink">{b.name}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <label>Harga jual<input name={`b${b.id}_price`} inputMode="numeric" defaultValue={l?.price ?? ''} className={inputCls} /></label>
                    <label>Harga coret<input name={`b${b.id}_compare`} inputMode="numeric" defaultValue={l?.comparePrice || ''} className={inputCls} /></label>
                    <label>Stok<input name={`b${b.id}_stock`} inputMode="numeric" defaultValue={l?.stock ?? ''} className={inputCls} /></label>
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" name={`b${b.id}_sell`} defaultChecked={l?.available ?? isNew} /> Dijual</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name={`b${b.id}_flash`} defaultChecked={l?.flashSale ?? false} /> Flash sale</label>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        <button className="adm-btn adm-btn-lg">Simpan produk</button>
      </form>
      {p && s.role === 'OWNER' && (
        <form action={deleteProduct} className="mt-10 border-t border-neutral-200 pt-5">
          <input type="hidden" name="id" value={p.id} />
          <label className="mr-4 text-sm"><input type="checkbox" required className="mr-2" />Saya yakin</label>
          <button className="text-sm font-semibold text-red-600">Hapus produk ini permanen</button>
        </form>
      )}
    </div>
  )
}
