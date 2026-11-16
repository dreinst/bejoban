import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { clearBotLogs, testBot } from '../../../fitur-actions'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

const wib = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

// Kotak uji: mencoba jawaban bot tanpa membuat percakapan dan tanpa mengirim apa pun ke WhatsApp.
export default async function UjiChatbot({ searchParams }: PageProps<'/admin/chatbot/uji'>) {
  await requireOwner()
  const logId = Number((await searchParams).log) || 0
  const [logs, current, branches] = await Promise.all([
    db.botLog.findMany({ where: { source: 'UJI' }, orderBy: { id: 'desc' }, take: 8 }),
    logId ? db.botLog.findUnique({ where: { id: logId } }) : null,
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
  ])
  const [custReply, adminPart] = (current?.reply ?? '').split('\n\n[Ringkasan ke admin')
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="Kotak uji" note="Ketik pesan seperti pelanggan untuk melihat balasan bot. Tidak membuat percakapan dan tidak mengirim apa pun ke WhatsApp." />
      <Card title="Pesan uji">
        <form action={testBot} className="grid gap-2 md:grid-cols-[1fr_auto]">
          <input name="q" required maxLength={500} aria-label="Pesan uji" placeholder="mis. Halo kak Bejo Ban Batu, ada ban 185/65 R15?" className={inputCls} />
          <button className="adm-btn">Kirim uji</button>
          <div className="grid gap-2 md:col-span-2 md:grid-cols-3">
            <label className={labelCls}>Cabang yang sudah diingat untuk nomor ini
              <select name="known" className={`${inputCls} mt-1`} defaultValue="">
                <option value="">Belum ada</option>
                {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
              </select>
            </label>
            <label className={labelCls}>Opsional: pesan asal kalau mengetes jawaban 1 atau 2
              <input name="pending" maxLength={500} placeholder="mis. ada ban 225/45 R17?" className={`${inputCls} mt-1`} />
            </label>
            <label className={labelCls}>Stok per cabang untuk uji ini
              <select name="perCabang" className={`${inputCls} mt-1`} defaultValue="">
                <option value="">Ikut pengaturan</option>
                <option value="on">Nyala</option>
                <option value="off">Mati</option>
              </select>
            </label>
          </div>
        </form>
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
      </Card>
      {logs.length > 0 && (
        <Card title="Uji terakhir">
          <ul className="space-y-1 text-sm text-neutral-700">
            {logs.map((l) => (
              <li key={l.id}><a className="underline" href={`/admin/chatbot/uji?log=${l.id}`}>{l.input}</a> <span className="text-xs text-neutral-400">{wib(l.createdAt)}</span></li>
            ))}
          </ul>
          <form action={clearBotLogs} className="mt-3"><button className="text-xs font-semibold text-red-600">Hapus riwayat uji</button></form>
        </Card>
      )}
    </div>
  )
}
