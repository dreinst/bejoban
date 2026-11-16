import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteService, saveService } from '../../fitur-actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function HargaJasa() {
  await requireOwner()
  const rows = await db.servicePrice.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] })
  const form = (r?: (typeof rows)[number]) => (
    <form action={saveService} className="grid gap-2 md:grid-cols-6">
      <input type="hidden" name="id" value={r?.id ?? 0} />
      <label className={labelCls}>Kelompok<input name="groupName" defaultValue={r?.groupName} placeholder="Spooring" className={inputCls} /></label>
      <label className={labelCls}>Nama<input name="name" defaultValue={r?.name} required className={inputCls} /></label>
      <label className={labelCls}>Variasi<input name="variant" defaultValue={r?.variant} placeholder="R12 sampai R15" className={inputCls} /></label>
      <label className={labelCls}>Harga (Rp, 0 = gratis)<input name="price" defaultValue={r?.price ?? ''} inputMode="numeric" className={inputCls} /></label>
      <label className={labelCls}>Satuan<input name="unit" defaultValue={r?.unit} placeholder="per roda" className={inputCls} /></label>
      <label className={labelCls}>Urutan<input name="sort" defaultValue={r?.sort ?? rows.length + 1} className={inputCls} /></label>
      <label className={labelCls}>Ring dari<input name="ringMin" defaultValue={r?.ringMin ?? ''} inputMode="numeric" className={inputCls} /></label>
      <label className={labelCls}>Ring sampai<input name="ringMax" defaultValue={r?.ringMax ?? ''} inputMode="numeric" className={inputCls} /></label>
      <label className={labelCls}>Diameter ban mulai<input name="minDiameter" defaultValue={r?.minDiameter ?? ''} inputMode="numeric" placeholder="31" className={inputCls} /></label>
      <label className={labelCls}>Label harga kedua<input name="altLabel" defaultValue={r?.altLabel} placeholder="paket" className={inputCls} /></label>
      <label className={labelCls}>Harga kedua (Rp)<input name="altPrice" defaultValue={r?.altPrice ?? ''} inputMode="numeric" className={inputCls} /></label>
      <label className={labelCls}>Catatan<input name="note" defaultValue={r?.note} className={inputCls} /></label>
      <label className={`${labelCls} md:col-span-4`}>Kata kunci pencarian bot (pisah koma)<input name="keywords" defaultValue={r?.keywords} placeholder="spooring, spooling" className={inputCls} /></label>
      <div className="flex items-end md:col-span-2"><button className="adm-btn">Simpan</button></div>
    </form>
  )
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Harga jasa</h1>
      <p className="text-sm text-neutral-500">
        Dipakai chatbot untuk menjawab harga jasa lewat WhatsApp. Kalau jasanya ada di tabel ini, bot menjawab. Kalau tidak ada atau harganya kosong, bot menyerahkan ke admin. Harga jasa tidak tampil di situs publik.
        Harga kedua dipakai untuk label seperti &quot;paket&quot;. Isi paket tidak dijelaskan di sini, jadi hanya ditulis apa adanya.
      </p>
      <Card title={`Tabel harga jasa (${rows.length} baris)`}>
        <div className="space-y-5">
          {rows.map((r) => (
            <div key={r.id} className="border-b border-neutral-100 pb-4">
              {form(r)}
              <form action={deleteService} className="mt-1 text-right">
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs font-semibold text-red-600">Hapus</button>
              </form>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-neutral-500">Belum ada baris. Isi manual, atau jalankan <code>npm run seed:lokal</code> kalau berkas <code>data/seed-lokal.json</code> tersedia.</p>}
        </div>
      </Card>
      <Card title="+ Jasa baru">{form()}</Card>
    </div>
  )
}
