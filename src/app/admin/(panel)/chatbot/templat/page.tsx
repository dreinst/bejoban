import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { resetBotTemplate, resetBotTemplates, resetSosmed, saveBotTemplate, saveSosmed } from '../../../fitur-actions'
import { TemplateForm } from '@/components/admin/template-form'
import { loadSosmed, loadTemplates } from '@/lib/bot/respond'
import { alamatSitus } from '@/lib/situs-server'
import { daftarTautanWa } from '@/lib/situs'
import { renderTemplate } from '@/lib/text/template'
import { CHANNELS, CHANNEL_LABEL, DEFAULT_SOSMED, DEFAULT_TEMPLATES, SAMPLE_VARS, TEMPLATE_INFO, TEMPLATE_KE_ADMIN, TEMPLATE_KEYS, type TemplateKey } from '@/lib/bot/templates'
import { Badge, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { ConfirmDialog, Drawer } from '@/components/admin/overlay'
import { CopyButton } from '@/components/admin/copy-button'

// Cuplikan satu baris dengan contoh isi variabel (tanpa kurung kurawal): baris baru jadi spasi, dipotong CSS sesuai lebar sel.
const ringkas = (t: string) => renderTemplate(t, SAMPLE_VARS).replace(/\s*\n\s*/g, ' ')

export default async function TemplatChatbot() {
  await requireOwner()
  const [templates, sosmed, branches, origin] = await Promise.all([loadTemplates(), loadSosmed(), db.branch.findMany({ orderBy: { sort: 'asc' } }), alamatSitus()])
  // Teks sosial media memakai tautan pendek situs, jadi yang disalin sudah berisi alamat sungguhan.
  const tautanWa = daftarTautanWa(branches, origin)
  const kelompok: { id: string; judul: string; note: string; keys: TemplateKey[] }[] = [
    { id: 'pelanggan', judul: 'Ke pelanggan', note: 'Kalimat yang dikirim bot ke pelanggan di WhatsApp.', keys: TEMPLATE_KEYS.filter((k) => !TEMPLATE_KE_ADMIN.includes(k)) },
    { id: 'admin', judul: 'Ke admin', note: 'Ringkasan yang dikirim ke nomor admin atau owner saat percakapan diserahkan.', keys: TEMPLATE_KEYS.filter((k) => TEMPLATE_KE_ADMIN.includes(k)) },
  ]
  return (
    <PageBody>
      <PageHeader
        title="Templat pesan"
        note="Semua kalimat yang dikirim bot dan balasan otomatis sosial media. Buka Ubah untuk mengganti satu templat, isi otomatis seperti cabang dan ukuran diganti saat pesan dikirim."
        actions={
          <ConfirmDialog
            trigger="Kembalikan semua ke bawaan"
            triggerClassName="adm-btn-line"
            title="Kembalikan semua templat ke bawaan?"
            message={
              <>
                <p>Semua kalimat bot yang sudah kamu ubah diganti dengan kalimat bawaan. Perubahan itu tidak bisa dikembalikan.</p>
                <p className="text-mute">Balasan otomatis sosial media juga kembali ke teks bawaan.</p>
              </>
            }
            confirm={{ action: resetBotTemplates, label: 'Kembalikan ke bawaan' }}
          />
        }
      />
      {kelompok.map((g) => (
        <Section key={g.id} id={g.id} title={g.judul} description={g.note}>
          <DataTable
            caption={`Templat pesan ${g.judul.toLowerCase()}`}
            rows={g.keys}
            rowKey={(k) => k}
            columns={[
              { key: 'nama', header: 'Templat', mobile: 'title', className: 'font-semibold text-ink', cell: (k) => TEMPLATE_INFO[k].label },
              { key: 'kapan', header: 'Kapan dikirim', mobile: 'hide', className: 'max-w-[320px] text-mute', cell: (k) => <span className="line-clamp-2">{TEMPLATE_INFO[k].when}</span> },
              {
                key: 'isi',
                header: 'Cuplikan',
                mobile: 'meta',
                mobileLabel: false,
                className: 'max-w-[300px]',
                cell: (k) => (
                  <span className="line-clamp-1 break-words">
                    {ringkas(templates[k])}
                    {templates[k] !== DEFAULT_TEMPLATES[k] && <span className="ml-2 align-middle"><Badge tone="light">Diubah</Badge></span>}
                  </span>
                ),
              },
            ]}
            actions={(k) => (
              <Drawer trigger="Ubah" triggerLabel={`Ubah templat ${TEMPLATE_INFO[k].label}`} title={`Ubah templat: ${TEMPLATE_INFO[k].label}`}>
                <TemplateForm kunci={k} nilai={templates[k]} when={TEMPLATE_INFO[k].when} vars={TEMPLATE_INFO[k].vars} simpan={saveBotTemplate} kembalikan={resetBotTemplate} />
              </Drawer>
            )}
          />
        </Section>
      ))}
      <Section
        id="sosmed"
        title="Untuk sosial media"
        description={
          <>
            Balasan otomatis Instagram, Facebook, dan TikTok yang mengarahkan pelanggan ke WhatsApp lewat tautan pendek tiap cabang. Tekan Salin lalu tempel di fitur balasan otomatis aplikasinya; nomor tujuan diubah di{' '}
            <Link href="/admin/situs" className="font-semibold underline">Situs, Tautan WhatsApp</Link>.
          </>
        }
      >
        <DataTable
          caption="Balasan otomatis sosial media"
          rows={[...CHANNELS]}
          rowKey={(c) => c}
          tanpaBingkai
          columns={[
            { key: 'nama', header: 'Aplikasi', mobile: 'title', className: 'font-semibold text-ink', cell: (c) => CHANNEL_LABEL[c] },
            {
              key: 'isi',
              header: 'Cuplikan',
              mobile: 'meta',
              mobileLabel: false,
              className: 'max-w-[420px]',
              cell: (c) => (
                <span className="line-clamp-1 break-words">
                  {ringkas(renderTemplate(sosmed[c], { tautanWa }))}
                  {sosmed[c] !== DEFAULT_SOSMED[c] && <span className="ml-2 align-middle"><Badge tone="light">Diubah</Badge></span>}
                </span>
              ),
            },
          ]}
          actions={(c) => (
            <>
              <CopyButton
                text={renderTemplate(sosmed[c], { tautanWa })}
                label="Salin"
                ariaLabel={`Salin balasan ${CHANNEL_LABEL[c]}`}
                pesan={`Balasan ${CHANNEL_LABEL[c]} tersalin`}
                className="adm-btn-line adm-btn-sm"
              />
              <Drawer trigger="Ubah" triggerLabel={`Ubah balasan ${CHANNEL_LABEL[c]}`} title={`Ubah balasan: ${CHANNEL_LABEL[c]}`}>
                <TemplateForm
                  kunci={c}
                  nilai={sosmed[c]}
                  when={`Dikirim otomatis oleh ${CHANNEL_LABEL[c]} saat ada pesan masuk. Salin teksnya ke fitur balasan otomatis di aplikasi itu.`}
                  vars={['tautanWa']}
                  simpan={saveSosmed}
                  kembalikan={resetSosmed}
                  label="Isi balasan"
                  pratinjau="Pratinjau yang disalin"
                  contoh={{ tautanWa }}
                  tombolSimpan="Simpan balasan"
                  tombolKembali="Kembalikan balasan ini ke bawaan"
                />
              </Drawer>
            </>
          )}
        />
      </Section>
    </PageBody>
  )
}
