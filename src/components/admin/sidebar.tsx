'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { ChevronUp, LayoutDashboard, Menu, MessageCircle, Package, Settings, Store, Truck, X, type LucideIcon } from 'lucide-react'
import { activeFor, type AdminMenu } from '@/lib/admin-menu'
import { hapusCatatan } from './panel-simpan'

const ICON: Record<string, LucideIcon> = {
  ringkasan: LayoutDashboard,
  'stok-harga': Package,
  chatbot: MessageCircle,
  ongkir: Truck,
  situs: Store,
  pengaturan: Settings,
}

/* eslint-disable @next/next/no-img-element */
// Sidebar gelap: paling banyak enam menu tanpa judul kelompok, lalu satu menu profil di bawah.
// Di layar kecil menjadi bilah atas dengan menu yang bisa dibuka tutup.
export function AdminSidebar({ menu, name, role, logout }: { menu: AdminMenu[]; name: string; role: string; logout: () => Promise<void> }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const active = activeFor(pathname, menu).menu
  const tombol = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)

  // Menu HP terbuka: Escape menutup dan mengembalikan fokus ke tombol menu, gulir halaman dikunci.
  // Menu profil yang sedang terbuka menutup dirinya dulu dengan Escape yang sama.
  useEffect(() => {
    if (!open) return
    const hp = window.matchMedia('(max-width: 767px)')
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !hp.matches) return
      if (panel.current?.querySelector('[aria-controls][aria-expanded="true"]')) return
      setOpen(false)
      tombol.current?.focus()
    }
    const ubah = () => {
      if (!hp.matches) setOpen(false)
    }
    // Kunci gulir dengan body `position: fixed; top: -scrollY`. `overflow: hidden` saja tidak menahan gulir di Safari iOS.
    // Posisi disimpan lalu dikembalikan tanpa animasi (html memakai scroll-behavior: smooth).
    const y = window.scrollY
    const gaya = document.body.style
    const awal = { position: gaya.position, top: gaya.top, left: gaya.left, right: gaya.right, overflow: gaya.overflow }
    if (hp.matches) {
      gaya.position = 'fixed'
      gaya.top = `-${y}px`
      gaya.left = '0'
      gaya.right = '0'
      gaya.overflow = 'hidden'
    }
    document.addEventListener('keydown', key)
    hp.addEventListener('change', ubah)
    return () => {
      Object.assign(gaya, awal)
      if (hp.matches) window.scrollTo({ top: y, behavior: 'instant' })
      document.removeEventListener('keydown', key)
      hp.removeEventListener('change', ubah)
    }
  }, [open])
  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white md:hidden">
        <Link href="/admin" aria-label="Ringkasan admin"><img src="/logo-bejoban-putih.svg" alt="Bejo Ban" className="h-7 w-auto" /></Link>
        <button ref={tombol} type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="menu-admin" aria-label={open ? 'Tutup menu' : 'Buka menu'} className="grid size-10 place-items-center rounded-lg hover:bg-white/10 max-md:size-11">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <aside
        ref={panel}
        id="menu-admin"
        className={`bg-ink text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col ${open ? 'fixed inset-x-0 bottom-0 top-14 z-20 flex flex-col md:inset-auto md:top-0' : 'hidden'}`}
      >
        <div className="hidden px-5 pb-5 pt-6 md:block">
          <Link href="/admin" aria-label="Ringkasan admin"><img src="/logo-bejoban-putih.svg" alt="Bejo Ban" className="h-9 w-auto" /></Link>
        </div>
        <nav aria-label="Menu admin" className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:py-1">
          <ul className="space-y-1">
            {menu.map((m) => {
              const on = m.key === active
              const Icon = ICON[m.key] ?? LayoutDashboard
              return (
                <li key={m.key}>
                  <Link
                    href={m.href}
                    onClick={() => setOpen(false)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm max-md:min-h-11 ${on ? 'border-white bg-white/10 font-bold text-white' : 'border-transparent text-soft-dark hover:bg-white/5 hover:text-white'}`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {m.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <ProfileMenu name={name} role={role} logout={logout} onPick={() => setOpen(false)} />
      </aside>
    </>
  )
}

// Tombol profil yang membuka daftar kecil ke atas. Tertutup lagi saat memilih, menekan Escape, atau klik di luar.
function ProfileMenu({ name, role, logout, onPick }: { name: string; role: string; logout: () => Promise<void>; onPick: () => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const owner = role === 'OWNER'

  useEffect(() => {
    if (!open) return
    box.current?.querySelector<HTMLElement>('a,button[type=submit]')?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    const click = (e: MouseEvent) => {
      if (!box.current?.parentElement?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', click)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('mousedown', click)
    }
  }, [open])

  const pick = () => {
    setOpen(false)
    onPick()
  }
  const item = 'block w-full rounded-md px-3 py-2 text-left text-sm max-md:flex max-md:min-h-11 max-md:items-center text-soft-dark hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white'
  return (
    <div className="relative border-t border-line-dark px-3 py-3">
      {open && (
        <div ref={box} id={id} className="absolute inset-x-3 bottom-full mb-1 rounded-lg border border-line-dark bg-graphite p-1 shadow-lg">
          <Link href="/" target="_blank" onClick={pick} className={item}>Lihat situs<span className="sr-only"> (tab baru)</span></Link>
          <Link href="/admin/akun" onClick={pick} className={item}>Akun saya</Link>
          {!owner && <Link href="/admin/cabang" onClick={pick} className={item}>Data cabang saya</Link>}
          <form action={logout} onSubmit={hapusCatatan}>
            <button type="submit" className={item}>Keluar</button>
          </form>
        </div>
      )}
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5 max-md:min-h-11"
      >
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold uppercase">{name.slice(0, 1)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{name}</span>
          <span className="block text-xs text-mute-dark">{owner ? 'Owner' : 'Admin cabang'}</span>
        </span>
        <ChevronUp className={`size-4 text-mute-dark transition ${open ? '' : 'rotate-180'}`} aria-hidden />
        <span className="sr-only">{open ? 'Tutup menu profil' : 'Buka menu profil'}</span>
      </button>
    </div>
  )
}
