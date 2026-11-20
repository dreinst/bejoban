import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { isoWib } from '@/lib/kasir/logika'
import { muatBarangCabang } from '@/lib/kasir/katalog'
import { namaPendek } from '@/lib/tire/cabang'
import { Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { FilterChips } from '@/components/admin/data-table'
import { FormMasuk } from './form-masuk'

// Catat barang masuk. Admin cabang memakai cabangnya sendiri, owner memilih cabang bermode kasir.
export default async function CatatBarangMasuk({ searchParams }: PageProps<'/admin/kasir/masuk/baru'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const aktif = branches.filter((b) => b.modeStok === 'kasir')
  const cabang = owner ? (aktif.find((b) => b.id === Number(sp.cabang)) ?? aktif[0]) : branches.find((b) => b.id === s.branchId)

  if (!cabang || cabang.modeStok !== 'kasir') {
    return (
      <PageBody>
        <PageHeader title="Catat barang masuk" />
        <Empty title="Cabang ini belum memakai kasir" action={<Link href="/admin/kasir/masuk" className="adm-btn-line">Kembali</Link>}>
          Stok cabang mode sheet masih diisi dari sheet, jadi barang yang datang dicatat di sheet. Barang masuk bisa dipakai sesudah owner mengaktifkan kasir untuk cabang ini.
        </Empty>
      </PageBody>
    )
  }

  const [barang, pemasok] = await Promise.all([
    muatBarangCabang(cabang.id),
    db.barangMasuk.findMany({ where: { cabangId: cabang.id }, distinct: ['pemasok'], orderBy: { dibuat: 'desc' }, take: 30, select: { pemasok: true, jenisPemasok: true } }),
  ])
  return (
    <PageBody>
      <PageHeader
        title={`Catat barang masuk ${namaPendek(cabang.name)}`}
        note={owner ? 'Harga jual yang kamu isi langsung dipakai batch baru.' : 'Kalau harga jual diubah, batch baru tetap memakai harga lama sampai owner menyetujui harga usulanmu.'}
        actions={<Link href="/admin/kasir/masuk" className="adm-btn-line min-h-11">Batal</Link>}
      />
      {owner && aktif.length > 1 && (
        <FilterChips label="Pilih cabang" items={aktif.map((b) => ({ href: `/admin/kasir/masuk/baru?cabang=${b.id}`, label: namaPendek(b.name), active: b.id === cabang.id }))} />
      )}
      <FormMasuk key={cabang.id} cabang={{ id: cabang.id, nama: namaPendek(cabang.name) }} barang={barang} owner={owner} hariIni={isoWib(new Date())} pemasokLama={pemasok} />
    </PageBody>
  )
}
