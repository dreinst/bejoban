import Link from 'next/link'
import { requireOwner } from '@/lib/auth'
import { SECTIONS } from '@/lib/content'
import { Badge, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, ListToolbar } from '@/components/admin/data-table'

export default async function Konten() {
  await requireOwner()
  return (
    <PageBody>
      <PageHeader title="Tampilan beranda" note="Urutan bagian di beranda ditentukan oleh kode situs, jadi tidak bisa digeser di sini. Yang bisa diubah adalah isi tiap bagian." />
      <ListToolbar count={SECTIONS.length} noun="bagian beranda" />
      <DataTable
        caption="Daftar bagian beranda"
        rows={SECTIONS}
        rowKey={(s) => s.key}
        columns={[
          {
            key: 'judul',
            header: 'Bagian',
            className: 'w-64',
            cell: (s) => (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{s.title}</span>
                {s.hidden && <Badge tone="light">tidak tampil</Badge>}
              </span>
            ),
          },
          { key: 'isi', header: 'Isi', mobileLabel: false, cell: (s) => <span className="text-mute">{s.fields.map((f) => f.label).join(', ')}</span> },
        ]}
        actions={(s) => <Link href={`/admin/konten/${s.key}`} aria-label={`Ubah ${s.title}`} className="adm-btn-line adm-btn-sm">Ubah</Link>}
      />
    </PageBody>
  )
}
