import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteRate, importRates, saveRate, saveShipSettings } from '../../../fitur-actions'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL } from '@/lib/ongkir/types'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function Tarif({ searchParams }: PageProps<'/admin/ongkir/tarif'>) {
  await requireOwner()
  const kota = String((await searchParams).kota ?? '').slice(0, 60)
  const [rates, s, branches] = await Promise.all([
    db.shippingRate.findMany({ orderBy: [{ city: 'asc' }, { carrier: 'asc' }] }),
    loadShippingSettings(),
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
  ])
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
      <button className="self-end rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Simpan</button>
    </form>
  )
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Tarif ongkir dan pengaturan</h1>
        <Link href="/admin/ongkir" className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold text-ink">Ke kalkulator</Link>
      </div>
      <p className="text-sm text-neutral-500">
        Isi dari daftar harga agen. Baris yang dicentang Contoh tampil dengan label &quot;{SAMPLE_LABEL}&quot; di kalkulator. Hilangkan centang setelah tarifnya dari agen.
      </p>

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
            Satu baris satu tarif: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan (pemisah koma, titik koma, atau tab)
            <textarea name="paste" rows={5} className={`${inputCls} font-mono`} placeholder={'JNT_CARGO, Malang, 4500, 10, 2-3, tarif agen Batu\nBARAKA, Malang, 4000, 10, 3-4,'} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSample" />Tandai semua sebagai contoh</label>
          <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Masukkan tarif</button>
        </form>
      </Card>

      <section id="pengaturan"><Card title="Pengaturan">
        <form action={saveShipSettings} className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className={`${labelCls} md:col-span-2`}>Asal kirim (cabang)
              <input name="origin" defaultValue={s.origin} placeholder="mis. Cabang Batu" className={inputCls} />
            </label>
            <label className={labelCls}>Pembagi volume J&amp;T Cargo<input name="divJnt" defaultValue={s.divisor.JNT_CARGO} className={inputCls} /></label>
            <label className={labelCls}>Pembagi volume Baraka<input name="divBaraka" defaultValue={s.divisor.BARAKA} className={inputCls} /></label>
            <label className={labelCls}>Packing per ban (Rp, 0 = tanpa)<input name="packing" defaultValue={s.packingPerTire} className={inputCls} /></label>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-700">Koordinat cabang asal (untuk jarak garis lurus)</p>
            <p className="mb-2 text-xs text-neutral-500">Angka bawaan hanya perkiraan pusat wilayah. Ganti dengan titik toko (klik kanan di Google Maps, salin dua angka koordinat).</p>
            <div className="grid gap-2 md:grid-cols-2">
              {branches.map((b) => (
                <div key={b.slug} className="grid grid-cols-[1fr_1fr] gap-2">
                  <label className={labelCls}>Lintang {b.name.replace(/\s*\(.*\)/, '')}<input name={`lat_${b.slug}`} defaultValue={s.origins[b.slug]?.lat ?? ''} className={inputCls} /></label>
                  <label className={labelCls}>Bujur<input name={`lon_${b.slug}`} defaultValue={s.origins[b.slug]?.lon ?? ''} className={inputCls} /></label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-700">Velg</p>
            <div className="grid gap-2 md:grid-cols-5">
              <label className={labelCls}>Berat per velg (kg)<input name="velgW" defaultValue={s.velg.weightKg} className={inputCls} /></label>
              <label className={labelCls}>Panjang (cm)<input name="velgL" defaultValue={s.velg.lengthCm} className={inputCls} /></label>
              <label className={labelCls}>Lebar (cm)<input name="velgB" defaultValue={s.velg.widthCm} className={inputCls} /></label>
              <label className={labelCls}>Tinggi (cm)<input name="velgT" defaultValue={s.velg.heightCm} className={inputCls} /></label>
              <label className={labelCls}>Sumber angka<input name="velgNote" defaultValue={s.velgNote} className={inputCls} /></label>
            </div>
            <p className="mt-1 text-xs text-neutral-500">Berat velg perkiraan toko. Kalau ukuran kemasan 0, berat volume velg tidak dihitung.</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-neutral-700">Berat dan ukuran kemasan satu ban per ring</p>
            <p className="mb-2 text-xs text-neutral-500">Berat volume = panjang x lebar x tinggi (cm) x jumlah ban, dibagi pembagi. Ban dianggap ditumpuk.</p>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead><tr className="text-left text-xs text-neutral-600"><th className="pr-3">Ring</th><th className="pr-2">Berat (kg)</th><th className="pr-2">Panjang</th><th className="pr-2">Lebar</th><th>Tinggi</th></tr></thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, i) => 12 + i).map((r) => {
                    const p = s.ringPack[String(r)]
                    const c = 'w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm'
                    return (
                      <tr key={r}>
                        <td className="pr-3 font-semibold">R{r}</td>
                        <td className="pr-2 pb-1"><input name={`w${r}`} defaultValue={p?.weightKg} className={c} /></td>
                        <td className="pr-2 pb-1"><input name={`l${r}`} defaultValue={p?.lengthCm} className={c} /></td>
                        <td className="pr-2 pb-1"><input name={`b${r}`} defaultValue={p?.widthCm} className={c} /></td>
                        <td className="pb-1"><input name={`t${r}`} defaultValue={p?.heightCm} className={c} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="ringPackSample" defaultChecked={s.ringPackSample} />
              Angka kemasan ini masih contoh (hasil hitung diberi label &quot;{SAMPLE_LABEL}&quot;)
            </label>
          </div>
          <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Simpan pengaturan</button>
        </form>
      </Card></section>
    </div>
  )
}
