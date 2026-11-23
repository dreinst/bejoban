import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { CHANNEL_LABEL, isoWib, METODE_BAYAR, METODE_LABEL, rentangHariWib, type Channel, type MetodeBayar } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips } from '@/components/admin/data-table'
import { inputCls } from '@/components/admin/form-cls'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'

const BATAS = 300
const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const tanggalLabel = (iso: string) => waktuWib(new Date(`${iso}T00:00:00+07:00`)).replace(/, \d{2}\.\d{2}$/, '')

// Riwayat transaksi dengan saringan tanggal (WIB) dan cabang, plus rekap per cabang untuk tutup kas.
// Admin cabang hanya melihat cabangnya.
export default async function Riwayat({ searchParams }: PageProps<'/admin/kasir/riwayat'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const sekarang = new Date()
  const hariIni = isoWib(sekarang)
  const kemarin = isoWib(new Date(sekarang.getTime() - 24 * 3600_000))
  let dari = String(sp.dari ?? '') || hariIni
  let sampai = String(sp.sampai ?? '') || dari
  let rentang = rentangHariWib(dari, sampai)
  if (!rentang) {
    dari = sampai = hariIni
    rentang = rentangHariWib(dari, sampai)!
  }
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const cabangId = owner ? (branches.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : null) : (s.branchId ?? -1)
  const status = sp.status === 'void' ? 'void' : ''
  const where = {
    waktuTransaksi: { gte: rentang.mulai, lt: rentang.akhir },
    ...(cabangId !== null && { cabangId }),
  }
  const [rows, total, rekap] = await Promise.all([
    db.transaksi.findMany({ where: { ...where, ...(status && { status }) }, orderBy: { waktuTransaksi: 'desc' }, take: BATAS, include: { _count: { select: { detail: true } } } }),
    db.transaksi.count({ where: { ...where, ...(status && { status }) } }),
    db.transaksi.groupBy({ by: ['cabangId', 'status', 'metodeBayar'], where, _count: true, _sum: { total: true, diskon: true } }),
  ])
  const nama = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  const cabangRekap = [...new Set(rekap.map((r) => r.cabangId))].toSorted((a, b) => branches.findIndex((x) => x.id === a) - branches.findIndex((x) => x.id === b))
  const ringkas = cabangRekap.map((id) => {
    const r = rekap.filter((x) => x.cabangId === id)
    const selesai = r.filter((x) => x.status === 'selesai')
    return {
      id,
      transaksi: selesai.reduce((n, x) => n + x._count, 0),
      void: r.filter((x) => x.status === 'void').reduce((n, x) => n + x._count, 0),
      diskon: selesai.reduce((n, x) => n + (x._sum.diskon ?? 0), 0),
      total: selesai.reduce((n, x) => n + (x._sum.total ?? 0), 0),
      metode: METODE_BAYAR.map((m) => ({ m, n: selesai.filter((x) => x.metodeBayar === m).reduce((a, x) => a + (x._sum.total ?? 0), 0) })),
    }
  })
  const url = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ dari, sampai: sampai === dari ? '' : sampai, cabang: cabangId !== null && owner ? String(cabangId) : '', status, ...patch }).filter(([, v]) => v))
    return `/admin/kasir/riwayat${p.size ? `?${p}` : ''}`
  }
  const judulRentang = dari === sampai ? tanggalLabel(dari) : `${tanggalLabel(dari)} sampai ${tanggalLabel(sampai)}`
  type Baris = (typeof rows)[number]

  return (
    <PageBody>
      <PageHeader title="Riwayat transaksi" note={owner ? 'Transaksi kasir semua cabang. Buka nomor nota untuk melihat rincian, mencetak ulang, atau void.' : 'Transaksi kasir cabang kamu. Buka nomor nota untuk melihat rincian, mencetak ulang, atau void.'} />
      <SegarkanSaatSiaran jenis={['transaksi']} cabangId={cabangId} />
      <form className="adm-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="r-dari" className="mb-1 block text-xs font-semibold text-neutral-700">Dari</label>
          <input id="r-dari" type="date" name="dari" defaultValue={dari} max={hariIni} className={`${inputCls} min-h-11`} />
        </div>
        <div>
          <label htmlFor="r-sampai" className="mb-1 block text-xs font-semibold text-neutral-700">Sampai</label>
          <input id="r-sampai" type="date" name="sampai" defaultValue={sampai} max={hariIni} className={`${inputCls} min-h-11`} />
        </div>
        {owner && (
          <div>
            <label htmlFor="r-cabang" className="mb-1 block text-xs font-semibold text-neutral-700">Cabang</label>
            <select id="r-cabang" name="cabang" defaultValue={cabangId ?? ''} className={`${inputCls} min-h-11`}>
              <option value="">Semua cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{namaPendek(b.name)}</option>)}
            </select>
          </div>
        )}
        {status && <input type="hidden" name="status" value={status} />}
        <button className="adm-btn-line min-h-11">Terapkan</button>
        <span className="flex flex-wrap gap-2">
          <Link href={url({ dari: hariIni, sampai: '' })} className="adm-btn-ghost adm-btn-sm min-h-11">Hari ini</Link>
          <Link href={url({ dari: kemarin, sampai: '' })} className="adm-btn-ghost adm-btn-sm min-h-11">Kemarin</Link>
        </span>
      </form>

      <section aria-labelledby="judul-rekap" className="space-y-3">
        <h2 id="judul-rekap" className="font-display text-lg font-extrabold text-ink">Rekap {judulRentang}</h2>
        {ringkas.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {ringkas.map((r) => (
              <div key={r.id} className="adm-card p-5">
                <p className="font-display text-base font-extrabold text-ink">{nama(r.id)}</p>
                <p className="mt-1 text-3xl font-extrabold text-ink">{rp(r.total)}</p>
                <p className="text-sm text-mute">{r.transaksi} transaksi selesai{r.void ? `, ${r.void} void` : ''}{r.diskon ? `, diskon ${rp(r.diskon)}` : ''}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                  {r.metode.map((x) => (
                    <div key={x.m}>
                      <dt className="text-xs text-mute">{METODE_LABEL[x.m]}</dt>
                      <dd className="font-semibold text-ink">{rp(x.n)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-mute">Belum ada transaksi di rentang ini.</p>
        )}
      </section>

      <section aria-labelledby="judul-daftar" className="space-y-3">
        <h2 id="judul-daftar" className="sr-only">Daftar transaksi</h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-mute"><b className="text-ink">{rows.length}</b> transaksi{total > rows.length ? ` dari ${total}` : ''}</p>
          <FilterChips label="Saring status" items={[{ href: url({ status: '' }), label: 'Semua', active: !status }, { href: url({ status: 'void' }), label: 'Void', active: status === 'void' }]} />
        </div>
        <DataTable<Baris>
          caption="Daftar transaksi"
          rows={rows}
          rowKey={(t) => t.id}
          muted={(t) => t.status === 'void'}
          columns={[
            { key: 'nomor', header: 'Nomor', mobile: 'title', cell: (t) => <Link href={`/admin/nota/${t.id}`} className="max-md:inline-flex max-md:min-h-11 max-md:items-center font-semibold text-ink underline underline-offset-2">{t.nomor}</Link> },
            { key: 'waktu', header: 'Waktu', cell: (t) => waktuWib(t.waktuTransaksi) },
            // Di tablet kolom cabang disembunyikan: awalan nomor nota sudah menunjukkan cabangnya.
            ...(owner && cabangId === null ? [{ key: 'cabang', header: 'Cabang', sembunyiTablet: true, cell: (t: Baris) => nama(t.cabangId) }] : []),
            { key: 'kasir', header: 'Kasir', mobile: 'hide', sembunyiTablet: true, cell: (t) => t.namaKasir },
            { key: 'bayar', header: 'Bayar', cell: (t) => `${METODE_LABEL[t.metodeBayar as MetodeBayar] ?? t.metodeBayar} · ${CHANNEL_LABEL[t.channel as Channel] ?? t.channel}` },
            { key: 'total', header: 'Total', align: 'right', cell: (t) => <span className="font-semibold">{rp(t.total)}</span> },
            { key: 'status', header: 'Status', cell: (t) => (t.status === 'void' ? <Badge tone="danger">VOID</Badge> : t.diskon > 0 ? <Badge tone="light">selesai, diskon</Badge> : 'Selesai') },
          ]}
          actions={(t) => <Link href={`/admin/nota/${t.id}`} className="adm-btn-line adm-btn-sm" aria-label={`Buka nota ${t.nomor}`}>Nota</Link>}
          empty={<Empty title="Tidak ada transaksi">Ubah tanggal atau cabang.</Empty>}
        />
        {total > rows.length && <p className="text-xs text-mute">Menampilkan {rows.length} terbaru dari {total}. Persempit tanggalnya.</p>}
      </section>
    </PageBody>
  )
}
