import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveBrand, deleteBrand } from '../../actions'
import { ImagesInput } from '@/components/admin/image-input'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function Merek() {
  await requireOwner()
  const list = await db.brand.findMany({ orderBy: { sort: 'asc' }, include: { _count: { select: { products: true } } } })
  const form = (b?: (typeof list)[number]) => (
    <form action={saveBrand} className="grid gap-3 md:grid-cols-[1fr_100px]">
      <input type="hidden" name="id" value={b?.id ?? 0} />
      <label className={labelCls}>Nama<input name="name" defaultValue={b?.name} required className={inputCls} /></label>
      <label className={labelCls}>Urutan<input name="sort" type="number" defaultValue={b?.sort ?? list.length + 1} className={inputCls} /></label>
      <div className="md:col-span-2"><ImagesInput name="logo" value={b?.logo ? [b.logo] : []} preset="brand" max={1} /></div>
      <button className="w-fit adm-btn">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Merek</h1>
      <p className="text-sm text-neutral-500">Tanpa logo, nama merek ditampilkan sebagai teks.</p>
      {list.map((b) => (
        <Card key={`${b.id}-${b.logo}-${b.name}`} title={`${b.name} (${b._count.products} produk)`}>
          {form(b)}
          <form action={deleteBrand} className="mt-3 text-right">
            <input type="hidden" name="id" value={b.id} />
            <label className="mr-3 text-xs"><input type="checkbox" required className="mr-1" />Yakin</label>
            <button className="text-xs font-semibold text-red-600">Hapus merek</button>
          </form>
        </Card>
      ))}
      <Card title="+ Merek baru">{form()}</Card>
    </div>
  )
}
