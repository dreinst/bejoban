import Link from 'next/link'
import { requireOwner } from '@/lib/auth'
import { SECTIONS } from '@/lib/content'
import { Badge, PageHeader } from '@/components/admin/ui'

export default async function Konten() {
  await requireOwner()
  return (
    <div>
      <PageHeader title="Tampilan beranda" note="Urutan di bawah sama dengan urutan bagian di beranda." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/admin/konten/${s.key}`} className="rounded-xl bg-white p-5 shadow-sm hover:ring-2 hover:ring-ink">
            <p className="flex items-center justify-between gap-2 font-semibold text-ink">{s.title}{s.hidden && <Badge tone="light">tidak tampil</Badge>}</p>
            <p className="mt-1 text-xs text-neutral-500">{s.fields.map((f) => f.label).join(', ')}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
