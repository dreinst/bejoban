import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { deleteRate, importRates, saveRate } from '../../../fitur-actions'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL, type Carrier } from '@/lib/ongkir/types'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, ListToolbar } from '@/components/admin/data-table'
import { CheckField, FormActions, FormGrid, SelectField, TextAreaField, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'

type TarifRow = { id: number; carrier: string; city: string; perKg: number; minWeight: number; etaDays: string; note: string; isSample: boolean }

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const labelCarrier = (c: string) => CARRIER_LABEL[c as Carrier] ?? c
const tgl = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormTarif({ r, kota }: { r?: TarifRow; kota?: string }) {
  return (
    <form action={saveRate}>
      <input type="hidden" name="id" value={r?.id ?? 0} />
      <FormGrid>
        <SelectField label="Ekspedisi" name="carrier" defaultValue={r?.carrier ?? 'JNT_CARGO'}>
          {CARRIERS.map((c) => <option key={c} value={c}>{CARRIER_LABEL[c]}</option>)}
        </SelectField>
        <TextField label="Kota tujuan" name="city" defaultValue={r?.city ?? kota ?? ''} required maxLength={60} autoComplete="off" />
        <TextField label="Tarif per kg (Rp)" name="perKg" defaultValue={r?.perKg ?? ''} required inputMode="numeric" placeholder="4500" />
        <TextField label="Berat minimum (kg)" name="minWeight" defaultValue={r?.minWeight ?? 10} inputMode="decimal" />
        <TextField label="Estimasi hari" name="etaDays" defaultValue={r?.etaDays ?? ''} placeholder="2-3" maxLength={30} />
        <TextField label="Catatan" name="note" defaultValue={r?.note ?? ''} maxLength={200} />
        <CheckField
          className="sm:col-span-2"
          label="Tarif contoh"
          name="isSample"
          defaultChecked={r?.isSample ?? false}
          hint={`Tampil dengan label "${SAMPLE_LABEL}" di kalkulator. Hilangkan centangnya setelah tarif dari agen masuk.`}
        />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{r ? 'Simpan perubahan' : 'Tambah tarif'}</SubmitButton>
      </FormActions>
    </form>
  )
}

function FormTempel() {
  return (
    <form action={importRates}>
      <FormGrid cols={1}>
        <TextAreaField
          label="Isi tarif, satu baris satu tarif"
          name="paste"
          rows={8}
          required
          placeholder={'JNT_CARGO, Malang, 4500, 10, 2-3, tarif agen Batu\nBARAKA, Malang, 4000, 10, 3-4,'}
          hint="Urutan kolom: ekspedisi, kota, tarif per kg, berat minimum, estimasi hari, catatan. Pisahkan dengan koma, titik koma, atau tab. Kota yang sudah ada diperbarui."
        />
        <CheckField label="Tandai semua sebagai contoh" name="isSample" />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>Masukkan tarif</SubmitButton>
      </FormActions>
    </form>
  )
}

// Tarif per kota. Angka dasar (asal kirim, kemasan, packing) ada di menu Ongkir, tab Pengaturan.
export default async function Tarif({ searchParams }: PageProps<'/admin/ongkir/tarif'>) {
  await requireOwner()
  const sp = await searchParams
  const kota = String(sp.kota ?? '').trim().slice(0, 60)
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const e = (CARRIERS as readonly string[]).includes(String(sp.e)) ? String(sp.e) : ''
  const semua = await db.shippingRate.findMany({ orderBy: [{ city: 'asc' }, { carrier: 'asc' }] })
  const list = semua.filter((r) => (!e || r.carrier === e) && (!q || r.city.toLowerCase().includes(q.toLowerCase())))
  const href = (c: string) => {
    const p = new URLSearchParams(Object.entries({ q, e: c }).filter(([, v]) => v))
    return `/admin/ongkir/tarif${p.size ? `?${p}` : ''}`
  }
  const tambah = (
    <Drawer trigger="+ Tambah tarif" triggerClassName="adm-btn" title="Tambah tarif" description="Satu tarif untuk satu ekspedisi dan satu kota." defaultOpen={Boolean(kota)}>
      <FormTarif kota={kota} />
    </Drawer>
  )
  const tempel = (
    <Drawer trigger="Tempel banyak tarif" triggerClassName="adm-btn-line" title="Tempel banyak tarif" description="Satu baris satu tarif. Baris yang tidak valid dilewati dan disebut setelah disimpan.">
      <FormTempel />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader
        title="Tarif"
        note={`Isi dari daftar harga agen. Tarif bertanda Contoh tampil dengan label "${SAMPLE_LABEL}" di kalkulator.`}
        actions={
          <>
            {tempel}
            {tambah}
          </>
        }
      />
      <ListToolbar
        count={list.length}
        total={q || e ? semua.length : undefined}
        noun="tarif"
        search={{ placeholder: 'Cari kota', label: 'Cari kota tujuan', value: q, keep: { e } }}
      />
      <FilterChips
        label="Saring ekspedisi"
        items={[{ href: href(''), label: 'Semua', active: !e }, ...CARRIERS.map((c) => ({ href: href(c), label: CARRIER_LABEL[c], active: e === c }))]}
      />
      <DataTable
        caption="Daftar tarif ongkir"
        rows={list}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'kota',
            header: 'Kota',
            mobile: 'title',
            cell: (r) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{r.city}</span>
                {r.isSample && <Badge tone="outline">Contoh</Badge>}
              </span>
            ),
          },
          { key: 'ekspedisi', header: 'Ekspedisi', mobile: 'meta', cell: (r) => labelCarrier(r.carrier) },
          { key: 'perkg', header: 'Tarif per kg', align: 'right', className: 'whitespace-nowrap', cell: (r) => rp(r.perKg) },
          { key: 'min', header: 'Min. berat', align: 'right', className: 'whitespace-nowrap', cell: (r) => `${r.minWeight.toLocaleString('id-ID')} kg` },
          { key: 'eta', header: 'Estimasi', cell: (r) => (r.etaDays ? `${r.etaDays} hari` : '-') },
          { key: 'note', header: 'Catatan', cell: (r) => r.note || '-' },
          { key: 'upd', header: 'Diperbarui', mobile: 'hide', className: 'whitespace-nowrap', cell: (r) => tgl(r.updatedAt) },
        ]}
        actions={(r) => {
          const nama = `${labelCarrier(r.carrier)} ke ${r.city}`
          return (
            <>
              <Drawer trigger="Ubah" triggerLabel={`Ubah tarif ${nama}`} title={`Ubah tarif ${nama}`}>
                <FormTarif r={r} />
              </Drawer>
              <ConfirmDialog
                triggerLabel={`Hapus tarif ${nama}`}
                title={`Hapus tarif ${nama}?`}
                message={
                  <>
                    <p>Tarif {rp(r.perKg)} per kg untuk {nama} akan dihapus dan tidak bisa dikembalikan.</p>
                    <p className="text-mute">Kalkulator ongkir tidak lagi punya tarif {labelCarrier(r.carrier)} untuk {r.city} sampai kamu mengisinya lagi.</p>
                  </>
                }
                confirm={{ action: deleteRate, fields: { id: r.id }, label: 'Hapus tarif' }}
              />
            </>
          )
        }}
        empty={
          q || e ? (
            <Empty title="Tarif tidak ditemukan">Tidak ada tarif yang cocok dengan saringan ini. Ubah kata cari atau pilih Semua.</Empty>
          ) : (
            <Empty title="Belum ada tarif">Tambah tarif pertama lewat tombol di kanan atas, atau tempel banyak baris sekaligus dari daftar harga agen.</Empty>
          )
        }
      />
    </PageBody>
  )
}
