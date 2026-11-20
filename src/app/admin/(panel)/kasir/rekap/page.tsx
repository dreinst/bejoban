import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { rekapBulanan, type BarisRekap } from '@/lib/kasir/analitik'
import { isoWib, rentangBulanWib, SUMBER_LABEL } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { PageBody, PageHeader, Section, StatCard } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { inputCls } from '@/components/admin/form-cls'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const tanda = (n: number) => (n > 0 ? `+${n}` : String(n))
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const namaBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`

// Rekap bulanan barang masuk dan keluar per barang dan cabang (bulan WIB), plus unduhan CSV untuk tim data.
export default async function RekapKasir({ searchParams }: PageProps<'/admin/kasir/rekap'>) {
  await requireOwner()
  const sp = await searchParams
  const sekarang = new Date()
  const hariIni = isoWib(sekarang)
  const bulanIni = hariIni.slice(0, 7)
  const bulan = typeof sp.bulan === 'string' && rentangBulanWib(sp.bulan) && sp.bulan <= bulanIni ? sp.bulan : bulanIni
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const kasir = branches.filter((b) => b.modeStok === 'kasir')
  const cabangId = kasir.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : null
  const rows = await rekapBulanan(rentangBulanWib(bulan)!, cabangId)
  const nama = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  const jumlah = (k: 'masuk' | 'terjual' | 'nilaiTerjual' | 'penyesuaian') => rows.reduce((n, r) => n + r[k], 0)
  const dariEkspor = isoWib(new Date(sekarang.getTime() - 83 * 24 * 3600_000))

  return (
    <PageBody>
      <PageHeader title="Rekap dan ekspor" note="Rekap barang masuk dan keluar per barang dan cabang dalam satu bulan (WIB). Jasa tidak punya stok, jadi tidak ikut di rekap ini." />
      <form className="adm-card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label htmlFor="rk-bulan" className="mb-1 block text-xs font-semibold text-neutral-700">Bulan</label>
          <input id="rk-bulan" type="month" name="bulan" defaultValue={bulan} max={bulanIni} className={`${inputCls} min-h-11`} />
        </div>
        {kasir.length > 1 && (
          <div>
            <label htmlFor="rk-cabang" className="mb-1 block text-xs font-semibold text-neutral-700">Cabang</label>
            <select id="rk-cabang" name="cabang" defaultValue={cabangId ?? ''} className={`${inputCls} min-h-11`}>
              <option value="">Semua cabang</option>
              {kasir.map((b) => <option key={b.id} value={b.id}>{namaPendek(b.name)}</option>)}
            </select>
          </div>
        )}
        <button className="adm-btn-line min-h-11">Tampilkan</button>
      </form>

      <section aria-labelledby="judul-rekap" className="space-y-3">
        <h2 id="judul-rekap" className="font-display text-lg font-extrabold text-ink">{namaBulan(bulan)}{cabangId !== null ? `, ${nama(cabangId)}` : ''}</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Barang masuk" value={`${jumlah('masuk')} pcs`} hint="Menurut tanggal terima" />
          <StatCard label="Terjual" value={`${jumlah('terjual')} pcs`} hint="Transaksi selesai, tanpa void" />
          <StatCard label="Nilai terjual" value={rp(jumlah('nilaiTerjual'))} hint="Ban dan produk, sesudah diskon" />
          <StatCard label="Opname dan koreksi" value={tanda(jumlah('penyesuaian'))} hint="Selisih yang diterapkan" />
        </div>
        <DataTable<BarisRekap>
          caption={`Rekap barang ${namaBulan(bulan)}`}
          rows={rows}
          rowKey={(r) => `${r.sumber}:${r.barisId}`}
          columns={[
            { key: 'nama', header: 'Barang', mobile: 'title', cell: (r) => <Link href={`/admin/kasir/barang?sumber=${r.sumber}&id=${r.barisId}`} className="block font-semibold text-ink underline underline-offset-2">{r.nama}<span className="block text-xs font-normal text-mute no-underline">{SUMBER_LABEL[r.sumber]}</span></Link> },
            ...(cabangId === null && kasir.length > 1 ? [{ key: 'cabang', header: 'Cabang', cell: (r: BarisRekap) => nama(r.cabangId) }] : []),
            { key: 'masuk', header: 'Masuk', align: 'right', cell: (r) => r.masuk || '-' },
            { key: 'terjual', header: 'Terjual', align: 'right', cell: (r) => r.terjual || '-' },
            { key: 'nilai', header: 'Nilai terjual', align: 'right', cell: (r) => (r.nilaiTerjual ? <span className="whitespace-nowrap">{rp(r.nilaiTerjual)}</span> : '-') },
            { key: 'sesuai', header: 'Opname dan koreksi', align: 'right', cell: (r) => (r.penyesuaian ? tanda(r.penyesuaian) : '-') },
            { key: 'stok', header: 'Stok sekarang', align: 'right', cell: (r) => r.stokSekarang ?? '-' },
          ]}
          empty={<p className="py-6 text-center text-sm text-mute">Belum ada barang masuk, penjualan, atau opname di bulan ini.</p>}
        />
      </section>

      <Section id="ekspor" title="Ekspor CSV untuk tim data" description="Berkas CSV (pemisah koma, UTF-8). Arti tiap kolom ada di dokumentasi kasir. Isinya data toko, jadi simpan dan bagikan dengan hati-hati.">
        <form action="/api/kasir/ekspor" method="get" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="ek-dari" className="mb-1 block text-xs font-semibold text-neutral-700">Dari</label>
              <input id="ek-dari" type="date" name="dari" defaultValue={dariEkspor} max={hariIni} required className={`${inputCls} min-h-11`} />
            </div>
            <div>
              <label htmlFor="ek-sampai" className="mb-1 block text-xs font-semibold text-neutral-700">Sampai</label>
              <input id="ek-sampai" type="date" name="sampai" defaultValue={hariIni} max={hariIni} required className={`${inputCls} min-h-11`} />
            </div>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {[
              { jenis: 'penjualan', judul: 'Penjualan per minggu', isi: 'Jumlah terjual per barang, cabang, minggu, dan channel, dengan harga asli, diskon, harga efektif, dan penanda stok sempat habis.' },
              { jenis: 'stok-habis', judul: 'Stok habis', isi: 'Kapan stok tiap barang turun ke 0 dan kapan tersedia lagi, dari buku stok.' },
              { jenis: 'barang-masuk', judul: 'Barang masuk', isi: 'Tiap barang yang diterima dengan pemasok, harga beli, harga jual, dan lead time dari tanggal pesan ke tanggal terima.' },
            ].map((x) => (
              <li key={x.jenis} className="flex flex-col gap-3 rounded-lg border border-line p-4">
                <p className="font-semibold text-ink">{x.judul}</p>
                <p className="flex-1 text-sm text-mute">{x.isi}</p>
                <button name="jenis" value={x.jenis} className="adm-btn-line min-h-11">Unduh {x.judul.toLowerCase()}</button>
              </li>
            ))}
          </ul>
        </form>
      </Section>
    </PageBody>
  )
}
