import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteRate, importRates, saveRate } from '../../../fitur-actions'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL } from '@/lib/ongkir/types'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

// Tarif per kota. Angka dasar (asal kirim, kemasan, packing) ada di Pengaturan, tab Ongkir.
export default async function Tarif({ searchParams }: PageProps<'/admin/ongkir/tarif'>) {
  await requireOwner()
  const kota = String((await searchParams).kota ?? '').slice(0, 60)
  const rates = await db.shippingRate.findMany({ orderBy: [{ city: 'asc' }, { carrier: 'asc' }] })
  const form = (r?: (typeof rates)[number]) => (
    <form action={saveRate} className="grid gap-2 md:grid-cols-[130px_1fr_110px_100px_100px_1fr_auto_auto]">
      <input type="hidden" name="id" value={r?.id ?? 0} />
      <label className={labelCls}>Ekspedisi
        <select name="carrier" defaultValue={r?.carrier ?? 'JNT_CARGO'} className={inputCls}>
          {CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_LABEL[c]}</option>)}
        </select>
      </label>
      <label className={labelCls}>Kota tujuan<input name="city" defaultValue={r?.city ?? kota} required className={inputCls} /></label>
      <label className={labelCls}>Tarif/kg (Rp)<input name="perKg" defaultValue={r?.perKg} required inputMode="numeric" className={inputCls} /></label>
      <label className={labelCls}>Min. kg<input name="minWeight" defaultValue={r?.minWeight ?? 10} inputMode="decimal" className={inputCls} /></label>
      <label className={labelCls}>Estimasi hari<input name="etaDays" defaultValue={r?.etaDays} placeholder="2-3" className={inputCls} /></label>
      <label className={labelCls}>Catatan<input name="note" defaultValue={r?.note} className={inputCls} /></label>
      <label className="flex items-end gap-1 pb-2 text-xs"><input type="checkbox" name="isSample" defaultChecked={r?.isSample ?? false} />Contoh</label>
      <button className="self-end adm-btn">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-6xl space-y-4">
      <PageHeader
        title="Tarif ongkir"
        note={<>Isi dari daftar harga agen. Tarif yang dicentang Contoh tampil dengan label &quot;{SAMPLE_LABEL}&quot; di kalkulator. Hilangkan centangnya setelah tarif dari agen masuk.</>}
      />

      <Card title="Tarif per kota">
        <div className="space-y-4">
          {rates.map((r) => (
            <div key={`${r.id}-${r.updatedAt.getTime()}`} className="border-b border-neutral-100 pb-4">
              {form(r)}
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                <span>Diperbarui {r.updatedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}{r.isSample ? ` · ${SAMPLE_LABEL}` : ''}</span>
                <form action={deleteRate}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="font-semibold text-red-600">Hapus</button>
                </form>
              </div>
            </div>
          ))}
          {!rates.length && <p className="text-sm text-neutral-500">Belum ada tarif.</p>}
        </div>
      </Card>

      <section id="baru"><Card title="+ Tarif baru">{form()}</Card></section>

      <Card title="Tempel banyak tarif sekaligus">
        <form action={importRates} className="grid gap-3">
          <label className={labelCls}>
            Satu baris satu tarif: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan (pisahkan dengan koma, titik koma, atau tab)
            <textarea name="paste" rows={5} className={`${inputCls} font-mono`} placeholder={'JNT_CARGO, Malang, 4500, 10, 2-3, tarif agen Batu\nBARAKA, Malang, 4000, 10, 3-4,'} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSample" />Tandai semua sebagai contoh</label>
          <button className="w-fit adm-btn">Masukkan tarif</button>
        </form>
      </Card>
    </div>
  )
}
