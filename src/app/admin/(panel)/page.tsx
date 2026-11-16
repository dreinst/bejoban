import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { hitungPerluDicek } from '@/lib/perlu-dicek'
import { waktuWib } from '@/lib/format'
import { PageBody, PageHeader, StatCard } from '@/components/admin/ui'


// Tanggal awal (waktu Jakarta) untuk hitungan 7 hari terakhir.
const sevenDaysAgo = () => new Date(Date.now() + 7 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10)

// Ringkasan: hanya angka yang bisa ditindaklanjuti, masing-masing menuju halamannya. Angka 0 disembunyikan.
// Owner melihat semua cabang plus klik WhatsApp dan sinkron pricelist; admin cabang hanya cabangnya.
export default async function Dashboard() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const cabang = owner ? null : await db.branch.findUnique({ where: { id: s.branchId ?? -1 }, select: { slug: true, name: true } })
  const [cek, menunggu, noPhoto] = await Promise.all([
    hitungPerluDicek(s),
    db.botConversation.count({ where: { status: 'DISERAHKAN', ...(!owner && { branchSlug: cabang?.slug ?? '-' }) } }),
    db.product.count({ where: { active: true, images: '[]' } }),
  ])

  const tugas = [
    { n: menunggu, label: 'Percakapan menunggu admin', hint: 'balas pelanggan lalu tandai selesai', href: '/admin/chatbot?status=DISERAHKAN' },
    { n: cek.stokKosong, label: 'Stok ban habis', hint: owner ? 'semua cabang' : 'di cabang kamu', href: owner ? '/admin/stok-ban?f=habis' : '/admin/peringatan' },
    { n: cek.hargaMasalah, label: 'Harga ban perlu diisi', hint: 'harga kosong atau tidak terbaca', href: '/admin/peringatan#harga' },
    { n: cek.produkStok0, label: 'Produk situs stok 0', hint: 'masih dicentang Dijual', href: '/admin/peringatan#produk' },
    { n: noPhoto, label: 'Produk tanpa foto', hint: 'tampil di situs tanpa gambar', href: '/admin/harga?f=tanpa-foto' },
  ].filter((t) => t.n > 0)

  let info: React.ReactNode = null
  if (owner) {
    const [klik, branches, last] = await Promise.all([
      db.waClick.groupBy({ by: ['branch'], where: { day: { gte: sevenDaysAgo() } }, _sum: { count: true } }),
      db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
      db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
    ])
    const li = last ? (JSON.parse(last.value) as { at: string; source?: string; total: number; problemCount: number }) : null
    const click = (slug: string) => klik.find((k) => k.branch === slug)?._sum.count ?? 0
    const kartu = 'adm-card block p-5 transition hover:-translate-y-px hover:shadow-md'
    info = (
      <div className="grid gap-5 lg:grid-cols-2">
        <Link href="/admin/situs" className={kartu}>
          <p className="mb-3 font-display text-base font-extrabold text-ink">Klik WhatsApp, 7 hari terakhir</p>
          <ul className="divide-y divide-line text-sm">
            {branches.map((b) => (
              <li key={b.slug} className="flex items-center justify-between py-2"><span>{b.name.replace(/\s*\(.*\)/, '')}</span><b className="font-display text-lg">{click(b.slug)}</b></li>
            ))}
            <li className="flex items-center justify-between py-2 text-mute"><span>Tautan umum</span><b className="font-display text-lg text-ink">{click('')}</b></li>
          </ul>
        </Link>
        <Link href="/admin/stok-ban" className={kartu}>
          <p className="mb-3 font-display text-base font-extrabold text-ink">Sinkron pricelist terakhir</p>
          {li ? (
            <>
              <p className="font-display text-xl font-extrabold text-ink">{waktuWib(li.at)}</p>
              <p className="mt-1 text-sm text-mute">{li.source === 'sheet' ? 'Google Sheets' : 'Berkas CSV'}, {li.total} ban, {li.problemCount} baris bermasalah saat impor.</p>
            </>
          ) : (
            <p className="text-sm text-mute">Belum pernah sinkron. Buka Stok ban untuk mengisi.</p>
          )}
        </Link>
      </div>
    )
  }

  return (
    <PageBody>
      <PageHeader title="Ringkasan" note={owner ? undefined : `Cabang ${cabang?.name.replace(/\s*\(.*\)/, '') ?? 'kamu'}`} />
      {tugas.length ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
          {tugas.map((t) => <StatCard key={t.label} label={t.label} value={t.n} hint={t.hint} href={t.href} warn />)}
        </div>
      ) : (
        <div className="adm-card flex items-center gap-3 p-5">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-base font-bold text-white">✓</span>
          <p className="text-sm text-ink"><b>Semua beres.</b> Tidak ada stok, harga, atau percakapan yang menunggu.</p>
        </div>
      )}
      {info}
    </PageBody>
  )
}
