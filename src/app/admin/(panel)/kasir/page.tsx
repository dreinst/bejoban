import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { muatKatalog } from '@/lib/kasir/katalog'
import { namaPendek } from '@/lib/tire/cabang'
import { Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { FilterChips } from '@/components/admin/data-table'
import { SegarkanSaatSiaran } from '@/components/admin/siaran'
import { LayarKasir } from './layar-kasir'

// Transaksi baru. Admin cabang memakai cabangnya sendiri, owner memilih cabang bermode kasir.
export default async function Kasir({ searchParams }: PageProps<'/admin/kasir'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { id: true, name: true, modeStok: true } })
  const aktif = branches.filter((b) => b.modeStok === 'kasir')
  const cabang = owner ? (aktif.find((b) => b.id === Number(sp.cabang)) ?? aktif[0]) : branches.find((b) => b.id === s.branchId)

  if (!cabang || cabang.modeStok !== 'kasir') {
    return (
      <PageBody>
        <PageHeader title="Kasir" />
        <Empty
          title={owner ? 'Kasir belum aktif di cabang mana pun' : 'Kasir belum aktif di cabang kamu'}
          action={owner ? <Link href="/admin/kasir/pengaturan" className="adm-btn">Buka Pengaturan kasir</Link> : undefined}
        >
          {owner ? 'Aktifkan kasir per cabang di Pengaturan kasir. Sesudah aktif, stok cabang itu berubah lewat transaksi kasir.' : 'Minta owner mengaktifkan kasir untuk cabang kamu.'}
        </Empty>
      </PageBody>
    )
  }

  const katalog = await muatKatalog(cabang.id)
  return (
    <PageBody>
      <PageHeader title={`Kasir ${namaPendek(cabang.name)}`} note="Harga sudah termasuk pajak. Harga yang tampil adalah harga batch yang akan terjual." />
      {owner && aktif.length > 1 && (
        <FilterChips label="Pilih cabang" items={aktif.map((b) => ({ href: `/admin/kasir?cabang=${b.id}`, label: namaPendek(b.name), active: b.id === cabang.id }))} />
      )}
      <SegarkanSaatSiaran jenis={['stok']} cabangId={cabang.id} />
      <LayarKasir key={cabang.id} cabang={{ id: cabang.id, nama: namaPendek(cabang.name) }} katalog={katalog} owner={owner} />
    </PageBody>
  )
}
