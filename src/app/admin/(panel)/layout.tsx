import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { menuFor } from '@/lib/admin-menu'
import { hitungPerluDicek } from '@/lib/perlu-dicek'
import { logout } from '../actions'
import { Toast } from '@/components/admin/toast'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminTabs } from '@/components/admin/tabs'
import { SiaranAdmin } from '@/components/admin/siaran'
import { db } from '@/lib/db'

export const metadata = { title: 'Admin | Bejo Ban' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const s = await requireUser()
  // Menu dan tab disaring menurut peran di server. Halaman dan aksi tetap memeriksa hak masing-masing.
  const menu = menuFor(s.role)
  const owner = s.role === 'OWNER'
  const [cek, pengajuan, opname] = await Promise.all([
    hitungPerluDicek(s),
    owner ? db.pengajuanHarga.count({ where: { status: 'menunggu' } }) : 0,
    owner ? db.stokOpname.count({ where: { status: 'review' } }) : 0,
  ])
  return (
    <div className="min-h-screen bg-soft text-neutral-800 md:flex md:bg-[linear-gradient(90deg,#0a0a0a_15rem,#f2f2f2_15rem)]">
      <AdminSidebar menu={menu} name={s.name} role={s.role} logout={logout} />
      <main className="adm-area min-w-0 flex-1 p-4 md:p-8">
        <AdminTabs menu={menu} badges={{ 'perlu-dicek': cek.total, 'tinjau-pengajuan': pengajuan, opname }} />
        {children}
        <Suspense><Toast /></Suspense>
        <SiaranAdmin owner={s.role === 'OWNER'} />
      </main>
    </div>
  )
}
