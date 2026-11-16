import { db } from '@/lib/db'
import { requireUser, canEditBranch } from '@/lib/auth'
import { saveBranch } from '../../actions'
import { ImagesInput } from '@/components/admin/image-input'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

export default async function Cabang() {
  const s = await requireUser()
  const list = (await db.branch.findMany({ orderBy: { sort: 'asc' } })).filter((b) => canEditBranch(s, b.id))
  const form = (b?: (typeof list)[number]) => (
    <form action={saveBranch} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="id" value={b?.id ?? 0} />
      <label className={labelCls}>Nama cabang<input name="name" defaultValue={b?.name} required className={inputCls} /></label>
      <label className={labelCls}>WhatsApp<input name="whatsapp" defaultValue={b?.whatsapp} placeholder="0823..." className={inputCls} /></label>
      <label className={`${labelCls} md:col-span-2`}>Alamat<input name="address" defaultValue={b?.address} className={inputCls} /></label>
      <label className={labelCls}>Jam buka<input name="hours" defaultValue={b?.hours ?? '08.00 sampai 17.00'} className={inputCls} /></label>
      <label className={labelCls}>Instagram (tanpa @)<input name="instagram" defaultValue={b?.instagram} className={inputCls} /></label>
      <label className={labelCls}>Link Google Maps<input name="mapsUrl" defaultValue={b?.mapsUrl} className={inputCls} /></label>
      <label className={labelCls}>Layanan<input name="services" defaultValue={b?.services} className={inputCls} /></label>
      <label className={labelCls}>Urutan<input name="sort" type="number" defaultValue={b?.sort ?? list.length + 1} className={inputCls} /></label>
      <div className="md:col-span-2"><p className={labelCls}>Foto cabang</p><ImagesInput name="photo" value={b?.photo ? [b.photo] : []} preset="branch" max={1} /></div>
      <button className="w-fit adm-btn">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={s.role === 'OWNER' ? 'Cabang' : 'Data cabang saya'} note="Alamat, jam buka, WhatsApp, dan foto yang tampil di situs." />
      {list.map((b) => <Card key={`${b.id}-${b.photo}`} title={b.name}>{form(b)}</Card>)}
      {s.role === 'OWNER' && <Card title="+ Cabang baru">{form()}</Card>}
    </div>
  )
}
