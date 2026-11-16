import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { markConversation } from '../../fitur-actions'
import { STATUSES, STATUS_LABEL, isClosed, type Status } from '@/lib/bot/conversation'
import { Card } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

const wib = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
const pendek = (name: string) => name.replace(/\s*\(.*\)/, '')

// Percakapan WhatsApp yang ditangani bot. Owner melihat semua cabang, admin cabang hanya cabangnya.
export default async function Chatbot({ searchParams }: PageProps<'/admin/chatbot'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const status = STATUSES.find((x) => x === sp.status) ?? null
  const branches = await db.branch.findMany({ orderBy: { sort: 'asc' }, select: { id: true, slug: true, name: true } })
  const milik = owner ? null : (branches.find((b) => b.id === s.branchId)?.slug ?? '-')
  const cabang = owner ? String(sp.cabang ?? '') : milik!
  const filterCabang = cabang ? { branchSlug: cabang === '-' ? '' : cabang } : {}
  const [convs, counts] = await Promise.all([
    db.botConversation.findMany({ where: { ...(status && { status }), ...filterCabang }, orderBy: { updatedAt: 'desc' }, take: 60 }),
    db.botConversation.groupBy({ by: ['status'], where: filterCabang, _count: true }),
  ])
  const count = (x: string) => counts.find((c) => c.status === x)?._count ?? 0
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-neutral-300'}`
  const href = (st: string | null, cb: string) => {
    const p = new URLSearchParams(Object.entries({ status: st ?? '', cabang: owner ? cb : '' }).filter(([, v]) => v))
    return `/admin/chatbot${p.size ? `?${p}` : ''}`
  }
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        title="Percakapan chatbot"
        note="Bot menjawab dari data stok dan harga jasa. Kalau datanya tidak ada atau pesannya tidak dikenali, percakapan diserahkan ke admin. Tandai selesai setelah pelanggan dibalas."
      />
      <Card title="Percakapan">
        <div className="mb-3 flex flex-wrap gap-2">
          <a href={href(null, cabang)} className={chip(!status)}>Semua</a>
          {STATUSES.map((x) => <a key={x} href={href(x, cabang)} className={chip(status === x)}>{STATUS_LABEL[x]} ({count(x)})</a>)}
        </div>
        {owner && (
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-600">Cabang:</span>
            {[['', 'Semua'], ...branches.map((b) => [b.slug, pendek(b.name)]), ['-', 'Belum diketahui']].map(([v, l]) => (
              <a key={v} href={href(status, v)} className={chip(cabang === v)}>{l}</a>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-neutral-50">
              <tr>{['Terakhir', 'Pelanggan', 'Cabang', 'Pertanyaan', 'Ukuran', 'Hasil pencarian', 'Status', ''].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">{h}</th>)}</tr>
            </thead>
            <tbody>
              {convs.map((c) => (
                <tr key={c.id} className="border-t border-neutral-100 align-top">
                  <td className="whitespace-nowrap px-3 py-1.5">{wib(c.updatedAt)}</td>
                  <td className="px-3 py-1.5">{c.customer || '-'}{c.awaitingBranch && <span className="block text-xs text-neutral-500">menunggu jawaban cabang</span>}</td>
                  <td className="px-3 py-1.5">{pendek(branches.find((b) => b.slug === c.branchSlug)?.name ?? '(belum diketahui)')}</td>
                  <td className="max-w-[220px] px-3 py-1.5">{c.question}</td>
                  <td className="px-3 py-1.5">{c.sizes.split(',').filter(Boolean).join(', ') || '-'}</td>
                  <td className="max-w-[220px] px-3 py-1.5 text-xs text-neutral-600">{c.result || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-semibold">{STATUS_LABEL[c.status as Status] ?? c.status}</td>
                  <td className="px-3 py-1.5">
                    {!isClosed(c.status) && (
                      <form action={markConversation} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={c.id} />
                        <button name="to" value="ada" className="adm-btn-line adm-btn-sm">Selesai, tersedia</button>
                        <button name="to" value="tidak_ada" className="adm-btn-line adm-btn-sm !border-neutral-400 !text-neutral-700">Selesai, tidak tersedia</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!convs.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-500">Belum ada percakapan.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Selesai, tidak tersedia: bot mengirim kalimat penutup ke pelanggan. Setelah ditandai selesai, bot kembali membalas di chat itu.</p>
      </Card>
    </div>
  )
}
