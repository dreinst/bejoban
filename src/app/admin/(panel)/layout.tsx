import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { menuFor } from '@/lib/admin-menu'
import { hitungPerluDicek } from '@/lib/perlu-dicek'
import { logout } from '../actions'
import { Flash } from '@/components/admin/flash'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminTabs } from '@/components/admin/tabs'

export const metadata = { title: 'Admin | Bejo Ban' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const s = await requireUser()
  // Menu dan tab disaring menurut peran di server. Halaman dan aksi tetap memeriksa hak masing-masing.
  const menu = menuFor(s.role)
  const cek = await hitungPerluDicek(s)
  return (
    <div className="min-h-screen bg-soft text-neutral-800 md:flex">
      <AdminSidebar menu={menu} name={s.name} role={s.role} logout={logout} />
      <main className="adm-area min-w-0 flex-1 p-4 md:p-8">
        <AdminTabs menu={menu} badges={{ 'perlu-dicek': cek.total }} />
        <Suspense><Flash /></Suspense>
        {children}
      </main>
    </div>
  )
}
