import Link from 'next/link'
import { Search, ShoppingBag, ArrowUpRight } from 'lucide-react'
import { getContent } from '@/lib/settings'
import { currentBranch } from '@/lib/shop'
import { db } from '@/lib/db'
import { getSitus } from '@/lib/situs-server'
import { waNumber } from '@/lib/situs'
import { CartProvider, CartCount } from '@/components/cart'
import { BranchPicker } from '@/components/branch-picker'

/* eslint-disable @next/next/no-img-element */
export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const [c, { branches, branch }, categories, situs] = await Promise.all([getContent(), currentBranch(), db.category.findMany({ orderBy: { sort: 'asc' } }), getSitus()])
  const trust = c.trust.items as { title: string; sub: string }[]

  return (
    <CartProvider>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 lg:px-8">
          <Link href="/" className="shrink-0">
            {c.site.logo ? <img src={c.site.logo} alt={c.site.name} className="h-8 w-auto" /> : <span className="text-xl font-black tracking-tight">{c.site.name}</span>}
          </Link>
          <nav className="hidden flex-1 items-center gap-6 text-sm font-medium lg:flex">
            {categories.map((k) => (
              <Link key={k.id} href={`/produk?kategori=${k.slug}`} className="hover:underline hover:underline-offset-4">{k.name}</Link>
            ))}
            <Link href="/produk" className="hover:underline hover:underline-offset-4">Semua Produk</Link>
            <Link href="/galeri" className="hover:underline hover:underline-offset-4">Galeri</Link>
            <Link href="/kalkulator-ban" className="hover:underline hover:underline-offset-4">Kalkulator Ban</Link>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <form action="/produk" className="hidden items-center rounded-full border border-line px-3 md:flex">
              <Search className="size-4 text-mute" />
              <input name="q" placeholder="Cari ukuran atau merek" aria-label="Cari produk" className="h-9 w-44 bg-transparent px-2 text-sm outline-none placeholder:text-mute" />
            </form>
            <Link href="/produk" aria-label="Cari" className="md:hidden"><Search className="size-5" /></Link>
            <div className="hidden sm:block"><BranchPicker branches={branches} current={branch.slug} /></div>
            <Link href="/keranjang" aria-label="Keranjang" className="relative">
              <ShoppingBag className="size-5" />
              <CartCount />
            </Link>
          </div>
        </div>
        <div className="no-scrollbar flex items-center gap-5 overflow-x-auto border-t border-line px-4 py-2 text-sm lg:hidden">
          <div className="sm:hidden"><BranchPicker branches={branches} current={branch.slug} /></div>
          {categories.map((k) => <Link key={k.id} href={`/produk?kategori=${k.slug}`} className="shrink-0">{k.name}</Link>)}
          <Link href="/produk" className="shrink-0">Semua</Link>
          <Link href="/galeri" className="shrink-0">Galeri</Link>
          <Link href="/kalkulator-ban" className="shrink-0">Kalkulator</Link>
        </div>
      </header>

      <div className="overflow-hidden bg-ink py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-paper">
        <div className="ticker flex w-max">
          {[0, 1].map((n) => (
            <div key={n} className="flex shrink-0" aria-hidden={n === 1}>
              {[...trust, ...trust].map((t, i) => (
                <span key={i} className="px-6">{t.title} <span className="text-paper/60">({t.sub})</span> <span className="pl-6">●</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <main>{children}</main>

      <footer className="mt-24 bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-10 pt-16 md:grid-cols-4 lg:px-8">
          <div className="md:col-span-2">
            <p className="max-w-sm text-sm leading-relaxed text-paper/70">{c.footer.about}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {branches.map((b) => (
                <a key={b.id} href={`https://www.instagram.com/${b.instagram}/`} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-paper/30 px-3 py-1.5 text-xs hover:bg-paper hover:text-ink">
                  @{b.instagram} <ArrowUpRight className="size-3" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-paper/50">Belanja</p>
            <ul className="space-y-2 text-sm">
              {categories.map((k) => <li key={k.id}><Link href={`/produk?kategori=${k.slug}`} className="hover:underline">{k.name}</Link></li>)}
              <li><Link href="/galeri" className="hover:underline">Galeri</Link></li>
              <li><Link href="/kalkulator-ban" className="hover:underline">Kalkulator Ban</Link></li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.2em] text-paper/50">Cabang</p>
            <ul className="space-y-4 text-sm">
              {branches.map((b) => (
                <li key={b.id}>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-paper/70">Buka {b.hours}</p>
                  <a href={`/wa/${b.slug}`} target="_blank" className="underline underline-offset-4">WA {waNumber(situs, b)}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mx-auto max-w-7xl overflow-hidden px-4 lg:px-8">
          <p className="select-none whitespace-nowrap text-[18vw] font-black leading-[0.8] tracking-tighter text-paper/10 lg:text-[15rem]">{c.site.name.toUpperCase()}</p>
        </div>
        <p className="border-t border-paper/10 px-4 py-6 text-center text-xs text-paper/50">© {new Date().getFullYear()} {c.footer.copyright}</p>
      </footer>

      <a href={`/wa/${branch.slug}`} target="_blank" aria-label="Chat WhatsApp" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-ink py-3 pl-4 pr-5 text-sm font-semibold text-paper shadow-lg ring-1 ring-paper/20">
        <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8 8 0 0 1-2.4-1.5 9 9 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5.3-.5v-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.5 13.5 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.2-.3-.3-.6-.4zM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4a9.8 9.8 0 1 1 8.3 4.6zm8.4-18.2A11.8 11.8 0 0 0 1.8 17.8L.1 24l6.4-1.7a11.8 11.8 0 0 0 5.6 1.4A11.8 11.8 0 0 0 20.4 3.6z" /></svg>
        Chat
      </a>
    </CartProvider>
  )
}
