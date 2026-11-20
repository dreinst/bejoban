import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { isoWib, JENIS_PEMASOK_LABEL, rentangHariWib, type JenisPemasok } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { waktuWib } from '@/lib/format'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { inputCls } from '@/components/admin/form-cls'

const BATAS = 300
const tanggalLabel = (d: Date) => waktuWib(d).replace(/, \d{2}\.\d{2}$/, '')

// Daftar barang masuk dengan saringan tanggal terima (WIB) dan cabang. Admin cabang hanya melihat cabangnya.
export default async function DaftarBarangMasuk({ searchParams }: PageProps<'/admin/kasir/masuk'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const hariIni = isoWib(new Date())
  const awalBulan = `${hariIni.slice(0, 8)}01`
  let dari = String(sp.dari ?? '') || awalBulan
  let sampai = String(sp.sampai ?? '') || hariIni
  let rentang = rentangHariWib(dari, sampai)
  if (!rentang) {
    dari = awalBulan
    sampai = hariIni
    rentang = rentangHariWib(dari, sampai)!
  }
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const cabangId = owner ? (branches.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : null) : (s.branchId ?? -1)
  const bisaCatat = owner ? branches.some((b) => b.modeStok === 'kasir') : branches.find((b) => b.id === s.branchId)?.modeStok === 'kasir'
  const where = { tanggalTerima: { gte: rentang.mulai, lt: rentang.akhir }, ...(cabangId !== null && { cabangId }) }
  const [rows, total] = await Promise.all([
    db.barangMasuk.findMany({ where, orderBy: [{ tanggalTerima: 'desc' }, { id: 'desc' }], take: BATAS, include: { detail: { select: { jumlah: true, pengajuanHargaId: true } } } }),
    db.barangMasuk.count({ where }),
  ])
  const idPengajuan = rows.flatMap((r) => r.detail.map((d) => d.pengajuanHargaId)).filter((x): x is number => x !== null)
  const menunggu = new Set((await db.pengajuanHarga.findMany({ where: { id: { in: idPengajuan }, status: 'menunggu' }, select: { id: true } })).map((p) => p.id))
  const nama = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  type Baris = (typeof rows)[number]

  return (
    <PageBody>
      <PageHeader
        title="Barang masuk"
        note={bisaCatat ? 'Catat barang yang datang dari distributor atau toko rekanan. Stok cabang langsung bertambah.' : 'Barang masuk hanya untuk cabang yang sudah memakai kasir. Stok cabang mode sheet masih diisi dari sheet.'}
        actions={bisaCatat ? <Link href="/admin/kasir/masuk/baru" className="adm-btn min-h-11">Catat barang masuk</Link> : undefined}
      />
      <form className="adm-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="m-dari" className="mb-1 block text-xs font-semibold text-neutral-700">Diterima dari</label>
          <input id="m-dari" type="date" name="dari" defaultValue={dari} max={hariIni} className={`${inputCls} min-h-11`} />
        </div>
        <div>
          <label htmlFor="m-sampai" className="mb-1 block text-xs font-semibold text-neutral-700">Sampai</label>
          <input id="m-sampai" type="date" name="sampai" defaultValue={sampai} max={hariIni} className={`${inputCls} min-h-11`} />
        </div>
        {owner && (
          <div>
            <label htmlFor="m-cabang" className="mb-1 block text-xs font-semibold text-neutral-700">Cabang</label>
            <select id="m-cabang" name="cabang" defaultValue={cabangId ?? ''} className={`${inputCls} min-h-11`}>
              <option value="">Semua cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{namaPendek(b.name)}</option>)}
            </select>
          </div>
        )}
        <button className="adm-btn-line min-h-11">Terapkan</button>
      </form>
      <p className="text-sm text-mute"><b className="text-ink">{rows.length}</b> penerimaan{total > rows.length ? ` dari ${total}` : ''}</p>
      <DataTable<Baris>
        caption="Daftar barang masuk"
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: 'nomor', header: 'Nomor', mobile: 'title', cell: (r) => <Link href={`/admin/kasir/masuk/${r.id}`} className="whitespace-nowrap font-semibold text-ink underline underline-offset-2">{r.nomorPenerimaan}</Link> },
          { key: 'terima', header: 'Diterima', cell: (r) => tanggalLabel(r.tanggalTerima) },
          ...(owner && cabangId === null ? [{ key: 'cabang', header: 'Cabang', cell: (r: Baris) => nama(r.cabangId) }] : []),
          { key: 'pemasok', header: 'Pemasok', cell: (r) => <span className="block">{r.pemasok}<span className="block text-xs text-mute">{JENIS_PEMASOK_LABEL[r.jenisPemasok as JenisPemasok] ?? r.jenisPemasok}</span></span> },
          { key: 'jumlah', header: 'Jumlah', align: 'right', cell: (r) => `${r.detail.reduce((n, d) => n + d.jumlah, 0)} pcs` },
          { key: 'oleh', header: 'Dicatat', mobile: 'hide', cell: (r) => r.namaPengguna },
          { key: 'harga', header: 'Harga', cell: (r) => (r.detail.some((d) => d.pengajuanHargaId !== null && menunggu.has(d.pengajuanHargaId)) ? <Badge tone="light">menunggu owner</Badge> : '-') },
        ]}
        actions={(r) => <Link href={`/admin/kasir/masuk/${r.id}`} className="adm-btn-line adm-btn-sm" aria-label={`Buka ${r.nomorPenerimaan}`}>Rincian</Link>}
        empty={<Empty title="Belum ada barang masuk">Ubah tanggal atau cabang, atau catat barang masuk baru.</Empty>}
      />
      {total > rows.length && <p className="text-xs text-mute">Menampilkan {rows.length} terbaru dari {total}. Persempit tanggalnya.</p>}
    </PageBody>
  )
}
