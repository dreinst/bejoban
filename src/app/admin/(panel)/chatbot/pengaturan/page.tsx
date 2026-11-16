import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { saveBotAdmins, saveBotHours } from '../../../fitur-actions'
import { NomorUji } from '@/components/admin/nomor-uji'
import { FormPulih } from '@/components/admin/form-pulih'
import { loadBotSettings } from '@/lib/bot/respond'
import { getSitus } from '@/lib/situs-server'
import { branchLabel } from '@/lib/situs'
import { Badge, PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { CheckField, FormActions, FormGrid, TextField } from '@/components/admin/field'
import { SubmitButton } from '@/components/admin/overlay'

// Pengaturan WhatsApp dan chatbot, satu form dan satu tombol simpan per bagian. Templat pesan ada di tab Templat pesan.
// Nilai yang diubah di tempat lain (nomor WhatsApp utama dan nomor cabang) hanya dibaca di sini, dengan tautan ke tempat ubahnya.
export default async function PengaturanWhatsapp() {
  await requireOwner()
  const [s, situs, branches] = await Promise.all([loadBotSettings(), getSitus(), db.branch.findMany({ orderBy: { sort: 'asc' } })])
  const tersambung = ['WAHA_URL', 'WAHA_API_KEY', 'WAHA_SESSION'].every((k) => !!process.env[k])
  const kirim = process.env.BOT_SEND === '1'
  const mainNumber = situs.mainWhatsapp || null
  // Pilihan nomor uji menyala dengan daftar kosong: bot tidak akan membalas siapa pun begitu dinyalakan.
  const daftarKosong = s.restrictNumbers && s.testNumbers.length === 0
  const diamSemua = s.enabled && daftarKosong
  const statusBot = !s.enabled ? <Badge tone="outline">Mati</Badge> : diamSemua ? <Badge tone="outline">Aktif, tapi diam ke semua orang</Badge> : s.restrictNumbers ? <Badge>Aktif, hanya {s.testNumbers.length} nomor uji</Badge> : <Badge>Aktif</Badge>
  return (
    <PageBody>
      <PageHeader title="Pengaturan bot" note="Bot aktif dan jam layanan, sambungan WhatsApp, dan nomor admin per cabang. Kalimat bot dan balasan sosial media ada di tab Templat pesan." />
      <SettingsGrid>
        <Section id="jam" wide title="Bot aktif dan jam layanan" description="Di luar jam ini bot membalas dengan kalimat luar jam. Angka teknis ada di Pengaturan lanjutan.">
          {daftarKosong && (
            <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">{s.enabled ? 'Bot sedang diam ke semua orang.' : 'Bot akan diam ke semua orang begitu dinyalakan.'}</p>
              <p className="mt-0.5">&quot;Hanya membalas nomor uji&quot; menyala, tetapi daftar nomor uji kosong. Buka <a href="#lanjutan" className="font-semibold underline">Pengaturan lanjutan</a>, lalu isi nomor uji atau matikan pilihan itu.</p>
            </div>
          )}
          <FormPulih nama="jam">
            <form action={saveBotHours}>
              <FormGrid cols={3}>
                <CheckField className="sm:col-span-3" label="Bot aktif" name="enabled" defaultChecked={s.enabled} hint="Matikan kalau bot perlu berhenti membalas sementara." />
                <TextField label="Jam aktif mulai (WIB)" type="time" name="startTime" defaultValue={s.startTime} />
                <TextField label="Jam aktif selesai (WIB)" type="time" name="endTime" defaultValue={s.endTime} />
                <CheckField
                  className="sm:col-span-3"
                  label="Stok per cabang"
                  name="stokPerCabang"
                  defaultChecked={s.stokPerCabang}
                  hint="Menyala: bot hanya menyebut stok cabang pelanggan dan menanyakan cabangnya dulu kalau belum tahu. Kalau cabang itu kosong tapi cabang lain ada, bot menyebut nama cabang lain tanpa angka lalu menyerahkan ke admin. Stok tanpa cabang tetap dijawab langsung. Mati: stok semua cabang dianggap satu."
                />
              </FormGrid>
              <details id="lanjutan" open={daftarKosong} className="mt-5 rounded-[10px] border border-line px-4 py-3">
                <summary className="min-h-6 cursor-pointer max-md:flex max-md:min-h-11 max-md:items-center text-sm font-semibold text-ink">Pengaturan lanjutan</summary>
                <p className="mt-2 text-xs text-mute">Angka teknis dan pembatasan nomor. Biasanya tidak perlu diubah.</p>
                <div className="mt-4">
                  <FormGrid cols={3}>
                    <TextField label="Jeda antar pesan (detik)" name="gapSec" defaultValue={s.gapSec} inputMode="numeric" />
                    <TextField label="Batas pesan terkirim per hari" name="dailyLimit" defaultValue={s.dailyLimit} inputMode="numeric" />
                    <TextField label="Bot diam di chat yang diserahkan (jam)" hint="Setelah diserahkan ke admin, bot tidak membalas di chat itu selama jangka waktu ini." name="muteHours" defaultValue={s.muteHours} inputMode="numeric" />
                    <TextField label="Pilihan cabang diingat (hari)" name="branchMemoryDays" defaultValue={s.branchMemoryDays} inputMode="numeric" />
                    <TextField label="Menunggu jawaban cabang (menit)" name="branchWaitMin" defaultValue={s.branchWaitMin} inputMode="numeric" />
                    <NomorUji restrict={s.restrictNumbers} nomor={s.testNumbers} />
                  </FormGrid>
                </div>
              </details>
              <FormActions><SubmitButton>Simpan pengaturan bot</SubmitButton></FormActions>
            </form>
          </FormPulih>
        </Section>

        <Section id="sambungan" title="Sambungan WhatsApp" description={mainNumber ? 'Satu nomor melayani semua cabang. Bot mengenali cabang dari kalimat pembuka tombol WhatsApp di situs.' : 'Tiap cabang memakai nomornya sendiri di situs. Bot mengenali cabang dari kalimat pembuka tombol WhatsApp.'}>
          <dl className="grid gap-y-3 text-sm sm:grid-cols-[190px_1fr]">
            <dt className="text-mute">Bot</dt>
            <dd>{statusBot}</dd>
            <dt className="text-mute">Nomor WhatsApp utama</dt>
            <dd>
              {mainNumber ? <b>{mainNumber}</b> : 'Belum diisi, situs memakai nomor tiap cabang.'}{' '}
              <Link href="/admin/situs#nomor" className="font-semibold underline">Ubah di Situs, Tautan WhatsApp</Link>
            </dd>
            {!mainNumber &&
              branches.map((b) => (
                <div key={b.id} className="contents">
                  <dt className="text-mute">Nomor {branchLabel(b.name)}</dt>
                  <dd>
                    <b>{b.whatsapp || '-'}</b>{' '}
                    <Link href="/admin/cabang" className="font-semibold underline">Ubah di Cabang</Link>
                  </dd>
                </div>
              ))}
            <dt className="text-mute">Sambungan</dt>
            <dd>{tersambung ? <Badge>Tersambung</Badge> : <><Badge tone="outline">Belum disambungkan</Badge> <span className="text-mute">Hubungi pengelola sistem.</span></>}</dd>
            <dt className="text-mute">Balasan bot</dt>
            <dd>{kirim ? 'Dikirim ke pelanggan' : 'Mode uji: balasan belum dikirim ke pelanggan.'}</dd>
          </dl>
        </Section>

        <Section id="admin" title="Nomor admin per cabang" description="Saat percakapan diserahkan, nomor ini menerima ringkasan (cabang, pertanyaan, hasil pencarian) dan nomornya disebut ke pelanggan. Ini bukan nomor tombol WhatsApp di situs.">
          <FormPulih nama="admin">
            <form action={saveBotAdmins}>
              <FormGrid>
                {branches.map((b) => (
                  <div key={b.id} className="space-y-3">
                    <TextField label={`Nomor admin ${branchLabel(b.name)}`} name={`admin_${b.slug}`} defaultValue={s.adminNumbers[b.slug] ?? ''} placeholder="0812..." inputMode="tel" />
                    <TextField label={`Kata lain untuk ${branchLabel(b.name)}`} hint="Pisah dengan koma." name={`alias_${b.slug}`} defaultValue={(s.branchAliases[b.slug] ?? []).join(', ')} placeholder="mis. singosari" />
                  </div>
                ))}
                <TextField className="sm:col-span-2" label="Nomor owner" hint="Dipakai kalau cabang tidak dikenali atau nomor admin kosong." name="ownerNumber" defaultValue={s.ownerNumber} placeholder="0812..." inputMode="tel" />
              </FormGrid>
              <FormActions><SubmitButton>Simpan nomor admin</SubmitButton></FormActions>
            </form>
          </FormPulih>
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
