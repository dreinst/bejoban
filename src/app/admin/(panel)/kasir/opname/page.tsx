import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { STATUS_OPNAME_LABEL, type StatusOpname } from '@/lib/kasir/opname'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, Empty, PageBody, PageHeader, Section } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { SubmitButton } from '@/components/admin/overlay'
import { inputCls } from '@/components/admin/form-cls'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'
import { mulaiOpnameAksi } from '../../../kasir-actions'

// Daftar opname. Admin cabang mengisi opname cabangnya, owner meninjau dan memfinalkan.
export default async function DaftarOpname() {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const kasir = branches.filter((b) => b.modeStok === 'kasir' && (owner || b.id === s.branchId))
  const where = owner ? {} : { cabangId: s.branchId ?? -1 }
  const rows = await db.stokOpname.findMany({ where, orderBy: [{ tanggal: 'desc' }, { id: 'desc' }], take: 100, include: { _count: { select: { detail: true } } } })
  const buka = rows.filter((r) => r.status !== 'final')
  const bisaMulai = kasir.filter((b) => !buka.some((r) => r.cabangId === b.id))
  const nama = (id: number) => namaPendek(branches.find((b) => b.id === id)?.name ?? `Cabang ${id}`)
  type Baris = (typeof rows)[number]

  return (
    <PageBody>
      <PageHeader
        title="Stok opname"
        note={owner ? 'Admin cabang menghitung barang dan mengisi stok fisik. Owner meninjau lalu memfinalkan. Saat final, selisihnya diterapkan ke stok.' : 'Hitung barang di toko, isi stok fisiknya, lalu kirim ke owner untuk ditinjau. Stok baru berubah sesudah owner memfinalkan.'}
      />
      <SegarkanSaatSiaran jenis={['pengajuan', 'stok']} />
      {!kasir.length ? (
        <Empty title="Opname belum bisa dipakai">Opname hanya untuk cabang yang sudah memakai kasir. Stok cabang mode sheet masih diisi dari sheet.</Empty>
      ) : (
        bisaMulai.length > 0 && (
          <Section title="Mulai opname" description="Satu cabang hanya punya satu opname yang belum final.">
            <form action={mulaiOpnameAksi} className="flex flex-wrap items-end gap-3">
              {owner ? (
                <div>
                  <label htmlFor="o-cabang" className="mb-1 block text-xs font-semibold text-neutral-700">Cabang</label>
                  <select id="o-cabang" name="cabang" className={`${inputCls} min-h-11`}>
                    {bisaMulai.map((b) => <option key={b.id} value={b.id}>{namaPendek(b.name)}</option>)}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-ink">Cabang <b>{nama(bisaMulai[0].id)}</b></p>
              )}
              <div className="min-w-0 flex-1 basis-60">
                <label htmlFor="o-catatan" className="mb-1 block text-xs font-semibold text-neutral-700">Catatan (boleh kosong)</label>
                <input id="o-catatan" name="catatan" maxLength={300} className={`${inputCls} min-h-11`} placeholder="Mis. rak ring 15 dan 16" />
              </div>
              <SubmitButton className="adm-btn min-h-11" pending="Membuat...">Mulai opname</SubmitButton>
            </form>
          </Section>
        )
      )}
      <DataTable<Baris>
        caption="Daftar opname"
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: 'tanggal', header: 'Dimulai', mobile: 'title', cell: (r) => <Link href={`/admin/kasir/opname/${r.id}`} className="font-semibold text-ink underline underline-offset-2">{waktuWib(r.tanggal)}</Link> },
          ...(owner ? [{ key: 'cabang', header: 'Cabang', cell: (r: Baris) => nama(r.cabangId) }] : []),
          { key: 'oleh', header: 'Penginput', cell: (r) => r.namaPenginput },
          { key: 'baris', header: 'Baris', align: 'right', cell: (r) => r._count.detail },
          { key: 'status', header: 'Status', cell: (r) => <Badge tone={r.status === 'final' ? 'outline' : r.status === 'review' ? 'dark' : 'light'}>{STATUS_OPNAME_LABEL[r.status as StatusOpname] ?? r.status}</Badge> },
        ]}
        actions={(r) => <Link href={`/admin/kasir/opname/${r.id}`} className="adm-btn-line adm-btn-sm" aria-label={`Buka opname ${waktuWib(r.tanggal)}`}>{r.status === 'final' ? 'Lihat' : 'Buka'}</Link>}
        empty={<Empty title="Belum ada opname">Mulai opname baru di atas.</Empty>}
      />
    </PageBody>
  )
}
