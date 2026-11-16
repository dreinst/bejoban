import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveBotAdmins, saveBotHours, saveSosmed } from '../../../fitur-actions'
import { SosmedEditor } from '@/components/admin/sosmed-editor'
import { loadBotSettings, loadSosmed } from '@/lib/bot/respond'
import { getSitus } from '@/lib/situs-server'
import { branchLabel, waHref, waNumber } from '@/lib/situs'
import { inputCls } from '@/components/admin/form-cls'
import { Card, labelCls } from '@/components/admin/simple-list'
import { Badge, PageHeader } from '@/components/admin/ui'

// Pengaturan WhatsApp dan chatbot, satu form dan satu tombol simpan per bagian. Templat pesan ada di menu Chatbot.
export default async function PengaturanWhatsapp() {
  await requireOwner()
  const [s, sosmed, situs, branches] = await Promise.all([loadBotSettings(), loadSosmed(), getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const tersambung = ['WAHA_URL', 'WAHA_API_KEY', 'WAHA_SESSION'].every((k) => !!process.env[k])
  const kirim = process.env.BOT_SEND === '1'
  const tautanWa = branches.map((b) => `- ${branchLabel(b.name)}: ${waHref(situs, b, 'umum')}`).join('\n')
  const mainNumber = situs.mainWhatsapp || null
  return (
    <div className="max-w-4xl space-y-4">
      <PageHeader title="WhatsApp dan chatbot" />

      <section id="sambungan">
        <Card title="Sambungan WhatsApp">
          <dl className="grid gap-y-2 text-sm sm:grid-cols-[200px_1fr]">
            <dt className="text-neutral-500">Nomor WhatsApp utama</dt>
            <dd>{mainNumber ? <b>{mainNumber}</b> : 'Belum diisi, situs memakai nomor tiap cabang.'} <Link href="/admin/situs#nomor" className="underline">Ubah</Link></dd>
            <dt className="text-neutral-500">Sambungan</dt>
            <dd>{tersambung ? <Badge>Tersambung</Badge> : <><Badge tone="outline">Belum disambungkan</Badge> <span className="text-neutral-600">Hubungi pengelola sistem.</span></>}</dd>
            <dt className="text-neutral-500">Balasan bot</dt>
            <dd>{kirim ? 'Dikirim ke pelanggan' : 'Mode uji: balasan belum dikirim ke pelanggan.'}</dd>
          </dl>
          <p className="mt-3 text-xs text-neutral-500">Satu nomor melayani kedua cabang. Bot mengenali cabang dari kalimat pembuka tombol WhatsApp di situs.</p>
        </Card>
      </section>

      <section id="jam">
        <Card title="Jam aktif dan batas kirim">
          <form action={saveBotHours} className="grid gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-sm font-semibold md:col-span-4"><input type="checkbox" name="enabled" defaultChecked={s.enabled} />Bot aktif</label>
            <label className={labelCls}>Jam aktif mulai (WIB)<input type="time" name="startTime" defaultValue={s.startTime} className={inputCls} /></label>
            <label className={labelCls}>Jam aktif selesai (WIB)<input type="time" name="endTime" defaultValue={s.endTime} className={inputCls} /></label>
            <label className={labelCls}>Jeda antar pesan (detik)<input name="gapSec" defaultValue={s.gapSec} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Batas pesan terkirim per hari<input name="dailyLimit" defaultValue={s.dailyLimit} inputMode="numeric" className={inputCls} /></label>
            <label className={`${labelCls} md:col-span-2`}>Bot diam di chat yang diserahkan (jam)
              <input name="muteHours" defaultValue={s.muteHours} inputMode="numeric" className={inputCls} />
              <span className="font-normal text-neutral-500">Setelah diserahkan ke admin, bot tidak membalas di chat itu selama jangka waktu ini.</span>
            </label>
            <label className={labelCls}>Pilihan cabang diingat (hari)<input name="branchMemoryDays" defaultValue={s.branchMemoryDays} inputMode="numeric" className={inputCls} /></label>
            <label className={labelCls}>Menunggu jawaban cabang (menit)<input name="branchWaitMin" defaultValue={s.branchWaitMin} inputMode="numeric" className={inputCls} /></label>
            <label className="flex items-start gap-2 text-sm md:col-span-4">
              <input type="checkbox" name="stokPerCabang" defaultChecked={s.stokPerCabang} className="mt-1" />
              <span>
                <b>Stok per cabang.</b> Menyala: bot hanya menyebut stok cabang pelanggan dan menanyakan cabangnya dulu kalau belum tahu. Kalau cabang itu kosong tapi cabang lain ada, bot menyebut nama cabang lain tanpa angka lalu menyerahkan ke admin. Stok tanpa cabang tetap dijawab langsung. Mati: stok semua cabang dianggap satu.
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" name="restrictNumbers" defaultChecked={s.restrictNumbers} />Hanya membalas nomor uji (matikan kalau sudah siap melayani pelanggan)</label>
            <label className={`${labelCls} md:col-span-4`}>Nomor uji (satu per baris)
              <textarea name="testNumbers" rows={3} defaultValue={s.testNumbers.join('\n')} className={`${inputCls} font-mono`} />
            </label>
            <div className="md:col-span-4"><button className="adm-btn">Simpan jam dan batas kirim</button></div>
          </form>
        </Card>
      </section>

      <section id="admin">
        <Card title="Nomor admin per cabang">
          <form action={saveBotAdmins} className="grid gap-3 md:grid-cols-2">
            {branches.map((b) => (
              <div key={b.id} className="space-y-2">
                <label className={labelCls}>Nomor admin {branchLabel(b.name)}
                  <input name={`admin_${b.slug}`} defaultValue={s.adminNumbers[b.slug] ?? ''} placeholder="0812..." className={inputCls} />
                </label>
                <label className={labelCls}>Kata lain untuk cabang ini (pisah koma)
                  <input name={`alias_${b.slug}`} defaultValue={(s.branchAliases[b.slug] ?? []).join(', ')} placeholder="mis. singosari" className={inputCls} />
                </label>
              </div>
            ))}
            <label className={`${labelCls} md:col-span-2`}>Nomor owner (dipakai kalau cabang tidak dikenali atau nomor admin kosong)
              <input name="ownerNumber" defaultValue={s.ownerNumber} placeholder="0812..." className={inputCls} />
            </label>
            <p className="text-xs text-neutral-500 md:col-span-2">Saat percakapan diserahkan, nomor ini menerima ringkasan (cabang, pertanyaan, hasil pencarian) dan nomornya disebut ke pelanggan.</p>
            <div className="md:col-span-2"><button className="adm-btn">Simpan nomor admin</button></div>
          </form>
        </Card>
      </section>

      <section id="sosmed">
        <Card title="Balasan otomatis sosial media">
          <p className="mb-4 text-sm text-neutral-500">
            Pelanggan di Instagram, Facebook, dan TikTok diarahkan ke WhatsApp. Salin teks ini ke fitur balasan otomatis di tiap aplikasi. Nomor tujuan: {mainNumber ?? branches.map((b) => waNumber(situs, b)).join(' dan ')}.
          </p>
          <form action={saveSosmed} className="space-y-4">
            <SosmedEditor initial={sosmed} tautanWa={tautanWa} />
            <button className="adm-btn">Simpan teks sosial media</button>
          </form>
        </Card>
      </section>
    </div>
  )
}
