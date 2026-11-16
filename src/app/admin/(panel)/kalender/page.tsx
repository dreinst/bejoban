import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { Badge, Empty, PageHeader } from '@/components/admin/ui'
import { JENIS_KALENDER, LABEL_JENIS, type JenisKalender } from '@/lib/stok/kalender'
import { addKalender, deleteKalender } from './actions'

const tgl = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
// Tanggal hari ini menurut waktu Jakarta (YYYY-MM-DD).
const hariIni = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)

export default async function Kalender() {
  await requireOwner()
  const rows = await db.kalender.findMany({ orderBy: [{ tanggal: 'asc' }, { id: 'asc' }] })
  const kini = hariIni()
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Kalender libur dan promo" note="Hari libur toko dan tanggal promo. Tanggal yang sudah lewat tetap disimpan sebagai riwayat." />

      <Card title="+ Tanggal baru">
        <form action={addKalender} className="grid gap-3 md:grid-cols-[auto_auto_1fr_auto]">
          <label className={labelCls}>Tanggal<input type="date" name="tanggal" required className={inputCls} /></label>
          <label className={labelCls}>Jenis
            <select name="jenis" defaultValue="libur" className={inputCls}>
              {JENIS_KALENDER.map((j) => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}
            </select>
          </label>
          <label className={labelCls}>Keterangan<input name="keterangan" required maxLength={200} placeholder="mis. Libur Idulfitri" className={inputCls} /></label>
          <div className="flex items-end"><button className="adm-btn">Simpan</button></div>
        </form>
      </Card>

      <Card title={`Daftar (${rows.length})`}>
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className={`flex items-center justify-between gap-3 py-2 text-sm ${r.tanggal < kini ? 'text-mute' : ''}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.jenis === 'libur' ? 'dark' : r.jenis === 'promo' ? 'light' : 'outline'}>{LABEL_JENIS[r.jenis as JenisKalender] ?? r.jenis}</Badge>
                  <span className="font-semibold">{tgl(r.tanggal)}</span>
                  <span>{r.keterangan}</span>
                </span>
                <form action={deleteKalender}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="adm-btn-line adm-btn-sm" aria-label={`Hapus ${r.keterangan} ${r.tanggal}`}>Hapus</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Belum ada tanggal.</Empty>
        )}
      </Card>
    </div>
  )
}
