import Link from 'next/link'
import { Search, ShoppingBag } from 'lucide-react'
import { getContent } from '@/lib/settings'
import { currentBranch } from '@/lib/shop'
import { CartProvider, CartCount } from '@/components/cart'
import { BranchPicker } from '@/components/branch-picker'
import { Icon } from '@/components/icons'
import { Logo } from '@/components/logo'

export const MENU: [string, string][] = [
  ['Layanan', '/#layanan'],
  ['Produk', '/#produk'],
  ['Cara Pesan', '/#cara-pesan'],
  ['Cabang', '/#cabang'],
  ['Galeri', '/#galeri'],
]

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const [c, { branches, branch }] = await Promise.all([getContent(), currentBranch()])
  const wa = `/wa/${branch.slug}`

  return (
    <CartProvider>
      <header className="sticky top-0 z-40 bg-ink text-white">
        <div className="mx-auto max-w-[1440px] px-5 lg:px-20">
          <div className="flex h-16 items-center gap-4 border-b border-line-dark lg:h-24 lg:gap-8">
            <Link href="/" aria-label={`${c.site.name}, ke beranda`} className="shrink-0">
              <Logo src={c.site.logo} className="h-[30px] w-auto lg:h-11" />
            </Link>
            <nav aria-label="Menu utama" className="hidden flex-1 items-center justify-center gap-9 text-base font-medium text-soft-dark lg:flex">
              {MENU.map(([label, href]) => <Link key={href} href={href} className="whitespace-nowrap hover:text-white">{label}</Link>)}
            </nav>
            <div className="ml-auto flex items-center gap-2.5 lg:ml-0 lg:gap-5">
              <Link href="/produk" aria-label="Cari produk" className="hidden text-soft-dark hover:text-white sm:block"><Search className="size-5" /></Link>
              <BranchPicker branches={branches} current={branch.slug} />
              <Link href="/keranjang" aria-label="Keranjang" className="relative text-soft-dark hover:text-white">
                <ShoppingBag className="size-5" />
                <CartCount />
              </Link>
              <a href={wa} target="_blank" rel="noopener" aria-label="Booking via WhatsApp" className="btn btn-w h-[38px] w-12 shrink-0 lg:h-[52px] lg:w-auto lg:px-6 lg:text-base">
                <Icon name="wa" size={20} c="#0a0a0a" d="#ffffff" />
                <span className="hidden lg:inline">Booking via WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-line-dark bg-ink text-white">
        <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-9 lg:px-20 lg:pb-9 lg:pt-14">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[460px]">
              <Logo src={c.site.logo} className="h-[34px] w-auto lg:h-11" />
              <p className="mt-4 text-sm leading-[1.5] text-mute-dark lg:mt-6 lg:text-[15px] lg:leading-6">{c.footer.about}</p>
            </div>
            <nav aria-label="Menu footer" className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm font-medium text-soft-dark lg:gap-x-9 lg:pt-2 lg:text-base">
              {MENU.map(([label, href]) => <Link key={href} href={href} className="hover:text-white">{label}</Link>)}
              <Link href="/kalkulator-ban" className="hover:text-white">Kalkulator Ban</Link>
            </nav>
          </div>
          <div className="mt-6 h-px bg-line-dark lg:mt-10" />
          <p className="mt-4 text-[13px] text-mute-dark lg:text-sm">© {new Date().getFullYear()} {c.footer.copyright}</p>
        </div>
      </footer>

      <a href={wa} target="_blank" rel="noopener" aria-label="Chat WhatsApp" className="btn btn-w fixed bottom-5 right-5 z-40 h-12 gap-2 px-4 text-sm">
        <Icon name="wa" size={20} c="#0a0a0a" d="#ffffff" />
        Chat
      </a>
    </CartProvider>
  )
}
