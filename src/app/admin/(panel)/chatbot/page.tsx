import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { markConversation } from '../../fitur-actions'
import { STATUSES, STATUS_LABEL, isClosed, type Status } from '@/lib/bot/conversation'
import { waktuWib, waLink } from '@/lib/format'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { SaringSelect } from '@/components/admin/saring-select'
import { DataTable, FilterChips, Halaman, ListToolbar } from '@/components/admin/data-table'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'

const PER = 30
const pendek = (name: string) => name.replace(/\s*\(.*\)/, '')

// Percakapan WhatsApp yang ditangani bot. Owner melihat semua cabang, admin cabang hanya cabangnya.
export default async function Chatbot({ searchParams }: PageProps<'/admin/chatbot'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const status = STATUSES.find((x) => x === sp.status) ?? null
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, slug: true, name: true } })
  const milik = owner ? null : (branches.find((b) => b.id === s.branchId)?.slug ?? '-')
  const cabang = owner ? String(sp.cabang ?? '') : milik!
  // Admin cabang tanpa cabang tidak boleh melihat percakapan "belum diketahui" milik orang lain: daftarnya kosong.
  const tanpaCabang = !owner && milik === '-'
  const filterCabang = tanpaCabang ? { id: -1 } : cabang ? { branchSlug: cabang === '-' ? '' : cabang } : {}
  const q = String(Array.isArray(sp.q) ? sp.q[0] : (sp.q ?? '')).trim().slice(0, 80)
  const cari = q ? { OR: [{ customer: { contains: q.replace(/\D/g, '').replace(/^0/, '') || q, mode: 'insensitive' as const } }, { question: { contains: q, mode: 'insensitive' as const } }, { sizes: { contains: q, mode: 'insensitive' as const } }] } : {}
  const where = { ...(status && { status }), ...filterCabang, ...cari }
  const hal = Math.max(1, Math.floor(Number(String(Array.isArray(sp.hal) ? sp.hal[0] : (sp.hal ?? '1'))) || 1))
  const [convs, filtered, counts] = await Promise.all([
    db.botConversation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (hal - 1) * PER, take: PER }),
    db.botConversation.count({ where }),
    db.botConversation.groupBy({ by: ['status'], where: filterCabang, _count: true }),
  ])
  const count = (x: string) => counts.find((c) => c.status === x)?._count ?? 0
  const total = counts.reduce((n, c) => n + c._count, 0)
  const href = (st: string | null, cb: string, h = 1) => {
    const p = new URLSearchParams(Object.entries({ status: st ?? '', cabang: owner ? cb : '', q, hal: h > 1 ? String(h) : '' }).filter(([, v]) => v))
    return `/admin/chatbot${p.size ? `?${p}` : ''}`
  }
  const cabangItems: [string, string][] = [['', 'Semua'], ...branches.map((b): [string, string] => [b.slug, pendek(b.name)]), ['-', 'Belum diketahui']]

  return (
    <PageBody>
      <PageHeader
        title="Percakapan"
        note="Bot menjawab dari data stok dan harga jasa, dan yang tidak bisa dijawab diserahkan ke admin. Tandai selesai setelah pelanggan dibalas."
      />
      <ListToolbar
        count={filtered}
        total={total}
        noun="percakapan"
        search={{ placeholder: 'Cari nomor atau pertanyaan', label: 'Cari percakapan', value: q, keep: { status: status ?? '', cabang: owner ? cabang : '' } }}
      >
        <FilterChips
          label="Saring status"
          items={[
            { href: href(null, cabang), label: 'Semua', active: !status },
            ...STATUSES.map((x) => ({ href: href(x, cabang), label: STATUS_LABEL[x], active: status === x, count: count(x) })),
          ]}
        />
      </ListToolbar>
      {owner && <SaringSelect label="Cabang" value={cabang} options={cabangItems.map(([v, l]) => ({ value: v, label: l, href: href(status, v) }))} />}
      <DataTable
        caption="Daftar percakapan chatbot"
        actionsBelow
        rows={convs}
        rowKey={(c) => c.id}
        columns={[
          { key: 'terakhir', header: 'Terakhir', mobile: 'meta', className: 'whitespace-nowrap', cell: (c) => waktuWib(c.updatedAt) },
          {
            key: 'pelanggan',
            header: 'Pelanggan',
            mobile: 'title',
            cell: (c) => (
              <>
                {/^\d{9,15}$/.test(c.customer) ? (
                  <a href={waLink(c.customer)} target="_blank" rel="noopener noreferrer" aria-label={`Balas ${c.customer} lewat WhatsApp (tab baru)`} className="font-semibold text-ink underline">{c.customer}</a>
                ) : (
                  <span className="font-semibold text-ink">{c.customer || '-'}</span>
                )}
                {c.awaitingBranch && <span className="block text-xs text-mute">menunggu jawaban cabang</span>}
              </>
            ),
          },
          { key: 'cabang', header: 'Cabang', cell: (c) => pendek(branches.find((b) => b.slug === c.branchSlug)?.name ?? '(belum diketahui)') },
          { key: 'tanya', header: 'Pertanyaan', mobileLabel: false, className: 'max-w-[240px]', cell: (c) => c.question },
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
          tanpaCabang ? (
            <Empty title="Akun belum terhubung ke cabang">Minta owner mengisi cabang untuk akun kamu di Pengaturan, tab Pengguna.</Empty>
          ) : q ? (
            <Empty title="Tidak ketemu">Tidak ada percakapan yang cocok dengan &quot;{q}&quot;.</Empty>
          ) : status || (owner && cabang) ? (
            <Empty title="Tidak ada percakapan">Tidak ada percakapan dengan saringan ini. Pilih Semua untuk melihat seluruhnya.</Empty>
          ) : (
            <Empty title="Belum ada percakapan">Percakapan muncul di sini begitu pelanggan menghubungi nomor WhatsApp toko.</Empty>
          )
        }
      />
      <Halaman hal={hal} total={filtered} per={PER} href={(n) => href(status, cabang, n)} />
    </PageBody>
  )
}
