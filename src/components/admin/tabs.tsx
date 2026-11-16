'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { activeFor, type AdminMenu } from '@/lib/admin-menu'

// Tab di atas halaman admin. Tab aktif dibaca dari alamat halaman, jadi tiap tab punya alamat sendiri.
// Hanya tampil kalau menu yang aktif punya dua tab atau lebih untuk peran ini.
// badges: angka kecil per kunci tab (mis. jumlah yang perlu dicek); 0 tidak ditampilkan.
export function AdminTabs({ menu, badges = {} }: { menu: AdminMenu[]; badges?: Record<string, number> }) {
  const pathname = usePathname()
  const active = activeFor(pathname, menu)
  const m = menu.find((x) => x.key === active.menu)
  if (!m || m.tabs.length < 2 || !active.tab) return null
  return (
    <nav aria-label={`Bagian ${m.label}`} className="-mx-4 mb-5 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max min-w-full gap-1 border-b border-line">
        {m.tabs.map((t) => {
          const on = t.key === active.tab
          const n = badges[t.key] ?? 0
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm ${on ? 'border-ink font-bold text-ink' : 'border-transparent text-mute hover:border-neutral-300 hover:text-ink'}`}
              >
                {t.label}
                {n > 0 && (
                  <span className="rounded-full bg-ink px-1.5 py-px text-[11px] font-bold leading-4 text-white">
                    {n > 99 ? '99+' : n}
                    <span className="sr-only"> perlu dicek</span>
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
