import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { clearBotLogs, saveBot, testBot } from '../../fitur-actions'
import { loadBotSettings } from '@/lib/bot/respond'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

export default async function Chatbot({ searchParams }: PageProps<'/admin/chatbot'>) {
  await requireOwner()
  const sp = await searchParams
  const logId = Number(sp.log) || 0
  const [s, logs, stockCount, current] = await Promise.all([
    loadBotSettings(),
    db.botLog.findMany({ orderBy: { id: 'desc' }, take: 30 }),
    db.stockTire.count(),
    logId ? db.botLog.findUnique({ where: { id: logId } }) : null,
  ])
  const sources: Record<string, string> = { UJI: 'uji', WA_KERING: 'WA uji kering', WA: 'WA terkirim' }
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Chatbot stok</h1>
      <p className="text-sm text-neutral-500">
        Bot internal Bejo Ban. Jawaban hanya dari data stok dan tarif ongkir ({stockCount} baris stok). Kalau pertanyaannya di luar data, bot diam dan menyerahkan ke admin. Worker WhatsApp (<code>scripts/bot-wa.ts</code>) belum dijalankan dari sini.
      </p>

      <Card title="Kotak uji">
        <form action={testBot} className="flex flex-wrap gap-2">
          <input name="q" required maxLength={500} placeholder="mis. hankook 185/65 R15, atau ongkir 4 ban 185/65 R15 ke Surabaya" className={`${inputCls} min-w-[260px] flex-1`} />
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Kirim uji</button>
        </form>
        {current && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-neutral-500">Pesan</p>
            <p className="rounded-lg bg-neutral-100 px-3 py-2">{current.input}</p>
            <p className="text-xs font-semibold text-neutral-500">Balasan {current.handoff && <span className="ml-1 rounded bg-ink px-2 py-0.5 text-white">serahkan ke admin</span>}</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-3 py-2 font-sans">{current.reply}</pre>
            <p className="text-xs text-neutral-500">Alasan pencocokan: {current.reason || '-'}</p>
          </div>
        )}
      </Card>

      <Card title="Pengaturan">
        <form action={saveBot} className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" name="enabled" defaultChecked={s.enabled} />Bot aktif (saklar utama)</label>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="replyOnHandoff" defaultChecked={s.replyOnHandoff} />Kirim balasan singkat saat diserahkan ke admin</label>
          <label className={labelCls}>Jam aktif mulai (WIB)<input type="time" name="startTime" defaultValue={s.startTime} className={inputCls} /></label>
          <label className={labelCls}>Jam aktif selesai (WIB)<input type="time" name="endTime" defaultValue={s.endTime} className={inputCls} /></label>
          <label className={labelCls}>Jeda antar balasan (detik)<input name="gapSec" defaultValue={s.gapSec} inputMode="numeric" className={inputCls} /></label>
          <label className={labelCls}>Batas balasan per hari<input name="dailyLimit" defaultValue={s.dailyLimit} inputMode="numeric" className={inputCls} /></label>
          <label className={`${labelCls} md:col-span-4`}>Nomor internal yang dilayani (satu per baris, format 0812... atau 62812...)
            <textarea name="numbers" rows={3} defaultValue={s.numbers.join('\n')} className={`${inputCls} font-mono`} />
          </label>
          <div className="md:col-span-4"><button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Simpan pengaturan</button></div>
        </form>
      </Card>

      <Card title={`Log (${logs.length} terakhir)`}>
        <form action={clearBotLogs} className="mb-3 text-right"><button className="text-xs font-semibold text-red-600">Hapus log uji</button></form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-neutral-50"><tr>{['Waktu', 'Sumber', 'Pesan', 'Hasil'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-neutral-600">{h}</th>)}</tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-neutral-100 align-top">
                  <td className="whitespace-nowrap px-3 py-1.5">{l.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                  <td className="px-3 py-1.5">{sources[l.source] ?? l.source}</td>
                  <td className="px-3 py-1.5">{l.input}</td>
                  <td className="px-3 py-1.5">{l.handoff ? 'serahkan ke admin' : l.sent ? 'terkirim' : 'dibalas'}{l.reason ? <span className="block text-xs text-neutral-500">{l.reason}</span> : null}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-neutral-500">Belum ada log.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
