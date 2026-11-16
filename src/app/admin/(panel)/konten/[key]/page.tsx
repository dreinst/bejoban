import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireOwner } from '@/lib/auth'
import { sectionByKey } from '@/lib/content'
import { getContent } from '@/lib/settings'
import { db } from '@/lib/db'
import { saveSection } from '../../../actions'
import { SectionEditor } from '@/components/admin/section-editor'

export default async function EditSection({ params }: PageProps<'/admin/konten/[key]'>) {
  await requireOwner()
  const { key } = await params
  const section = sectionByKey(key)
  if (!section) notFound()
  const [content, products] = await Promise.all([getContent(), db.product.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })])
  return (
    <div className="max-w-3xl">
      <Link href="/admin/konten" className="text-sm text-neutral-500">← Tampilan beranda</Link>
      <h1 className="mb-2 mt-2 text-2xl font-bold text-ink">{section.title}</h1>
      {section.note && <p className="mb-4 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-800">{section.note}</p>}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <SectionEditor key={JSON.stringify(content[key])} sectionKey={key} fields={section.fields} initial={content[key]} products={products} action={saveSection} />
      </div>
    </div>
  )
}
