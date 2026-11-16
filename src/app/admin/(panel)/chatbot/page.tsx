import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { clearBotLogs, markConversation, testBot } from '../../fitur-actions'
import { ChatbotTabs } from '@/components/admin/chatbot-tabs'
import { STATUSES, STATUS_LABEL, isClosed, type Status } from '@/lib/bot/conversation'
import { inputCls } from '@/components/admin/section-editor'
import { Card } from '@/components/admin/simple-list'

const wib = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

export default async function Chatbot({ searchParams }: PageProps<'/admin/chatbot'>) {
  await requireOwner()
  const sp = await searchParams
  const logId = Number(sp.log) || 0
  const status = STATUSES.find((s) => s === sp.status) ?? null
  const cabang = String(sp.cabang ?? '')
  const [convs, counts, logs, stockCount, current] = await Promise.all([
    db.botConversation.findMany({ where: { ...(status && { status }), ...(cabang && { branchSlug: cabang === '-' ? '' : cabang }) }, orderBy: { updatedAt: 'desc' }, take: 60 }),
    db.botConversation.groupBy({ by: ['status'], _count: true }),
    db.botLog.findMany({ where: { source: 'UJI' }, orderBy: { id: 'desc' }, take: 8 }),
    db.stockTire.count(),
    logId ? db.botLog.findUnique({ where: { id: logId } }) : null,
  ])
  const branches = await db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } })
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-neutral-300'}`
  const [custReply, adminPart] = (current?.reply ?? '').split('\n\n[Ringkasan ke admin')
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Chatbot</h1>
      <ChatbotTabs active="utama" />
      <p className="text-sm text-neutral-500">
        Bukan AI: bot mencari di data stok ({stockCount} baris) dan tabel harga jasa. Kalau ada, harga dan stok asli dikirim. Kalau tidak ada, stok 0, atau pesan tidak dikenali, bot tidak menjawab harga dan menyerahkan ke admin. Pengaturan ada di tab Pengaturan.
      </p>

      <section id="uji">
        <Card title="Kotak uji">
          <form action={testBot} className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input name="q" required maxLength={500} placeholder="mis. Halo kak Bejo Ban Batu, ada ban 185/65 R15?" className={inputCls} />
            <button className="adm-btn">Kirim uji</button>
            <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
              <label className="block text-xs font-semibold text-neutral-700">Cabang yang sudah diingat untuk nomor ini
                <select name="known" className={`${inputCls} mt-1`} defaultValue="">
                  <option value="">Belum ada</option>
                  {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-neutral-700">Opsional: pesan asal kalau mengetes jawaban 1 atau 2
                <input name="pending" maxLength={500} placeholder="mis. ada ban 225/45 R17?" className={`${inputCls} mt-1`} />
              </label>
            </div>
          </form>
          <p className="mt-2 text-xs text-neutral-500">Kotak uji tidak membuat percakapan dan tidak mengirim apa pun ke WhatsApp.</p>
          {current && (
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-xs font-semibold text-neutral-500">Pesan</p>
              <p className="rounded-lg bg-neutral-100 px-3 py-2">{current.input}</p>
              <p className="text-xs font-semibold text-neutral-500">Balasan ke pelanggan {current.handoff && <span className="ml-1 rounded bg-ink px-2 py-0.5 text-white">diserahkan ke admin</span>}</p>
              <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-3 py-2 font-sans">{custReply}</pre>
              {adminPart && (
                <>
                  <p className="text-xs font-semibold text-neutral-500">Ringkasan untuk admin</p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 font-sans">{'[Ringkasan ke admin' + adminPart}</pre>
                </>
              )}
              <p className="text-xs text-neutral-500">Alasan pencocokan: {current.reason || '-'}</p>
            </div>
          )}
          {logs.length > 0 && (
            <div className="mt-4 border-t border-neutral-100 pt-3">
              <form action={clearBotLogs} className="mb-1 text-right"><button className="text-xs font-semibold text-red-600">Hapus log uji</button></form>
              <ul className="space-y-1 text-xs text-neutral-600">
                {logs.map((l) => (
                  <li key={l.id}><a className="underline" href={`/admin/chatbot?log=${l.id}#uji`}>{l.input}</a> <span className="text-neutral-400">{wib(l.createdAt)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>

      <section id="percakapan">
        <Card title="Percakapan">
          <div className="mb-3 flex flex-wrap gap-2">
            <a href={`/admin/chatbot${cabang ? `?cabang=${cabang}` : ''}#percakapan`} className={chip(!status)}>Semua</a>
            {STATUSES.map((s) => <a key={s} href={`/admin/chatbot?status=${s}${cabang ? `&cabang=${cabang}` : ''}#percakapan`} className={chip(status === s)}>{STATUS_LABEL[s]} ({count(s)})</a>)}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-neutral-600">Cabang:</span>
            {[['', 'Semua'], ...branches.map((b) => [b.slug, b.name.replace(/\s*\(.*\)/, '')]), ['-', 'Belum diketahui']].map(([v, l]) => (
              <a key={v} href={`/admin/chatbot?${[status && `status=${status}`, v && `cabang=${v}`].filter(Boolean).join('&')}#percakapan`} className={chip(cabang === v)}>{l}</a>
            ))}
          </div>
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
                    <td className="px-3 py-1.5">{branches.find((b) => b.slug === c.branchSlug)?.name.replace(/\s*\(.*\)/, '') ?? '(tidak dikenali)'}</td>
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
                {!convs.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-neutral-500">Belum ada percakapan. Percakapan masuk saat worker WhatsApp berjalan.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-neutral-500">Menandai tidak tersedia membuat bot mengirim kalimat penutup ke pelanggan. Menandai selesai juga mengakhiri masa diam bot di chat itu.</p>
        </Card>
      </section>
    </div>
  )
}
