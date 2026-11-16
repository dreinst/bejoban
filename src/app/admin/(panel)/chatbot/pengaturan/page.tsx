import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveBotAdmins, saveBotHours, saveSosmed } from '../../../fitur-actions'
import { SosmedEditor } from '@/components/admin/sosmed-editor'
import { loadBotSettings, loadSosmed } from '@/lib/bot/respond'
import { getSitus } from '@/lib/situs-server'
import { branchLabel, waHref, waNumber } from '@/lib/situs'
import { Badge, PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { CheckField, FormActions, FormGrid, TextAreaField, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'

// Pengaturan WhatsApp dan chatbot, satu form dan satu tombol simpan per bagian. Templat pesan ada di tab Templat pesan.
export default async function PengaturanWhatsapp() {
  await requireOwner()
  const [s, sosmed, situs, branches] = await Promise.all([loadBotSettings(), loadSosmed(), getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const tersambung = ['WAHA_URL', 'WAHA_API_KEY', 'WAHA_SESSION'].every((k) => !!process.env[k])
  const kirim = process.env.BOT_SEND === '1'
  const tautanWa = branches.map((b) => `- ${branchLabel(b.name)}: ${waHref(situs, b, 'umum')}`).join('\n')
  const mainNumber = situs.mainWhatsapp || null
  return (
    <PageBody>
      <PageHeader title="Pengaturan bot" note="Sambungan WhatsApp, jam aktif, nomor admin, dan teks balasan sosial media. Kalimat yang dikirim bot ada di tab Templat pesan." />
      <SettingsGrid>
        <Section id="sambungan" title="Sambungan WhatsApp" description="Satu nomor melayani kedua cabang. Bot mengenali cabang dari kalimat pembuka tombol WhatsApp di situs.">
          <dl className="grid gap-y-3 text-sm sm:grid-cols-[190px_1fr]">
            <dt className="text-mute">Nomor WhatsApp utama</dt>
            <dd>
              {mainNumber ? <b>{mainNumber}</b> : 'Belum diisi, situs memakai nomor tiap cabang.'}{' '}
              <Link href="/admin/situs#nomor" className="font-semibold underline">Ubah</Link>
            </dd>
            <dt className="text-mute">Sambungan</dt>
            <dd>{tersambung ? <Badge>Tersambung</Badge> : <><Badge tone="outline">Belum disambungkan</Badge> <span className="text-mute">Hubungi pengelola sistem.</span></>}</dd>
            <dt className="text-mute">Balasan bot</dt>
            <dd>{kirim ? 'Dikirim ke pelanggan' : 'Mode uji: balasan belum dikirim ke pelanggan.'}</dd>
          </dl>
        </Section>

        <Section id="admin" title="Nomor admin per cabang" description="Saat percakapan diserahkan, nomor ini menerima ringkasan (cabang, pertanyaan, hasil pencarian) dan nomornya disebut ke pelanggan.">
          <form action={saveBotAdmins}>
            <FormGrid>
              {branches.map((b) => (
                <div key={b.id} className="space-y-3">
                  <TextField label={`Nomor admin ${branchLabel(b.name)}`} name={`admin_${b.slug}`} defaultValue={s.adminNumbers[b.slug] ?? ''} placeholder="0812..." inputMode="tel" />
                  <TextField label="Kata lain untuk cabang ini" hint="Pisah dengan koma." name={`alias_${b.slug}`} defaultValue={(s.branchAliases[b.slug] ?? []).join(', ')} placeholder="mis. singosari" />
                </div>
              ))}
              <TextField className="sm:col-span-2" label="Nomor owner" hint="Dipakai kalau cabang tidak dikenali atau nomor admin kosong." name="ownerNumber" defaultValue={s.ownerNumber} placeholder="0812..." inputMode="tel" />
            </FormGrid>
            <FormActions><SubmitButton>Simpan nomor admin</SubmitButton></FormActions>
          </form>
        </Section>

        <Section id="jam" title="Jam aktif dan batas kirim" wide>
          <form action={saveBotHours}>
            <FormGrid cols={3}>
              <CheckField className="sm:col-span-3" label="Bot aktif" name="enabled" defaultChecked={s.enabled} />
              <TextField label="Jam aktif mulai (WIB)" type="time" name="startTime" defaultValue={s.startTime} />
              <TextField label="Jam aktif selesai (WIB)" type="time" name="endTime" defaultValue={s.endTime} />
              <TextField label="Jeda antar pesan (detik)" name="gapSec" defaultValue={s.gapSec} inputMode="numeric" />
              <TextField label="Batas pesan terkirim per hari" name="dailyLimit" defaultValue={s.dailyLimit} inputMode="numeric" />
              <TextField label="Bot diam di chat yang diserahkan (jam)" hint="Setelah diserahkan ke admin, bot tidak membalas di chat itu selama jangka waktu ini." name="muteHours" defaultValue={s.muteHours} inputMode="numeric" />
              <TextField label="Pilihan cabang diingat (hari)" name="branchMemoryDays" defaultValue={s.branchMemoryDays} inputMode="numeric" />
              <TextField label="Menunggu jawaban cabang (menit)" name="branchWaitMin" defaultValue={s.branchWaitMin} inputMode="numeric" />
              <CheckField
                className="sm:col-span-3"
                label="Stok per cabang"
                name="stokPerCabang"
                defaultChecked={s.stokPerCabang}
                hint="Menyala: bot hanya menyebut stok cabang pelanggan dan menanyakan cabangnya dulu kalau belum tahu. Kalau cabang itu kosong tapi cabang lain ada, bot menyebut nama cabang lain tanpa angka lalu menyerahkan ke admin. Stok tanpa cabang tetap dijawab langsung. Mati: stok semua cabang dianggap satu."
              />
              <CheckField className="sm:col-span-3" label="Hanya membalas nomor uji" name="restrictNumbers" defaultChecked={s.restrictNumbers} hint="Matikan kalau sudah siap melayani pelanggan." />
              <TextAreaField className="sm:col-span-3" label="Nomor uji" hint="Satu nomor per baris." name="testNumbers" rows={3} defaultValue={s.testNumbers.join('\n')} />
            </FormGrid>
            <FormActions><SubmitButton>Simpan jam dan batas kirim</SubmitButton></FormActions>
          </form>
        </Section>

        <Section
          id="sosmed"
          title="Balasan otomatis sosial media"
          wide
          description={`Pelanggan di Instagram, Facebook, dan TikTok diarahkan ke WhatsApp. Salin teks ini ke fitur balasan otomatis di tiap aplikasi. Nomor tujuan: ${mainNumber ?? branches.map((b) => waNumber(situs, b)).join(' dan ')}.`}
        >
          <form action={saveSosmed}>
            <SosmedEditor initial={sosmed} tautanWa={tautanWa} />
            <FormActions><SubmitButton>Simpan teks sosial media</SubmitButton></FormActions>
          </form>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
