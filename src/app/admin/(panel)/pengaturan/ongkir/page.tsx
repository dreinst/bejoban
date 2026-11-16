import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveShipSettings } from '../../../fitur-actions'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { SAMPLE_LABEL } from '@/lib/ongkir/types'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

// Angka dasar kalkulator ongkir. Tiap bagian punya form dan tombol simpan sendiri (lihat saveShipSettings).
export default async function PengaturanOngkir() {
  await requireOwner()
  const [s, branches] = await Promise.all([loadShippingSettings(), db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } })])
  const bagian = (b: string) => <input type="hidden" name="bagian" value={b} />
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="Pengaturan ongkir" note="Angka dasar yang dipakai kalkulator ongkir. Tarif per kota diisi di menu Ongkir, tab Tarif." />

      <section id="asal">
        <Card title="Asal kirim dan titik cabang">
          <form action={saveShipSettings} className="grid gap-3">
            {bagian('asal')}
            <label className={`${labelCls} max-w-sm`}>Nama asal kirim
              <input name="origin" defaultValue={s.origin} placeholder="mis. Cabang Batu" className={inputCls} />
            </label>
            <p className="text-xs text-neutral-500">Titik toko dipakai untuk jarak garis lurus ke alamat tujuan. Di Google Maps, klik kanan titik toko lalu salin dua angka koordinatnya.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {branches.map((b) => (
                <div key={b.slug} className="grid grid-cols-2 gap-2">
                  <label className={labelCls}>Lintang {b.name.replace(/\s*\(.*\)/, '')}<input name={`lat_${b.slug}`} defaultValue={s.origins[b.slug]?.lat ?? ''} className={inputCls} /></label>
                  <label className={labelCls}>Bujur<input name={`lon_${b.slug}`} defaultValue={s.origins[b.slug]?.lon ?? ''} className={inputCls} /></label>
                </div>
              ))}
            </div>
            <button className="w-fit adm-btn">Simpan asal kirim</button>
          </form>
        </Card>
      </section>

      <section id="hitung">
        <Card title="Berat volume dan packing">
          <form action={saveShipSettings} className="grid gap-3 md:grid-cols-3">
            {bagian('hitung')}
            <label className={labelCls}>Pembagi volume J&amp;T Cargo<input name="divJnt" defaultValue={s.divisor.JNT_CARGO} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Pembagi volume Baraka<input name="divBaraka" defaultValue={s.divisor.BARAKA} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Packing per ban (Rp, 0 = tanpa)<input name="packing" defaultValue={s.packingPerTire} inputMode="numeric" className={inputCls} /></label>
            <p className="text-xs text-neutral-500 md:col-span-3">Berat volume = panjang x lebar x tinggi (cm) dibagi angka pembagi dari ekspedisi.</p>
            <div className="md:col-span-3"><button className="adm-btn">Simpan berat volume dan packing</button></div>
          </form>
        </Card>
      </section>

      <section id="kemasan">
        <Card title="Berat dan kemasan ban per ring">
          <form action={saveShipSettings} className="grid gap-3">
            {bagian('kemasan')}
            <p className="text-xs text-neutral-500">Ukuran kemasan satu ban. Beberapa ban dihitung bertumpuk.</p>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead><tr className="text-left text-xs text-neutral-600"><th className="pr-3">Ring</th><th className="pr-2">Berat (kg)</th><th className="pr-2">Panjang (cm)</th><th className="pr-2">Lebar (cm)</th><th>Tinggi (cm)</th></tr></thead>
                <tbody>
                  {Array.from({ length: 8 }, (_, i) => 12 + i).map((r) => {
                    const p = s.ringPack[String(r)]
                    const c = 'w-24 rounded border border-neutral-300 px-2 py-1.5 text-sm'
                    return (
                      <tr key={r}>
                        <td className="pr-3 font-semibold">R{r}</td>
                        <td className="pb-1 pr-2"><input name={`w${r}`} defaultValue={p?.weightKg} aria-label={`Berat R${r}`} className={c} /></td>
                        <td className="pb-1 pr-2"><input name={`l${r}`} defaultValue={p?.lengthCm} aria-label={`Panjang R${r}`} className={c} /></td>
                        <td className="pb-1 pr-2"><input name={`b${r}`} defaultValue={p?.widthCm} aria-label={`Lebar R${r}`} className={c} /></td>
                        <td className="pb-1"><input name={`t${r}`} defaultValue={p?.heightCm} aria-label={`Tinggi R${r}`} className={c} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ringPackSample" defaultChecked={s.ringPackSample} />
              Angka ini masih contoh (hasil hitung diberi label &quot;{SAMPLE_LABEL}&quot;)
            </label>
            <button className="w-fit adm-btn">Simpan kemasan ban</button>
          </form>
        </Card>
      </section>

      <section id="velg">
        <Card title="Berat dan kemasan velg">
          <form action={saveShipSettings} className="grid gap-3 md:grid-cols-5">
            {bagian('velg')}
            <label className={labelCls}>Berat per velg (kg)<input name="velgW" defaultValue={s.velg.weightKg} className={inputCls} /></label>
            <label className={labelCls}>Panjang (cm)<input name="velgL" defaultValue={s.velg.lengthCm} className={inputCls} /></label>
            <label className={labelCls}>Lebar (cm)<input name="velgB" defaultValue={s.velg.widthCm} className={inputCls} /></label>
            <label className={labelCls}>Tinggi (cm)<input name="velgT" defaultValue={s.velg.heightCm} className={inputCls} /></label>
            <label className={labelCls}>Sumber angka<input name="velgNote" defaultValue={s.velgNote} className={inputCls} /></label>
            <p className="text-xs text-neutral-500 md:col-span-5">Berat velg perkiraan toko. Kalau ukuran kemasan diisi 0, berat volume velg tidak dihitung.</p>
            <div className="md:col-span-5"><button className="adm-btn">Simpan velg</button></div>
          </form>
        </Card>
      </section>
    </div>
  )
}
