import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { clearBotLogs, testBot } from '../../../fitur-actions'
import { waktuWib } from '@/lib/format'
import { Badge, Empty, PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { FormActions, FormGrid, SelectField, TextField } from '@/components/admin/field'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'

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
  const label = 'mb-1 text-xs font-semibold text-neutral-700'
  return (
    <PageBody>
      <PageHeader title="Kotak uji" note="Ketik pesan seperti pelanggan untuk melihat balasan bot. Tidak membuat percakapan dan tidak mengirim apa pun ke WhatsApp." />
      <SettingsGrid>
        <Section id="uji" title="Pesan uji" description="Hasilnya tampil di bawah formulir dan tersimpan di riwayat.">
          <form action={testBot}>
            <FormGrid cols={1}>
              <TextField label="Pesan uji" name="q" required maxLength={500} placeholder="mis. Halo kak Bejo Ban Batu, ada ban 185/65 R15?" autoComplete="off" />
            </FormGrid>
            <details className="mt-4 rounded-lg border border-line px-3 py-2">
              <summary className="adm-sum flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink max-md:min-h-11">Uji lanjutan</summary>
              <p className="mb-3 mt-1 text-xs text-mute">Untuk mencoba keadaan tertentu. Kalau dibiarkan, bot diuji seperti pelanggan baru dan memakai pengaturan yang sedang berlaku.</p>
              <FormGrid cols={1}>
                <SelectField label="Cabang yang sudah diingat untuk nomor ini" name="known" defaultValue="">
                  <option value="">Belum ada</option>
                  {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
                </SelectField>
                <TextField label="Pesan asal (opsional)" name="pending" maxLength={500} placeholder="mis. ada ban 225/45 R17?" hint="Isi kalau mengetes jawaban 1 atau 2 untuk pertanyaan cabang." autoComplete="off" />
                <SelectField label="Stok per cabang untuk uji ini" name="perCabang" defaultValue="">
                  <option value="">Ikut pengaturan</option>
                  <option value="on">Nyala</option>
                  <option value="off">Mati</option>
                </SelectField>
              </FormGrid>
            </details>
            <FormActions>
              <SubmitButton pending="Menguji...">Kirim uji</SubmitButton>
            </FormActions>
          </form>
          {current && (
            <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm" aria-live="polite">
              <p className={label}>Pesan</p>
              <p className="rounded-lg bg-soft px-3 py-2">{current.input}</p>
              <p className={`${label} flex flex-wrap items-center gap-2`}>
                Balasan ke pelanggan {current.handoff && <Badge>Diserahkan ke admin</Badge>}
              </p>
              <pre className="whitespace-pre-wrap rounded-lg border border-line bg-white px-3 py-2 font-sans">{custReply}</pre>
              {adminPart && (
                <>
                  <p className={label}>Ringkasan untuk admin</p>
                  <pre className="whitespace-pre-wrap rounded-lg border border-dashed border-[#cfcfcf] bg-white px-3 py-2 font-sans">{'[Ringkasan ke admin' + adminPart}</pre>
                </>
              )}
              <details className="text-xs text-mute">
                <summary className="adm-sum flex min-h-8 cursor-pointer items-center font-semibold max-md:min-h-11">Alasan pencocokan (untuk pengembang)</summary>
                <p className="mt-1 break-words">{current.reason || '-'}</p>
              </details>
            </div>
          )}
        </Section>

        <Section
          id="riwayat"
          title="Uji terakhir"
          description="Pilih salah satu untuk melihat balasannya lagi."
          actions={
            logs.length > 0 ? (
              <ConfirmDialog
                trigger="Hapus riwayat uji"
                triggerClassName="adm-btn-line adm-btn-sm"
                title="Hapus riwayat uji?"
                message={
                  <>
                    <p>Semua catatan di Kotak uji dihapus dan tidak bisa dikembalikan.</p>
                    <p className="text-mute">Percakapan pelanggan yang sebenarnya tidak ikut terhapus.</p>
                  </>
                }
                confirm={{ action: clearBotLogs, label: 'Hapus riwayat' }}
              />
            ) : undefined
          }
        >
          {logs.length ? (
            <ul className="divide-y divide-line text-sm">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                  <Link href={`/admin/chatbot/uji?log=${l.id}`} className={`min-w-0 break-words underline ${l.id === logId ? 'font-bold' : ''}`}>{l.input}</Link>
                  <span className="text-xs text-mute">{waktuWib(l.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Belum ada uji">Kirim pesan uji pertama lewat formulir.</Empty>
          )}
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
