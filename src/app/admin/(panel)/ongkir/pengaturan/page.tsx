import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveShipSettings } from '../../../fitur-actions'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { SAMPLE_LABEL } from '@/lib/ongkir/types'
import { inputCls } from '@/components/admin/form-cls'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { CheckField, FormActions, FormGrid, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'

// Angka dasar kalkulator ongkir. Tiap bagian punya form dan tombol simpan sendiri (lihat saveShipSettings).
export default async function PengaturanOngkir() {
  await requireOwner()
  const [s, branches] = await Promise.all([loadShippingSettings(), db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } })])
  const bagian = (b: string) => <input type="hidden" name="bagian" value={b} />
  const ring = Array.from({ length: 8 }, (_, i) => 12 + i)
  const kolom = [
    { pre: 'w', nama: 'Berat (kg)', key: 'weightKg' },
    { pre: 'l', nama: 'Panjang (cm)', key: 'lengthCm' },
    { pre: 'b', nama: 'Lebar (cm)', key: 'widthCm' },
    { pre: 't', nama: 'Tinggi (cm)', key: 'heightCm' },
  ] as const
  return (
    <PageBody>
      <PageHeader title="Pengaturan ongkir" note="Angka dasar yang dipakai kalkulator ongkir. Tarif per kota diisi di tab Tarif." />
      <SettingsGrid>
        <Section id="asal" title="Asal kirim dan titik cabang" description="Titik toko dipakai untuk jarak garis lurus ke alamat tujuan. Di Google Maps, klik kanan titik toko lalu salin dua angka koordinatnya.">
          <form action={saveShipSettings}>
            {bagian('asal')}
            <FormGrid>
              <TextField className="sm:col-span-2" label="Nama asal kirim" name="origin" defaultValue={s.origin} placeholder="mis. Cabang Batu" />
              {branches.map((b) => {
                const nama = b.name.replace(/\s*\(.*\)/, '')
                return (
                  <div key={b.slug} className="grid grid-cols-2 gap-3 sm:col-span-2">
                    <TextField label={`Lintang ${nama}`} name={`lat_${b.slug}`} defaultValue={s.origins[b.slug]?.lat ?? ''} />
                    <TextField label={`Bujur ${nama}`} name={`lon_${b.slug}`} defaultValue={s.origins[b.slug]?.lon ?? ''} />
                  </div>
                )
              })}
            </FormGrid>
            <FormActions><SubmitButton>Simpan asal kirim</SubmitButton></FormActions>
          </form>
        </Section>

        <div className="space-y-5">
          <Section id="hitung" title="Berat volume dan packing" description="Berat volume = panjang x lebar x tinggi (cm) dibagi angka pembagi dari ekspedisi.">
            <form action={saveShipSettings}>
              {bagian('hitung')}
              <FormGrid>
                <TextField label="Pembagi volume J&T Cargo" name="divJnt" defaultValue={s.divisor.JNT_CARGO} inputMode="numeric" />
                <TextField label="Pembagi volume Baraka" name="divBaraka" defaultValue={s.divisor.BARAKA} inputMode="numeric" />
                <TextField className="sm:col-span-2" label="Packing per ban (Rp)" hint="Isi 0 untuk tanpa packing." name="packing" defaultValue={s.packingPerTire} inputMode="numeric" />
              </FormGrid>
              <FormActions><SubmitButton>Simpan berat volume dan packing</SubmitButton></FormActions>
            </form>
          </Section>

          <Section id="velg" title="Berat dan kemasan velg" description="Berat velg perkiraan toko. Kalau ukuran kemasan diisi 0, berat volume velg tidak dihitung.">
            <form action={saveShipSettings}>
              {bagian('velg')}
              <FormGrid>
                <TextField label="Berat per velg (kg)" name="velgW" defaultValue={s.velg.weightKg} inputMode="decimal" />
                <TextField label="Panjang (cm)" name="velgL" defaultValue={s.velg.lengthCm} inputMode="decimal" />
                <TextField label="Lebar (cm)" name="velgB" defaultValue={s.velg.widthCm} inputMode="decimal" />
                <TextField label="Tinggi (cm)" name="velgT" defaultValue={s.velg.heightCm} inputMode="decimal" />
                <TextField className="sm:col-span-2" label="Sumber angka" name="velgNote" defaultValue={s.velgNote} />
              </FormGrid>
              <FormActions><SubmitButton>Simpan velg</SubmitButton></FormActions>
            </form>
          </Section>
        </div>

        <Section id="kemasan" title="Kemasan ban per ring" wide description="Berat dan ukuran kemasan satu ban. Beberapa ban dihitung bertumpuk.">
          <form action={saveShipSettings}>
            {bagian('kemasan')}
            <div className="overflow-x-auto">
              <table className="w-full max-w-[640px] table-fixed text-sm">
                <caption className="sr-only">Berat dan ukuran kemasan satu ban per ring</caption>
                <thead>
                  <tr className="text-left text-xs text-neutral-700">
                    <th scope="col" className="pb-2 pr-3 font-semibold">Ring</th>
                    {kolom.map((k) => <th key={k.pre} scope="col" className="pb-2 pr-2 font-semibold">{k.nama}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ring.map((r) => {
                    const p = s.ringPack[String(r)]
                    return (
                      <tr key={r}>
                        <th scope="row" className="pb-2 pr-3 text-left font-semibold text-ink">R{r}</th>
                        {kolom.map((k) => (
                          <td key={k.pre} className="pb-2 pr-2">
                            <input name={`${k.pre}${r}`} defaultValue={p?.[k.key]} inputMode="decimal" aria-label={`${k.nama} R${r}`} className={`${inputCls} min-h-10 min-w-0 !px-2`} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <CheckField label="Angka ini masih contoh" name="ringPackSample" defaultChecked={s.ringPackSample} hint={`Hasil hitung diberi label "${SAMPLE_LABEL}".`} />
            </div>
            <FormActions><SubmitButton>Simpan kemasan ban</SubmitButton></FormActions>
          </form>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
