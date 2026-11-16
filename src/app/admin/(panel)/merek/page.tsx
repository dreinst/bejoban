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
      <label className="flex items-start gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="byOrder" defaultChecked={b?.byOrder ?? false} className="mt-1" />
        <span><b>By order.</b> Merek ini tidak distok dan dipesan dulu. Di beranda diberi keterangan &quot;by order&quot;, dan chatbot menjawab bahwa merek ini bisa dipesan kalau stoknya kosong.</span>
      </label>
      <div className="md:col-span-2"><ImagesInput name="logo" value={b?.logo ? [b.logo] : []} preset="brand" max={1} /></div>
      <button className="w-fit adm-btn">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Merek</h1>
      <p className="text-sm text-neutral-500">Merek di sini tampil di bagian merek beranda sesuai urutan, nama saja. Logo dipakai di kartu produk.</p>
      {list.map((b) => (
        <Card key={`${b.id}-${b.logo}-${b.name}-${b.byOrder}`} title={`${b.name} (${b._count.products} produk${b.byOrder ? ', by order' : ''})`}>
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
