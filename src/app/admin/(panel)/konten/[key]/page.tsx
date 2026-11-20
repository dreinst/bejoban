import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { sectionByKey } from '@/lib/content'
import { getContent } from '@/lib/settings'
import { db } from '@/lib/db'
import { saveSection } from '../../../actions'
import { SectionEditor } from '@/components/admin/section-editor'
import { PageBody, PageHeader } from '@/components/admin/ui'

export default async function EditSection({ params }: PageProps<'/admin/konten/[key]'>) {
  await requireOwner()
  const { key } = await params
  const section = sectionByKey(key)
  if (!section) notFound()
  const [content, products] = await Promise.all([getContent(), db.product.findMany({ select: { id: true, name: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] })])
  return (
    <PageBody width="form">
      <Link href="/admin/konten" className="inline-flex min-h-10 items-center text-sm font-semibold text-mute underline-offset-2 hover:text-ink hover:underline">← Tampilan beranda</Link>
      <PageHeader title={section.title} note={section.note} />
      <div className="adm-card p-5">
        <SectionEditor key={JSON.stringify(content[key])} sectionKey={key} fields={section.fields} initial={content[key]} products={products} action={saveSection} />
      </div>
    </PageBody>
  )
}
