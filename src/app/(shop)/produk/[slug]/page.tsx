import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { currentBranch } from '@/lib/shop'
import { parseImages, rupiah } from '@/lib/format'
import { getSitus } from '@/lib/situs-server'
import { QtyAdd } from '@/components/qty-add'
import { ProductGallery } from '@/components/product-gallery'

export async function generateMetadata({ params }: PageProps<'/produk/[slug]'>) {
  const p = await db.product.findUnique({ where: { slug: (await params).slug } })
  return { title: p ? `${p.name} | Bejo Ban` : 'Produk | Bejo Ban' }
}

export default async function ProductPage({ params }: PageProps<'/produk/[slug]'>) {
  const { slug } = await params
  const [{ branch }, situs] = await Promise.all([currentBranch(), getSitus()])
  const p = await db.product.findUnique({ where: { slug }, include: { brand: true, category: true, listings: { include: { branch: true } } } })
  if (!p || !p.active) notFound()
  const images = parseImages(p.images)
  const here = p.listings.find((l) => l.branchId === branch.id && l.available)
  const others = p.listings.filter((l) => l.branchId !== branch.id && l.available)

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <nav className="mb-6 text-xs uppercase tracking-widest text-mute">
        <Link href="/">Beranda</Link> / <Link href="/produk">Produk</Link>
        {p.category && <> / <Link href={`/produk?kategori=${p.category.slug}`}>{p.category.name}</Link></>}
      </nav>
      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery images={images} name={p.name} />
        <div>
          {p.isSample && <span className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-paper">Produk contoh</span>}
          {p.brand && <p className="text-sm font-semibold uppercase text-mute">{p.brand.name}</p>}
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink md:text-5xl">{p.name}</h1>
          {p.spec && <p className="mt-2 text-sm">Ukuran: <b className="text-ink">{p.spec}</b></p>}
          {p.fitment && <p className="mt-1 text-sm">Cocok untuk: <b className="text-ink">{p.fitment}</b></p>}
          <div className="my-8 border-y border-line py-6">
            <p className="text-xs text-mute">{situs.showPrices ? `Harga di ${branch.name}` : `Di ${branch.name}`}</p>
            {here ? (
              <>
                {situs.showPrices ? (
                  <>
                    {here.comparePrice > here.price && <p className="text-sm text-mute line-through">{rupiah(here.comparePrice)}</p>}
                    <p className="text-4xl font-bold text-ink">{rupiah(here.price)}</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-ink">Tanya harga lewat WhatsApp</p>
                )}
                <p className="mt-1 text-xs">{here.stock > 0 ? `Stok ${here.stock}` : 'Stok ditanyakan lewat WhatsApp'}</p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-ink">Belum tersedia di cabang ini.</p>
            )}
          </div>
          {here && <QtyAdd item={{ id: p.id, slug: p.slug, name: p.name, image: images[0] ?? '', price: situs.showPrices ? here.price : 0, branch: branch.slug }} />}
          <a
            href={`/wa/${branch.slug}?p=${encodeURIComponent(p.name)}`}
            target="_blank"
            className="mt-3 block rounded-full border border-ink py-3 text-center text-sm font-semibold"
          >
            {situs.showPrices ? 'Tanya via WhatsApp' : 'Tanya harga via WhatsApp'}
          </a>
          {others.length > 0 && (
            <div className="mt-6 text-sm">
              <p className="mb-2 font-semibold text-ink">Tersedia juga di:</p>
              {others.map((l) => (
                <p key={l.id}>{l.branch.name}{situs.showPrices && <>: <b className="text-ink">{rupiah(l.price)}</b></>}</p>
              ))}
              <p className="mt-1 text-xs text-mute">Ganti cabang lewat pilihan Cabang di atas.</p>
            </div>
          )}
          {p.description && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed">{p.description}</p>}
        </div>
      </div>
    </div>
  )
}
