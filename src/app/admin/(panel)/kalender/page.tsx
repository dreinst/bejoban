import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, ListToolbar } from '@/components/admin/data-table'
import { FormActions, FormGrid, SelectField, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'
import { JENIS_KALENDER, LABEL_JENIS, type JenisKalender } from '@/lib/stok/kalender'
import { deleteKalender, saveKalender } from './actions'

type Tanggal = { id: number; tanggal: string; jenis: string; keterangan: string }

const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
// Tanggal hari ini menurut waktu Jakarta (YYYY-MM-DD).
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
const jenisLabel = (j: string) => LABEL_JENIS[j as JenisKalender] ?? j

// Satu form untuk tambah dan ubah, dipakai di panel samping.
function FormTanggal({ r }: { r?: Tanggal }) {
  return (
    <form action={saveKalender}>
      <input type="hidden" name="id" value={r?.id ?? 0} />
      <FormGrid cols={1}>
        <TextField label="Tanggal" name="tanggal" type="date" defaultValue={r?.tanggal ?? ''} required />
        <SelectField label="Jenis" name="jenis" defaultValue={r?.jenis ?? 'libur'}>
          {JENIS_KALENDER.map((j) => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}
        </SelectField>
        <TextField label="Keterangan" name="keterangan" defaultValue={r?.keterangan ?? ''} required maxLength={200} placeholder="mis. Libur Idulfitri" />
      </FormGrid>
      <FormActions>
        <CloseButton />
        <SubmitButton>{r ? 'Simpan perubahan' : 'Tambah tanggal'}</SubmitButton>
      </FormActions>
    </form>
  )
}

const SARINGAN = { akan: 'Akan datang', lewat: 'Sudah lewat', semua: 'Semua' } as const
type Saringan = keyof typeof SARINGAN

export default async function Kalender({ searchParams }: PageProps<'/admin/kalender'>) {
  await requireOwner()
  const s = String((await searchParams).s ?? '')
  const saringan: Saringan = s === 'lewat' || s === 'semua' ? s : 'akan'
  const semua = await db.kalender.findMany({ orderBy: [{ tanggal: 'asc' }, { id: 'asc' }] })
  const kini = hariIni()
  const akan = semua.filter((r) => r.tanggal >= kini)
  const lewat = semua.filter((r) => r.tanggal < kini).reverse()
  const list = saringan === 'akan' ? akan : saringan === 'lewat' ? lewat : semua
  const tambah = (kosong = false) => (
    <Drawer trigger="+ Tambah tanggal" triggerClassName="adm-btn" title="Tambah tanggal" kunci={kosong ? 'tambah-tanggal-kosong' : undefined} description="Hari libur toko atau tanggal promo.">
      <FormTanggal />
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader title="Kalender libur dan promo" note="Hari libur toko dan tanggal promo. Tanggal yang sudah lewat tetap disimpan sebagai riwayat." actions={tambah()} />
      <ListToolbar count={list.length} noun="tanggal">
        <FilterChips
          label="Saring tanggal"
          items={(Object.keys(SARINGAN) as Saringan[]).map((k) => ({
            href: k === 'akan' ? '/admin/kalender' : `/admin/kalender?s=${k}`,
            label: SARINGAN[k],
            active: saringan === k,
            count: k === 'akan' ? akan.length : k === 'lewat' ? lewat.length : semua.length,
          }))}
        />
      </ListToolbar>
      <DataTable
        caption="Daftar tanggal libur dan promo"
        rows={list}
        rowKey={(r) => r.id}
        muted={(r) => r.tanggal < kini}
        columns={[
          { key: 'tanggal', header: 'Tanggal', mobile: 'title', cell: (r) => <span className="font-semibold">{tgl(r.tanggal)}</span> },
          {
            key: 'jenis',
            header: 'Jenis',
            mobileLabel: false,
            cell: (r) => <Badge tone={r.jenis === 'libur' ? 'dark' : r.jenis === 'promo' ? 'light' : 'outline'}>{jenisLabel(r.jenis)}</Badge>,
          },
          { key: 'ket', header: 'Keterangan', mobileLabel: false, cell: (r) => r.keterangan },
          { key: 'status', header: 'Status', cell: (r) => (r.tanggal < kini ? 'Sudah lewat' : 'Akan datang') },
        ]}
        actions={(r) => {
          const nama = `${r.keterangan}, ${tgl(r.tanggal)}`
          return (
            <>
              <Drawer trigger="Ubah" triggerLabel={`Ubah ${nama}`} title="Ubah tanggal">
                <FormTanggal r={r} />
              </Drawer>
              <ConfirmDialog
                triggerLabel={`Hapus ${nama}`}
                title={`Hapus ${r.keterangan}?`}
                message={
                  <>
                    <p>{tgl(r.tanggal)} ({jenisLabel(r.jenis)}) dihapus dari kalender dan tidak bisa dikembalikan.</p>
                    {r.tanggal >= kini && <p className="text-mute">Tanggal ini belum lewat, jadi hari itu tidak lagi tercatat sebagai {jenisLabel(r.jenis).toLowerCase()}.</p>}
                  </>
                }
                confirm={{ action: deleteKalender, fields: { id: r.id }, label: 'Hapus tanggal' }}
              />
            </>
          )
        }}
        empty={
          semua.length ? (
            <Empty title={saringan === 'akan' ? 'Tidak ada tanggal yang akan datang' : 'Tidak ada tanggal yang sudah lewat'}>Pilih Semua untuk melihat seluruh tanggal.</Empty>
          ) : (
            <Empty title="Belum ada tanggal" action={tambah(true)}>Tambah hari libur toko atau tanggal promo pertama.</Empty>
          )
        }
      />
    </PageBody>
  )
}
