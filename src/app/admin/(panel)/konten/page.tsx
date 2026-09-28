import Link from 'next/link'
import { requireOwner } from '@/lib/auth'
import { SECTIONS } from '@/lib/content'

export default async function Konten() {
  await requireOwner()
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Tampilan Web</h1>
      <p className="mb-6 text-sm text-neutral-500">Urutan di bawah sama dengan urutan bagian di halaman depan.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.key} href={`/admin/konten/${s.key}`} className="rounded-xl bg-white p-5 shadow-sm hover:ring-2 hover:ring-ink">
            <p className="font-semibold text-ink">{s.title}</p>
            <p className="mt-1 text-xs text-neutral-500">{s.fields.map((f) => f.label).join(', ')}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
