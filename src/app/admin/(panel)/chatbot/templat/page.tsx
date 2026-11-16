import { requireOwner } from '@/lib/auth'
import { resetBotTemplate, resetBotTemplates, saveBotTemplate } from '../../../fitur-actions'
import { TemplateForm } from '@/components/admin/template-form'
import { loadTemplates } from '@/lib/bot/respond'
import { renderTemplate } from '@/lib/text/template'
import { DEFAULT_TEMPLATES, SAMPLE_VARS, TEMPLATE_INFO, TEMPLATE_KE_ADMIN, TEMPLATE_KEYS, type TemplateKey } from '@/lib/bot/templates'
import { Badge, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { ConfirmDialog, Drawer } from '@/components/admin/overlay'

// Cuplikan satu baris dengan contoh isi variabel (tanpa kurung kurawal): baris baru jadi spasi, dipotong CSS sesuai lebar sel.
const ringkas = (t: string) => renderTemplate(t, SAMPLE_VARS).replace(/\s*\n\s*/g, ' ')

export default async function TemplatChatbot() {
  await requireOwner()
  const templates = await loadTemplates()
  const kelompok: { id: string; judul: string; note: string; keys: TemplateKey[] }[] = [
    { id: 'pelanggan', judul: 'Ke pelanggan', note: 'Kalimat yang dikirim bot ke pelanggan di WhatsApp.', keys: TEMPLATE_KEYS.filter((k) => !TEMPLATE_KE_ADMIN.includes(k)) },
    { id: 'admin', judul: 'Ke admin', note: 'Ringkasan yang dikirim ke nomor admin atau owner saat percakapan diserahkan.', keys: TEMPLATE_KEYS.filter((k) => TEMPLATE_KE_ADMIN.includes(k)) },
  ]
  return (
    <PageBody>
      <PageHeader
        title="Templat pesan"
        note="Semua kalimat yang dikirim bot. Buka Ubah untuk mengganti satu templat; isi otomatis seperti cabang dan ukuran diganti saat pesan dikirim, dan pratinjaunya memakai contoh."
        actions={
          <ConfirmDialog
            trigger="Kembalikan semua ke bawaan"
            triggerClassName="adm-btn-line"
            title="Kembalikan semua templat ke bawaan?"
            message={
              <>
                <p>Semua kalimat bot yang sudah kamu ubah diganti dengan kalimat bawaan. Perubahan itu tidak bisa dikembalikan.</p>
                <p className="text-mute">Balasan sosial media di tab Pengaturan bot tidak ikut berubah.</p>
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
    </PageBody>
  )
}
