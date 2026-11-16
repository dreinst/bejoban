import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveShipSettings } from '../../../fitur-actions'
import { loadShippingSettings } from '@/lib/ongkir/db-source'
import { branchLabel } from '@/lib/situs'
import { inputCls } from '@/components/admin/form-cls'
import { PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { FormActions, FormGrid, TextField } from '@/components/admin/field'
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
          <Section id="asal" title="Asal kirim dan titik cabang" description="Titik toko dipakai untuk jarak garis lurus ke alamat tujuan.">
          <form action={saveShipSettings}>
            {bagian('asal')}
            <FormGrid cols={1}>
              <TextField label="Nama asal kirim" name="origin" defaultValue={s.origin} placeholder="mis. Cabang Batu" />
              {branches.map((b) => {
                const t = s.origins[b.slug]
                const ada = t?.lat != null && t?.lon != null
                return (
                  <TextField
                    key={b.slug}
                    label={`Titik toko ${branchLabel(b.name)}`}
                    name={`titik_${b.slug}`}
                    placeholder="Tempel tautan Google Maps"
                    autoComplete="off"
                    hint={`${ada ? `Tersimpan: ${t.lat}, ${t.lon}. ` : 'Belum diisi, jarak garis lurus tidak dihitung. '}Buka toko di Google Maps, salin tautannya (bukan tautan pendek) atau klik kanan titik toko lalu salin dua angkanya. Kosongkan kalau tidak diubah.`}
                  />
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
              <FormGrid cols={1}>
                <TextField label="Packing per ban (Rp)" hint="Isi 0 untuk tanpa packing." name="packing" defaultValue={s.packingPerTire} inputMode="numeric" />
              </FormGrid>
              <details className="mt-4 rounded-[10px] border border-line px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-ink">Angka pembagi ekspedisi (jarang diubah)</summary>
                <FormGrid>
                  <TextField className="mt-3" label="Pembagi volume J&T Cargo" name="divJnt" defaultValue={s.divisor.JNT_CARGO} inputMode="numeric" />
                  <TextField className="mt-3" label="Pembagi volume Baraka" name="divBaraka" defaultValue={s.divisor.BARAKA} inputMode="numeric" />
                </FormGrid>
              </details>
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
            {s.ringPackSample && <p className="mt-3 text-xs text-mute">Angka di tabel ini masih contoh, jadi hasil hitung ongkir diberi label contoh. Setelah kamu mengubah angkanya dan menyimpan, label itu hilang.</p>}
            <FormActions><SubmitButton>Simpan kemasan ban</SubmitButton></FormActions>
          </form>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
