import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { resetBotTemplates, saveBotAdmins, saveBotHours, saveBotTemplates, saveSosmed } from '../../../fitur-actions'
import { ChatbotTabs } from '@/components/admin/chatbot-tabs'
import { TemplateEditor } from '@/components/admin/template-editor'
import { SosmedEditor } from '@/components/admin/sosmed-editor'
import { loadBotSettings, loadSosmed, loadTemplates } from '@/lib/bot/respond'
import { getSitus } from '@/lib/situs-server'
import { branchLabel, waHref, waNumber } from '@/lib/situs'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

const Anchors = () => (
  <nav className="flex flex-wrap gap-3 text-sm underline underline-offset-4">
    {[['sambungan', 'Sambungan WhatsApp'], ['jam', 'Jam dan batas kirim'], ['templat', 'Templat pesan'], ['admin', 'Nomor admin per cabang'], ['sosmed', 'Sosial media']].map(([id, l]) => (
      <a key={id} href={`#${id}`}>{l}</a>
    ))}
  </nav>
)

export default async function PengaturanChatbot() {
  await requireOwner()
  const [s, templates, sosmed, situs, branches] = await Promise.all([
    loadBotSettings(),
    loadTemplates(),
    loadSosmed(),
    getSitus(),
    db.branch.findMany({ orderBy: { sort: 'asc' } }),
  ])
  const env = (k: string) => (process.env[k] ? 'terisi' : 'belum diisi')
  const tautanWa = branches.map((b) => `- ${branchLabel(b.name)}: ${waHref(situs, b, 'umum')}`).join('\n')
  const mainNumber = situs.mainWhatsapp || null
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Pengaturan chatbot</h1>
      <ChatbotTabs active="pengaturan" />
      <Anchors />

      <section id="sambungan">
        <Card title="1. Sambungan WhatsApp">
          <div className="space-y-2 text-sm">
            <p>Satu WAHA (engine GOWS), satu nomor WhatsApp untuk kedua cabang. Cabang dibedakan dari kalimat pembuka tombol di situs.</p>
            <dl className="grid grid-cols-[200px_1fr] gap-y-1">
              <dt className="text-neutral-500">Nomor WhatsApp utama</dt>
              <dd>{mainNumber ? <b>{mainNumber}</b> : 'belum diisi (situs memakai nomor tiap cabang)'} <a href="/admin/situs" className="underline">ubah di Situs dan WhatsApp</a></dd>
              <dt className="text-neutral-500">WAHA_URL</dt><dd>{env('WAHA_URL')}</dd>
              <dt className="text-neutral-500">WAHA_API_KEY</dt><dd>{env('WAHA_API_KEY')}</dd>
              <dt className="text-neutral-500">WAHA_SESSION</dt><dd>{env('WAHA_SESSION')}</dd>
              <dt className="text-neutral-500">Mode kirim</dt><dd>{process.env.BOT_SEND === '1' ? 'KIRIM (BOT_SEND=1)' : 'uji kering (hanya mencetak, tidak mengirim)'}</dd>
            </dl>
            <p className="text-xs text-neutral-500">Nilai sambungan diisi di berkas <code>.env</code> server, tidak di halaman ini. Worker: <code>npm run bot:wa</code> (belum dijalankan dari prototipe ini).</p>
          </div>
        </Card>
      </section>

      <section id="jam">
        <Card title="2. Jam dan batas kirim">
          <form action={saveBotHours} className="grid gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm font-semibold md:col-span-4"><input type="checkbox" name="enabled" defaultChecked={s.enabled} />Bot aktif (saklar utama)</label>
            <label className={labelCls}>Jam aktif mulai (WIB)<input type="time" name="startTime" defaultValue={s.startTime} className={inputCls} /></label>
            <label className={labelCls}>Jam aktif selesai (WIB)<input type="time" name="endTime" defaultValue={s.endTime} className={inputCls} /></label>
            <label className={labelCls}>Jeda antar pesan (detik)<input name="gapSec" defaultValue={s.gapSec} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Batas pesan terkirim per hari<input name="dailyLimit" defaultValue={s.dailyLimit} inputMode="numeric" className={inputCls} /></label>
            <label className={`${labelCls} md:col-span-2`}>Bot diam di chat yang diserahkan (jam)
              <input name="muteHours" defaultValue={s.muteHours} inputMode="numeric" className={inputCls} />
              <span className="font-normal text-neutral-500">Setelah serah ke admin, bot tidak membalas di chat itu selama jangka waktu ini.</span>
            </label>
            <label className={labelCls}>Pilihan cabang diingat (hari)<input name="branchMemoryDays" defaultValue={s.branchMemoryDays} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Menunggu jawaban cabang (menit)<input name="branchWaitMin" defaultValue={s.branchWaitMin} inputMode="numeric" className={inputCls} /></label>
            <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="restrictNumbers" defaultChecked={s.restrictNumbers} />Batasi ke nomor uji saja (matikan kalau sudah siap melayani pelanggan)</label>
            <label className={`${labelCls} md:col-span-4`}>Nomor uji (satu per baris)
              <textarea name="testNumbers" rows={3} defaultValue={s.testNumbers.join('\n')} className={`${inputCls} font-mono`} />
            </label>
            <div className="md:col-span-4"><button className="adm-btn">Simpan</button></div>
          </form>
        </Card>
      </section>

      <section id="templat">
        <Card title="3. Templat pesan">
          <p className="mb-4 text-sm text-neutral-500">Semua kalimat bot berasal dari templat ini. Tulis variabel dalam kurung kurawal, pratinjau di kanan memakai contoh isi.</p>
          <form action={saveBotTemplates} className="space-y-4">
            <TemplateEditor initial={templates} />
            <button className="adm-btn">Simpan templat</button>
          </form>
          <form action={resetBotTemplates} className="mt-3"><button className="text-xs font-semibold text-red-600">Kembalikan semua templat ke bawaan</button></form>
        </Card>
      </section>

      <section id="admin">
        <Card title="4. Nomor admin per cabang untuk serah terima">
          <form action={saveBotAdmins} className="grid gap-3 md:grid-cols-2">
            {branches.map((b) => (
              <div key={b.id} className="space-y-2">
                <label className={labelCls}>Nomor admin {branchLabel(b.name)}
                  <input name={`admin_${b.slug}`} defaultValue={s.adminNumbers[b.slug] ?? ''} placeholder="0812..." className={inputCls} />
                </label>
                <label className={labelCls}>Kata lain pengenal cabang (pisah koma)
                  <input name={`alias_${b.slug}`} defaultValue={(s.branchAliases[b.slug] ?? []).join(', ')} placeholder="mis. singosari" className={inputCls} />
                </label>
              </div>
            ))}
            <label className={`${labelCls} md:col-span-2`}>Nomor owner (dipakai kalau cabang tidak dikenali atau nomor admin kosong)
              <input name="ownerNumber" defaultValue={s.ownerNumber} placeholder="0812..." className={inputCls} />
            </label>
            <p className="text-xs text-neutral-500 md:col-span-2">Saat serah terima, nomor ini menerima ringkasan (cabang, pertanyaan, hasil pencarian) dan nomornya disebut ke pelanggan.</p>
            <div className="md:col-span-2"><button className="adm-btn">Simpan nomor admin</button></div>
          </form>
        </Card>
      </section>

      <section id="sosmed">
        <Card title="5. Sosial media">
          <p className="mb-4 text-sm text-neutral-500">
            Di Instagram, Facebook, dan TikTok pelanggan selalu diarahkan ke WhatsApp. Salin templat ini ke fitur balasan otomatis di tiap aplikasi. Tidak ada sambungan API sosmed. Nomor tujuan tautan: {mainNumber ?? branches.map((b) => waNumber(situs, b)).join(' dan ')}.
          </p>
          <form action={saveSosmed} className="space-y-4">
            <SosmedEditor initial={sosmed} tautanWa={tautanWa} />
            <button className="adm-btn">Simpan templat sosmed</button>
          </form>
        </Card>
      </section>
    </div>
  )
}
