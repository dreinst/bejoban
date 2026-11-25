import Link from 'next/link'
import { db } from '@/lib/db'
import { currentBranch, listProducts } from '@/lib/shop'
import { ProductCard } from '@/components/product-card'
import { getSitus } from '@/lib/situs-server'
import { Icon } from '@/components/icons'

export const metadata = { title: 'Produk | Bejo Ban' }

const tampilDiCabang = (branchId: number) => ({ active: true, listings: { some: { branchId, available: true } } })

export default async function Produk({ searchParams }: PageProps<'/produk'>) {
  const sp = await searchParams
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined)
  const f = { q: one('q'), category: one('kategori'), brand: one('merek'), fitment: one('mobil') }
  const sort = one('urut')
  const [{ branch }, { showPrices }] = await Promise.all([currentBranch(), getSitus()])
  const [products, categories, brands] = await Promise.all([
    listProducts(branch.id, f, { sort }),
    // Saringan hanya menawarkan jenis dan merek yang punya produk tampil di cabang ini, supaya pengunjung tidak berujung di daftar kosong.
    db.category.findMany({ where: { aktif: true, products: { some: tampilDiCabang(branch.id) } }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    db.brand.findMany({ where: { aktif: true, products: { some: tampilDiCabang(branch.id) } }, orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
  ])
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: f.q, kategori: f.category, merek: f.brand, mobil: f.fitment, urut: sort, ...patch }).filter(([, v]) => v) as [string, string][])
    return `/produk${p.size ? '?' + p : ''}`
  }
  const chip = (active: boolean) => `shrink-0 rounded-full border px-4 py-2 text-sm ${active ? 'border-accent bg-accent font-semibold text-ink' : 'border-line hover:border-ink'}`
  const title = [f.q && `"${f.q}"`, f.fitment && `untuk ${f.fitment}`].filter(Boolean).join(' ')

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 lg:px-20 lg:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-deep">{products.length} produk · {branch.name}</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold uppercase tracking-tight md:text-6xl">Produk {title}</h1>
      <span className="bilah-aksen mt-4" aria-hidden />
      <div className="mt-8 space-y-3 border-y border-line py-4">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <span className="w-16 shrink-0 text-xs uppercase tracking-widest text-mute">Jenis</span>
          <Link href={href({ kategori: undefined })} className={chip(!f.category)}>Semua</Link>
          {categories.map((k) => <Link key={k.id} href={href({ kategori: k.slug })} className={chip(f.category === k.slug)}>{k.name}</Link>)}
        </div>
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          <span className="w-16 shrink-0 text-xs uppercase tracking-widest text-mute">Merek</span>
          <Link href={href({ merek: undefined })} className={chip(!f.brand)}>Semua</Link>
          {brands.map((b) => <Link key={b.id} href={href({ merek: b.name })} className={chip(f.brand === b.name)}>{b.name}</Link>)}
        </div>
        {showPrices && (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <span className="w-16 shrink-0 text-xs uppercase tracking-widest text-mute">Urutkan</span>
            {[['', 'Terbaru'], ['murah', 'Termurah'], ['mahal', 'Termahal']].map(([v, l]) => (
              <Link key={v} href={href({ urut: v || undefined })} className={chip((sort ?? '') === v)}>{l}</Link>
            ))}
          </div>
        )}
      </div>
      {products.length ? (
        <div className="mt-10 grid grid-cols-2 gap-3.5 lg:grid-cols-3 lg:gap-7">
          {products.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="text-lg font-semibold text-ink">Belum ada produk yang cocok di {branch.name.replace(/\s*\(.*\)/, '')}.</p>
          <p className="mt-2 text-mute">Tanyakan langsung lewat WhatsApp, kami bantu carikan{f.q ? ` untuk "${f.q}"` : ''}.</p>
          <a href={`/wa/${branch.slug}${f.q ? `?p=${encodeURIComponent(f.q)}` : ''}`} target="_blank" rel="noopener" className="btn btn-k mt-6 h-[52px] w-full text-base">
            <Icon name="wa" size={20} c="#ffffff" d="#161616" />
            Tanya lewat WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
