import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { ADMIN_MENU, type MenuGroup } from '@/lib/admin-menu'
import { logout } from '../actions'
import { Flash } from '@/components/admin/flash'
import { AdminSidebar } from '@/components/admin/sidebar'

export const metadata = { title: 'Admin | Bejo Ban' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  // Menu yang khusus owner disaring di server. Kelompok tanpa isi tersisa tidak ditampilkan.
  const groups: MenuGroup[] = ADMIN_MENU.map((g) => (g.items ? { ...g, items: g.items.filter((i) => owner || !i.owner) } : g)).filter((g) => g.soon || g.items!.length)
  return (
    <div className="min-h-screen bg-soft text-neutral-800 md:flex">
      <AdminSidebar groups={groups} name={s.name} role={s.role} logout={logout} />
      <main className="adm-area min-w-0 flex-1 p-4 md:p-8">
        <Suspense><Flash /></Suspense>
        {children}
      </main>
    </div>
  )
}
