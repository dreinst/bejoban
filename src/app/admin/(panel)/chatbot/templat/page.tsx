import { requireOwner } from '@/lib/auth'
import { resetBotTemplates, saveBotTemplates } from '../../../fitur-actions'
import { TemplateEditor } from '@/components/admin/template-editor'
import { loadTemplates } from '@/lib/bot/respond'
import { PageBody, PageHeader, Section } from '@/components/admin/ui'
import { FormActions } from '@/components/admin/field'
import { ConfirmDialog, SubmitButton } from '@/components/admin/overlay'

export default async function TemplatChatbot() {
  await requireOwner()
  const templates = await loadTemplates()
  return (
    <PageBody>
      <PageHeader title="Templat pesan" note="Semua kalimat yang dikirim bot. Kata dalam kurung kurawal diganti isi sebenarnya; pratinjau di kanan memakai contoh." />
      <Section
        id="templat"
        title="Kalimat bot"
        actions={
          <ConfirmDialog
            trigger="Kembalikan semua templat ke bawaan"
            triggerClassName="adm-btn-line adm-btn-sm"
            title="Kembalikan semua templat ke bawaan?"
            message={
              <>
                <p>Semua kalimat bot yang sudah kamu ubah diganti dengan kalimat bawaan. Perubahan itu tidak bisa dikembalikan.</p>
                <p className="text-mute">Templat sosial media di Pengaturan, WhatsApp dan chatbot tidak ikut berubah.</p>
              </>
            }
            confirm={{ action: resetBotTemplates, label: 'Kembalikan ke bawaan' }}
          />
        }
      >
        <form action={saveBotTemplates}>
          <TemplateEditor initial={templates} />
          <FormActions>
            <SubmitButton>Simpan templat</SubmitButton>
          </FormActions>
        </form>
      </Section>
    </PageBody>
  )
}
