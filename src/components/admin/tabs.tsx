'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { activeFor, type AdminMenu } from '@/lib/admin-menu'

// Tab di atas halaman admin. Tab aktif dibaca dari alamat halaman, jadi tiap tab punya alamat sendiri.
// Hanya tampil kalau menu yang aktif punya dua tab atau lebih untuk peran ini.
// badges: angka kecil per kunci tab (mis. jumlah yang perlu dicek); 0 tidak ditampilkan.
export function AdminTabs({ menu, badges = {} }: { menu: AdminMenu[]; badges?: Record<string, number> }) {
  const pathname = usePathname()
  const active = activeFor(pathname, menu)
  const m = menu.find((x) => x.key === active.menu)
  const ada = !!m && m.tabs.length >= 2 && !!active.tab
  const gulir = useRef<HTMLDivElement>(null)
  const [tepi, setTepi] = useState({ kiri: false, kanan: false })

  // Tanda pudar di tepi hanya muncul kalau di sisi itu masih ada tab yang tersembunyi.
  const ukur = useCallback(() => {
    const el = gulir.current
    if (!el) return
    const kiri = el.scrollLeft > 4
    const kanan = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setTepi((t) => (t.kiri === kiri && t.kanan === kanan ? t : { kiri, kanan }))
  }, [])

  // Tab aktif digulir ke tengah saat halaman dimuat atau tab berpindah (hanya terasa di HP).
  useEffect(() => {
    const el = gulir.current
    const on = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && on) {
      const a = on.getBoundingClientRect()
      const b = el.getBoundingClientRect()
      el.scrollLeft += a.left - b.left - (b.width - a.width) / 2
    }
    ukur()
    window.addEventListener('resize', ukur)
    return () => window.removeEventListener('resize', ukur)
  }, [pathname, ada, ukur])

  if (!m || !ada) return null
  const pudar = 'pointer-events-none absolute inset-y-0 z-10 w-8 md:hidden'
  return (
    <nav aria-label={`Bagian ${m.label}`} className="relative -mx-4 mb-5 md:mx-0">
      {tepi.kiri && <span aria-hidden className={`${pudar} left-0 bg-gradient-to-r from-soft to-transparent`} />}
      {tepi.kanan && <span aria-hidden className={`${pudar} right-0 bg-gradient-to-l from-soft to-transparent`} />}
      <div ref={gulir} onScroll={ukur} className="overflow-x-auto px-4 md:px-0">
        <ul className="relative flex w-max min-w-full gap-1 border-b border-line">
          {m.tabs.map((t) => {
            const on = t.key === active.tab
            const n = badges[t.key] ?? 0
            return (
              <li key={t.key}>
                <Link
                  href={t.href}
                  aria-current={on ? 'page' : undefined}
                  className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm max-md:min-h-11 ${on ? 'border-ink font-bold text-ink' : 'border-transparent text-mute hover:border-neutral-300 hover:text-ink'}`}
                >
                  {t.label}
                  {n > 0 && (
                    <span className="rounded-full bg-ink px-1.5 py-px text-[11px] font-bold leading-4 text-white">
                      {n > 99 ? '99+' : n}
                      <span className="sr-only">{t.key === 'tinjau-pengajuan' ? ' menunggu tinjauan' : ' perlu dicek'}</span>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
