import Link from 'next/link'
import { requireOwner } from '@/lib/auth'
import { SECTIONS, type Section } from '@/lib/content'
import { ChevronDown } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar } from '@/components/admin/data-table'

const tabel = (caption: string, rows: Section[]) => (
  <DataTable
    caption={caption}
    rows={rows}
    rowKey={(s) => s.key}
    columns={[
      { key: 'judul', header: 'Bagian', className: 'w-64', cell: (s) => <span className="font-semibold text-ink">{s.title}</span> },
      { key: 'isi', header: 'Isi', mobileLabel: false, cell: (s) => <span className="text-mute">{s.fields.map((f) => f.label).join(', ')}</span> },
    ]}
    actions={(s) => <Link href={`/admin/konten/${s.key}`} aria-label={`Ubah ${s.title}`} className="adm-btn-line adm-btn-sm">Ubah</Link>}
  />
)

export default async function Konten() {
  await requireOwner()
  const tampil = SECTIONS.filter((s) => !s.hidden)
  const tersimpan = SECTIONS.filter((s) => s.hidden)
  return (
    <PageBody>
      <PageHeader title="Tampilan beranda" note="Bagian di tabel ini berurutan seperti di beranda dan urutannya tetap. Yang bisa diubah adalah isi tiap bagian." />
      <ListToolbar count={tampil.length} noun="bagian beranda" />
      {tabel('Daftar bagian beranda', tampil)}
      {tersimpan.length > 0 && (
        <details className="group">
          <summary className="adm-card flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>Bagian yang tidak tampil di beranda ({tersimpan.length})</span>
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-mute">Bagian ini tidak dipasang di beranda sekarang. Isinya tetap disimpan kalau nanti dipakai lagi.</p>
            {tabel('Bagian yang tidak tampil di beranda', tersimpan)}
          </div>
        </details>
      )}
    </PageBody>
  )
}
