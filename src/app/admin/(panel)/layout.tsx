import Link from 'next/link'
import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { logout } from '../actions'
import { Flash } from '@/components/admin/flash'

export const metadata = { title: 'Admin | Bejo Ban' }

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const nav: [string, string, boolean][] = [
    ['/admin', 'Ringkasan', true],
    ['/admin/produk', 'Produk', true],
    ['/admin/harga', 'Pricelist & Stok', true],
    ['/admin/konten', 'Tampilan Web', owner],
    ['/admin/kategori', 'Kategori', owner],
    ['/admin/merek', 'Merek', owner],
    ['/admin/cabang', 'Cabang', true],
    ['/admin/pengguna', 'Pengguna', owner],
    ['/admin/panduan-foto', 'Panduan Ukuran Foto', true],
    ['/admin/akun', 'Akun Saya', true],
  ]
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-800 md:flex">
      <aside className="bg-ink p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <p className="text-lg font-black">BEJO BAN <span className="text-paper/60">ADMIN</span></p>
        <p className="mb-5 text-xs text-white/70">{s.name} · {owner ? 'Owner' : 'Admin cabang'}</p>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto md:flex-col">
          {nav.filter(([, , show]) => show).map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-lg px-3 py-2 text-sm hover:bg-white/10">{label}</Link>
          ))}
          <Link href="/" target="_blank" className="shrink-0 rounded-lg px-3 py-2 text-sm text-paper/60 hover:bg-white/10">Lihat Web ↗</Link>
          <form action={logout}>
            <button className="shrink-0 rounded-lg px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10">Keluar</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Suspense><Flash /></Suspense>
        {children}
      </main>
    </div>
  )
}
