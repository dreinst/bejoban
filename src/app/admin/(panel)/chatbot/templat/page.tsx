import { requireOwner } from '@/lib/auth'
import { resetBotTemplates, saveBotTemplates } from '../../../fitur-actions'
import { TemplateEditor } from '@/components/admin/template-editor'
import { loadTemplates } from '@/lib/bot/respond'
import { Card } from '@/components/admin/simple-list'
import { PageHeader } from '@/components/admin/ui'

export default async function TemplatChatbot() {
  await requireOwner()
  const templates = await loadTemplates()
  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader title="Templat pesan" note="Semua kalimat yang dikirim bot. Kata dalam kurung kurawal diganti isi sebenarnya; pratinjau di kanan memakai contoh." />
      <Card title="Templat">
        <form action={saveBotTemplates} className="space-y-4">
          <TemplateEditor initial={templates} />
          <button className="adm-btn">Simpan templat</button>
        </form>
        <form action={resetBotTemplates} className="mt-4 border-t border-line pt-3"><button className="text-xs font-semibold text-red-600">Kembalikan semua templat ke bawaan</button></form>
      </Card>
    </div>
  )
}
