import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { penjualanPerPeriode, penjualanPerSumber, terlaris, type PenjualanPeriode } from '@/lib/kasir/analitik'
import { awalMingguWib, isoWib, rentangHariWib, SUMBER_LABEL, type Sumber } from '@/lib/kasir/logika'
import { namaPendek } from '@/lib/tire/cabang'
import { waktuWib } from '@/lib/format'
import { Empty, PageBody, PageHeader, Section, StatCard } from '@/components/admin/ui'
import { DataTable, FilterChips } from '@/components/admin/data-table'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const HARI = 24 * 3600_000
const RENTANG = { '1': 'Hari ini', '7': '7 hari', '30': '30 hari' } as const
type KunciRentang = keyof typeof RENTANG
const labelTanggal = (iso: string) => waktuWib(new Date(`${iso}T00:00:00+07:00`)).replace(/, \d{2}\.\d{2}$/, '')

// Dashboard owner: penjualan harian dan mingguan per cabang, ban lawan jasa lawan produk, barang terlaris,
// stok menipis, dan pengajuan yang menunggu. Hari dan minggu dalam WIB, transaksi void tidak dihitung.
export default async function DashboardKasir({ searchParams }: PageProps<'/admin/kasir/dashboard'>) {
  await requireOwner()
  const sp = await searchParams
  const sekarang = new Date()
  const hariIni = isoWib(sekarang)
  const mundur = (n: number) => isoWib(new Date(sekarang.getTime() - n * HARI))
  const senin = awalMingguWib(sekarang)
  const seninLalu = (k: number) => isoWib(new Date(new Date(`${senin}T00:00:00+07:00`).getTime() - k * 7 * HARI))

  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const kasir = branches.filter((b) => b.modeStok === 'kasir')
  const cabangId = kasir.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : null
  const kolomCabang = cabangId === null ? kasir : kasir.filter((b) => b.id === cabangId)
  const rentang: KunciRentang = sp.rentang === '1' || sp.rentang === '30' ? sp.rentang : '7'
  const rRincian = rentangHariWib(rentang === '1' ? hariIni : mundur(Number(rentang) - 1), hariIni)!

  const [harian, mingguan, sumber, laris, peringatan, restock, diskon, opname] = await Promise.all([
    penjualanPerPeriode(rentangHariWib(mundur(6), hariIni)!, 'hari', cabangId),
    penjualanPerPeriode(rentangHariWib(seninLalu(7), hariIni)!, 'minggu', cabangId),
    penjualanPerSumber(rRincian, cabangId),
    terlaris(rRincian, cabangId, 10),
    db.peringatanStok.findMany({ where: { status: 'aktif', ...(cabangId !== null ? { cabangId } : { cabangId: { in: kasir.map((b) => b.id) } }) }, orderBy: { dibuat: 'desc' }, take: 10 }),
    db.pengajuanHarga.count({ where: { tipe: 'restock', status: 'menunggu', ...(cabangId !== null && { cabangId }) } }),
    db.pengajuanHarga.count({ where: { tipe: 'diskon', status: 'menunggu', ...(cabangId !== null && { cabangId }) } }),
    db.stokOpname.count({ where: { status: 'review', ...(cabangId !== null && { cabangId }) } }),
  ])
  const [banP, listingP] = await Promise.all([
    db.stockTire.findMany({ where: { id: { in: peringatan.filter((p) => p.sumber === 'ban').map((p) => p.barisId) } }, select: { id: true, sizeRaw: true, brand: true, stock: true } }),
    db.listing.findMany({ where: { id: { in: peringatan.filter((p) => p.sumber === 'produk').map((p) => p.barisId) } }, select: { id: true, stock: true, product: { select: { name: true } } } }),
  ])
  const nama = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  const url = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ cabang: cabangId === null ? '' : String(cabangId), rentang: rentang === '7' ? '' : rentang, ...patch }).filter(([, v]) => v))
    return `/admin/kasir/dashboard${p.size ? `?${p}` : ''}`
  }

  // Tabel periode: satu baris per hari atau minggu (termasuk yang kosong), satu kolom per cabang.
  const tabel = (data: PenjualanPeriode[], periode: string[]) =>
    periode.map((p) => {
      const isi = Object.fromEntries(kolomCabang.map((b) => [b.id, data.find((x) => x.periode === p && x.cabangId === b.id)]))
      return { periode: p, isi, total: data.filter((x) => x.periode === p).reduce((n, x) => n + x.bersih, 0) }
    })
  const hari7 = tabel(harian, Array.from({ length: 7 }, (_, i) => mundur(i)))
  const minggu8 = tabel(mingguan, Array.from({ length: 8 }, (_, i) => seninLalu(i)))
  type BarisPeriode = (typeof hari7)[number]
  const kolomPeriode = (judul: string, label: (p: string) => string) => [
    { key: 'periode', header: judul, mobile: 'title' as const, cell: (r: BarisPeriode) => label(r.periode) },
    ...kolomCabang.map((b) => ({
      key: `c${b.id}`,
      header: nama(b.id),
      align: 'right' as const,
      cell: (r: BarisPeriode) => {
        const x = r.isi[b.id]
        return x ? <span className="block whitespace-nowrap">{rp(x.bersih)}<span className="block text-xs text-mute">{x.transaksi} transaksi</span></span> : <span className="text-mute">-</span>
      },
    })),
    ...(kolomCabang.length > 1 ? [{ key: 'total', header: 'Total', align: 'right' as const, cell: (r: BarisPeriode) => <b className="whitespace-nowrap">{rp(r.total)}</b> }] : []),
  ]
  const totalSumber = sumber.reduce((n, x) => n + x.bersih, 0)
  const urutSumber = (['ban', 'jasa', 'produk'] as Sumber[]).map((k) => sumber.find((x) => x.sumber === k) ?? { sumber: k, jumlah: 0, bersih: 0, diskon: 0, kotor: 0 })
  type BarisLaris = (typeof laris)[number]
  type BarisPeringatan = (typeof peringatan)[number]

  return (
    <PageBody>
      <PageHeader title="Dashboard kasir" note="Angka dari transaksi kasir yang selesai, sesudah diskon. Transaksi void tidak dihitung. Hari dan minggu dalam WIB, minggu dimulai Senin." />
      <SegarkanSaatSiaran jenis={['transaksi', 'pengajuan', 'peringatan']} />
      {!kasir.length ? (
        <Empty title="Kasir belum aktif di cabang mana pun" action={<Link href="/admin/kasir/pengaturan" className="adm-btn">Buka Pengaturan kasir</Link>}>Dashboard terisi sesudah ada transaksi kasir.</Empty>
      ) : (
        <>
          {kasir.length > 1 && <FilterChips label="Cabang" items={[{ href: url({ cabang: '' }), label: 'Semua cabang', active: cabangId === null }, ...kasir.map((b) => ({ href: url({ cabang: String(b.id) }), label: nama(b.id), active: b.id === cabangId }))]} />}

          <section aria-labelledby="judul-hari-ini" className="space-y-3">
            <h2 id="judul-hari-ini" className="sr-only">Hari ini dan minggu ini</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kolomCabang.map((b) => {
                const h = hari7[0].isi[b.id]
                const m = minggu8[0].isi[b.id]
                return [
                  <StatCard key={`h${b.id}`} label={`${nama(b.id)} hari ini`} value={rp(h?.bersih ?? 0)} hint={`${h?.transaksi ?? 0} transaksi${h?.diskon ? `, diskon ${rp(h.diskon)}` : ''}`} href={`/admin/kasir/riwayat?cabang=${b.id}`} />,
                  <StatCard key={`m${b.id}`} label={`${nama(b.id)} minggu ini`} value={rp(m?.bersih ?? 0)} hint={`${m?.transaksi ?? 0} transaksi sejak Senin ${labelTanggal(senin)}`} href={`/admin/kasir/riwayat?cabang=${b.id}&dari=${senin}&sampai=${hariIni}`} />,
                ]
              })}
            </div>
          </section>

          <Section title="Menunggu keputusan">
            <ul className="grid gap-3 text-sm sm:grid-cols-3">
              {[
                { n: restock, label: 'usulan harga barang masuk', href: '/admin/kasir/pengajuan' },
                { n: diskon, label: 'diskon nota', href: '/admin/kasir/pengajuan' },
                { n: opname, label: 'opname menunggu final', href: '/admin/kasir/opname' },
              ].map((x) => (
                <li key={x.label}>
                  <Link href={x.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 py-2 hover:bg-soft">
                    <b className="text-lg text-ink">{x.n}</b> {x.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Penjualan 7 hari terakhir">
            <DataTable<BarisPeriode> caption="Penjualan per hari" tanpaBingkai rows={hari7} rowKey={(r) => r.periode} columns={kolomPeriode('Hari', labelTanggal)} />
          </Section>
          <Section title="Penjualan 8 minggu terakhir">
            <DataTable<BarisPeriode> caption="Penjualan per minggu" tanpaBingkai rows={minggu8} rowKey={(r) => r.periode} columns={kolomPeriode('Minggu mulai', (p) => `Senin ${labelTanggal(p)}`)} />
          </Section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold text-ink">Rincian {RENTANG[rentang].toLowerCase()}</h2>
            <FilterChips label="Rentang rincian" items={(Object.keys(RENTANG) as KunciRentang[]).map((k) => ({ href: url({ rentang: k === '7' ? '' : k }), label: RENTANG[k], active: k === rentang }))} />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Ban, jasa, dan produk">
              <ul className="space-y-3">
                {urutSumber.map((x) => {
                  const porsi = totalSumber ? Math.round((x.bersih / totalSumber) * 100) : 0
                  return (
                    <li key={x.sumber}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <span className="font-semibold text-ink">{SUMBER_LABEL[x.sumber as Sumber]}</span>
                        <span className="text-ink"><b>{rp(x.bersih)}</b> <span className="text-mute">· {x.jumlah} {x.sumber === 'jasa' ? 'layanan' : 'pcs'} · {porsi}%</span></span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-soft" aria-hidden><div className="h-2 rounded-full bg-ink" style={{ width: `${porsi}%` }} /></div>
                    </li>
                  )
                })}
              </ul>
            </Section>
            <Section title="Paling laris">
              <DataTable<BarisLaris>
                caption="Barang dan jasa paling laris"
                tanpaBingkai
                rows={laris}
                rowKey={(x) => `${x.sumber}:${x.kodeProduk}`}
                columns={[
                  { key: 'nama', header: 'Barang', mobile: 'title', cell: (x) => <span className="block"><span className="font-semibold text-ink">{x.nama}</span><span className="block text-xs text-mute">{SUMBER_LABEL[x.sumber as Sumber] ?? x.sumber}</span></span> },
                  { key: 'jumlah', header: 'Terjual', align: 'right', cell: (x) => x.jumlah },
                  { key: 'nilai', header: 'Nilai', align: 'right', cell: (x) => <span className="whitespace-nowrap">{rp(x.bersih)}</span> },
                ]}
                empty={<p className="py-4 text-sm text-mute">Belum ada penjualan di rentang ini.</p>}
              />
            </Section>
          </div>

          <Section title="Stok menipis" description="Peringatan yang masih aktif di cabang kasir." actions={<Link href="/admin/peringatan" className="adm-btn-line adm-btn-sm min-h-11">Buka Perlu dicek</Link>}>
            <DataTable<BarisPeringatan>
              caption="Stok menipis"
              tanpaBingkai
              rows={peringatan}
              rowKey={(p) => p.id}
              columns={[
                {
                  key: 'nama',
                  header: 'Barang',
                  mobile: 'title',
                  cell: (p) => {
                    const b = p.sumber === 'ban' ? banP.find((x) => x.id === p.barisId) : undefined
                    const l = p.sumber === 'produk' ? listingP.find((x) => x.id === p.barisId) : undefined
                    return <Link href={`/admin/kasir/barang?sumber=${p.sumber}&id=${p.barisId}`} className="font-semibold text-ink underline underline-offset-2">{b ? `${b.sizeRaw} ${b.brand}` : (l?.product.name ?? p.kodeProduk)}</Link>
                  },
                },
                { key: 'cabang', header: 'Cabang', cell: (p) => (p.cabangId === null ? '-' : nama(p.cabangId)) },
                { key: 'stok', header: 'Stok sekarang', align: 'right', cell: (p) => (p.sumber === 'ban' ? banP.find((x) => x.id === p.barisId)?.stock : listingP.find((x) => x.id === p.barisId)?.stock) ?? '-' },
                { key: 'batas', header: 'Batas', align: 'right', cell: (p) => p.batasMinimum },
              ]}
              empty={<p className="py-4 text-sm text-mute">Tidak ada stok yang menipis.</p>}
            />
          </Section>
        </>
      )}
    </PageBody>
  )
}
