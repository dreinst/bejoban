'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { activeHref, type MenuGroup } from '@/lib/admin-menu'

/* eslint-disable @next/next/no-img-element */
// Sidebar gelap dengan menu berkelompok. Di layar kecil menjadi bilah atas dengan menu yang bisa dibuka tutup.
export function AdminSidebar({ groups, name, role, logout }: { groups: MenuGroup[]; name: string; role: string; logout: () => Promise<void> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const active = activeHref(pathname, groups)
  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white md:hidden">
        <Link href="/admin" aria-label="Ringkasan admin"><img src="/logo-bejoban-putih.svg" alt="Bejo Ban" className="h-7 w-auto" /></Link>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="menu-admin" aria-label={open ? 'Tutup menu' : 'Buka menu'} className="grid size-10 place-items-center rounded-lg hover:bg-white/10">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <aside
        id="menu-admin"
        className={`bg-ink text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col ${open ? 'fixed inset-x-0 bottom-0 top-14 z-20 flex flex-col md:inset-auto md:top-0' : 'hidden'}`}
      >
        <div className="hidden px-5 pb-4 pt-6 md:block">
          <Link href="/admin" aria-label="Ringkasan admin"><img src="/logo-bejoban-putih.svg" alt="Bejo Ban" className="h-9 w-auto" /></Link>
          <p className="mt-3 text-xs text-mute-dark">{name} · {role === 'OWNER' ? 'Owner' : 'Admin cabang'}</p>
        </div>
        <nav aria-label="Menu admin" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 md:py-2">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-mute-dark">{g.title}</p>
              {g.soon ? (
                <p className="px-3 py-1.5 text-sm italic text-mute-dark/80" aria-disabled="true">{g.soon}</p>
              ) : (
                <ul className="space-y-0.5">
                  {g.items!.map((i) => {
                    const on = i.href === active
                    return (
                      <li key={i.href}>
                        <Link
                          href={i.href}
                          onClick={() => setOpen(false)}
                          aria-current={on ? 'page' : undefined}
                          className={`block rounded-lg border-l-[3px] px-3 py-2 text-sm ${on ? 'border-white bg-white/10 font-bold text-white' : 'border-transparent text-soft-dark hover:bg-white/5 hover:text-white'}`}
                        >
                          {i.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line-dark px-3 py-3">
          <p className="px-3 text-xs text-mute-dark md:hidden">{name} · {role === 'OWNER' ? 'Owner' : 'Admin cabang'}</p>
          <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-mute-dark hover:bg-white/5 hover:text-white">Lihat situs</Link>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-mute-dark hover:bg-white/5 hover:text-white">Keluar</button>
          </form>
        </div>
      </aside>
    </>
  )
}
