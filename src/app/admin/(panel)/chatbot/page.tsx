import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { markConversation } from '../../fitur-actions'
import { STATUSES, STATUS_LABEL, isClosed, type Status } from '@/lib/bot/conversation'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, ListToolbar } from '@/components/admin/data-table'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'

const wib = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
  const total = counts.reduce((n, c) => n + c._count, 0)
  const href = (st: string | null, cb: string) => {
    const p = new URLSearchParams(Object.entries({ status: st ?? '', cabang: owner ? cb : '' }).filter(([, v]) => v))
    return `/admin/chatbot${p.size ? `?${p}` : ''}`
  }
  const cabangItems: [string, string][] = [['', 'Semua'], ...branches.map((b): [string, string] => [b.slug, pendek(b.name)]), ['-', 'Belum diketahui']]

  return (
    <PageBody>
      <PageHeader
        title="Percakapan chatbot"
        note="Bot menjawab dari data stok dan harga jasa. Kalau datanya tidak ada atau pesannya tidak dikenali, percakapan diserahkan ke admin. Tandai selesai setelah pelanggan dibalas."
      />
      <ListToolbar count={convs.length} total={total} noun="percakapan">
        <FilterChips
          label="Saring status"
          items={[
            { href: href(null, cabang), label: 'Semua', active: !status },
            ...STATUSES.map((x) => ({ href: href(x, cabang), label: STATUS_LABEL[x], active: status === x, count: count(x) })),
          ]}
        />
      </ListToolbar>
      {owner && (
        <div className="-mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-mute">Cabang</span>
          <FilterChips label="Saring cabang" items={cabangItems.map(([v, l]) => ({ href: href(status, v), label: l, active: cabang === v }))} />
        </div>
      )}
      <DataTable
        caption="Daftar percakapan chatbot"
        rows={convs}
        rowKey={(c) => c.id}
        columns={[
          { key: 'terakhir', header: 'Terakhir', mobile: 'meta', className: 'whitespace-nowrap', cell: (c) => wib(c.updatedAt) },
          {
            key: 'pelanggan',
            header: 'Pelanggan',
            mobile: 'title',
            cell: (c) => (
              <>
                <span className="font-semibold text-ink">{c.customer || '-'}</span>
                {c.awaitingBranch && <span className="block text-xs text-mute">menunggu jawaban cabang</span>}
              </>
            ),
          },
          { key: 'cabang', header: 'Cabang', cell: (c) => pendek(branches.find((b) => b.slug === c.branchSlug)?.name ?? '(belum diketahui)') },
          { key: 'tanya', header: 'Pertanyaan', className: 'max-w-[240px]', cell: (c) => c.question },
          { key: 'ukuran', header: 'Ukuran', cell: (c) => c.sizes.split(',').filter(Boolean).join(', ') || '-' },
          { key: 'hasil', header: 'Hasil pencarian', mobile: 'hide', className: 'max-w-[240px] text-xs text-mute', cell: (c) => c.result || '-' },
          {
            key: 'status',
            header: 'Status',
            mobileLabel: false,
            cell: (c) => <Badge tone={isClosed(c.status) ? 'light' : 'dark'}>{STATUS_LABEL[c.status as Status] ?? c.status}</Badge>,
          },
        ]}
        actions={(c) => {
          if (isClosed(c.status)) return null
          const nama = c.customer || 'pelanggan ini'
          return (
            <>
              <form action={markConversation}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="to" value="ada" />
                <SubmitButton className="adm-btn-line adm-btn-sm w-full" pending="Memproses...">Selesai, tersedia</SubmitButton>
              </form>
              <ConfirmDialog
                trigger="Selesai, tidak tersedia"
                triggerLabel={`Selesai, tidak tersedia untuk ${nama}`}
                title="Tandai selesai, tidak tersedia?"
                message={
                  <>
                    <p>Bot mengirim kalimat penutup ke {nama}, bahwa barang yang ditanyakan tidak tersedia.</p>
                    <p className="text-mute">Setelah itu percakapan ditutup dan bot kembali membalas di chat itu.</p>
                  </>
                }
                confirm={{ action: markConversation, fields: { id: c.id, to: 'tidak_ada' }, label: 'Selesai, tidak tersedia' }}
              />
            </>
          )
        }}
        empty={
          status || cabang ? (
            <Empty title="Tidak ada percakapan">Tidak ada percakapan dengan saringan ini. Pilih Semua untuk melihat seluruhnya.</Empty>
          ) : (
            <Empty title="Belum ada percakapan">Percakapan muncul di sini begitu pelanggan menghubungi nomor WhatsApp toko.</Empty>
          )
        }
      />
    </PageBody>
  )
}
