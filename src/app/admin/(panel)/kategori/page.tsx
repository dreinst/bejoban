import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveCategory, deleteCategory } from '../../actions'
import { ImagesInput } from '@/components/admin/image-input'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function Kategori() {
  await requireOwner()
  const list = await db.category.findMany({ orderBy: { sort: 'asc' }, include: { _count: { select: { products: true } } } })
  const form = (c?: (typeof list)[number]) => (
    <form action={saveCategory} className="grid gap-3 md:grid-cols-[1fr_100px]">
      <input type="hidden" name="id" value={c?.id ?? 0} />
      <label className={labelCls}>Nama<input name="name" defaultValue={c?.name} required className={inputCls} /></label>
      <label className={labelCls}>Urutan<input name="sort" type="number" defaultValue={c?.sort ?? list.length + 1} className={inputCls} /></label>
      <div className="md:col-span-2"><ImagesInput name="image" value={c?.image ? [c.image] : []} preset="category" max={1} /></div>
      <button className="w-fit adm-btn">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Kategori</h1>
      {list.map((c) => (
        <Card key={`${c.id}-${c.image}-${c.name}`} title={`${c.name} (${c._count.products} produk)`}>
          {form(c)}
          <form action={deleteCategory} className="mt-3 text-right">
            <input type="hidden" name="id" value={c.id} />
            <label className="mr-3 text-xs"><input type="checkbox" required className="mr-1" />Yakin</label>
            <button className="text-xs font-semibold text-red-600">Hapus kategori</button>
          </form>
        </Card>
      ))}
      <Card title="+ Kategori baru">{form()}</Card>
    </div>
  )
}
