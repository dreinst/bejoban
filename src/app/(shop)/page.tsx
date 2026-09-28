import Link from 'next/link'
import { ArrowRight, ArrowUpRight, MapPin, Clock, Phone } from 'lucide-react'
import { getContent } from '@/lib/settings'
import { currentBranch, listProducts } from '@/lib/shop'
import { db } from '@/lib/db'
import { waLink, rupiah, isFuture } from '@/lib/format'
import { ProductCard } from '@/components/product-card'
import { Countdown } from '@/components/countdown'

const pad = (n: number) => String(n + 1).padStart(2, '0')

function Heading({ eyebrow, title, link }: { eyebrow?: string; title: string; link?: [string, string] }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-mute">{eyebrow}</p>}
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      </div>
      {link && (
        <Link href={link[0]} className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
          {link[1]} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  )
}

/* eslint-disable @next/next/no-img-element */
export default async function Home() {
  const [c, { branches, branch }] = await Promise.all([getContent(), currentBranch()])
  const flashOn = isFuture(c.flash.endsAt)
  const [categories, brands, flash, newest, look] = await Promise.all([
    db.category.findMany({ orderBy: { sort: 'asc' }, include: { products: { where: { active: true, listings: { some: { branchId: branch.id } } }, select: { id: true } } } }),
    db.brand.findMany({ orderBy: { sort: 'asc' } }),
    flashOn ? listProducts(branch.id, { flash: true }, { take: 12 }) : Promise.resolve([]),
    listProducts(branch.id, {}, { take: 8 }),
    c.promo.products?.length ? listProducts(branch.id, { ids: c.promo.products }) : Promise.resolve([]),
  ])
  const wa = waLink(branch.whatsapp, `Halo ${branch.name}, saya mau booking servis.`)
  const side: string[] = c.hero.side ?? []
  const wrap = 'mx-auto max-w-7xl px-4 lg:px-8'

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink text-paper">
        {c.hero.background && <img src={c.hero.background} alt="" className="absolute inset-0 size-full object-cover opacity-30 grayscale" />}
        <div className={`${wrap} relative grid items-end gap-10 py-14 md:py-20 lg:grid-cols-[1.2fr_1fr]`}>
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-paper/25 px-3 py-1 text-xs uppercase tracking-[0.2em] text-paper/80">
              <span className="size-1.5 rounded-full bg-paper" /> {c.hero.eyebrow}
            </p>
            <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tight md:text-7xl">
              {c.hero.title}
              <span className="mt-2 block text-paper/45">{c.hero.highlight}</span>
            </h1>
            <p className="mt-8 max-w-lg text-base text-paper/75 md:text-lg">{c.hero.text}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href={c.hero.cta1Href || '/produk'} className="inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3.5 text-sm font-semibold text-ink hover:bg-paper/85">
                {c.hero.cta1} <ArrowRight className="size-4" />
              </Link>
              <a href={wa} target="_blank" className="inline-flex items-center gap-2 rounded-full border border-paper/40 px-6 py-3.5 text-sm font-semibold hover:bg-paper/10">
                {c.hero.cta2}
              </a>
            </div>
          </div>
          {side.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {side.map((src, i) => (
                <img key={src} src={src} alt="" className={`aspect-[9/16] w-full rounded-2xl object-cover ${i === 1 ? 'md:-tranneutral-y-8' : ''}`} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* KATEGORI */}
      <section className={`${wrap} pt-16`}>
        <div className="grid gap-3 sm:grid-cols-3">
          {categories.map((k) => (
            <Link key={k.id} href={`/produk?kategori=${k.slug}`} className="group flex items-center justify-between rounded-2xl border border-line p-5 transition hover:border-ink">
              <div>
                <p className="text-2xl font-bold">{k.name}</p>
                <p className="mt-1 text-sm text-mute">{k.products.length} produk</p>
              </div>
              <div className="flex items-center gap-3">
                {k.image && <img src={k.image} alt="" className="size-16 object-contain grayscale" />}
                <ArrowUpRight className="size-5 transition group-hover:-tranneutral-y-0.5 group-hover:tranneutral-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FLASH SALE */}
      {flash.length > 0 && (
        <section className="mt-16 bg-ink py-14 text-paper">
          <div className={wrap}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-paper/60">Terbatas</p>
                <h2 className="text-4xl font-black uppercase tracking-tight md:text-5xl">{c.flash.title}</h2>
                <p className="mt-2 text-paper/70">{c.flash.sub}</p>
              </div>
              <Countdown endsAt={c.flash.endsAt} />
            </div>
            <div className="no-scrollbar -mx-4 flex snap-x gap-5 overflow-x-auto px-4">
              {flash.map((p) => (
                <div key={p.id} className="w-[240px] shrink-0 snap-start">
                  <ProductCard p={p} branch={branch.slug} dark />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRODUK TERBARU */}
      <section className={`${wrap} pt-20`}>
        <Heading eyebrow={`Tersedia di ${branch.name}`} title={c.newest.title} link={['/produk', 'Lihat semua produk']} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {newest.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* LAYANAN */}
      <section className={`${wrap} pt-24`}>
        <div className="grid gap-10 lg:grid-cols-2">
          {c.panel.storeImage && <img src={c.panel.storeImage} alt={c.panel.storeTitle} className="aspect-[4/5] w-full rounded-3xl object-cover lg:aspect-auto lg:h-full" />}
          <div className="flex flex-col justify-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-mute">{c.panel.listTitle}</p>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">{c.panel.cardTitle}</h2>
            <p className="mt-4 text-lg text-mute">{c.panel.cardSub}</p>
            <ol className="mt-10 divide-y divide-line border-y border-line">
              {(c.panel.points as { text: string }[]).map((p, i) => (
                <li key={i} className="flex items-baseline gap-6 py-5">
                  <span className="font-mono text-sm text-mute">{pad(i)}</span>
                  <span className="text-lg font-medium">{p.text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm font-semibold">{c.panel.guarantee}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={wa} target="_blank" className="rounded-full bg-ink px-6 py-3.5 text-sm font-semibold text-paper">Booking servis</a>
              <a href={`https://www.instagram.com/${branch.instagram}/`} target="_blank" className="inline-flex items-center gap-1 rounded-full border border-ink px-6 py-3.5 text-sm font-semibold">
                Lihat hasil kerja <ArrowUpRight className="size-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CARA PESAN */}
      <section className={`${wrap} pt-24`}>
        <Heading eyebrow="Cara pesan" title={c.payment.title} />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-5">
          {(c.steps.items as { title: string; sub: string }[]).map((s, i) => (
            <div key={i} className="bg-paper p-6">
              <p className="font-mono text-4xl font-semibold text-line">{pad(i)}</p>
              <p className="mt-6 font-semibold">{s.title}</p>
              <p className="text-sm text-mute">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm text-mute">
          <p>{c.payment.sub}</p>
          {(c.payment.logos as string[]).map((l) => <img key={l} src={l} alt="" className="h-6 w-auto grayscale" />)}
        </div>
      </section>

      {/* PROMO */}
      <section className={`${wrap} pt-24`}>
        <div className="grid overflow-hidden rounded-3xl bg-soft lg:grid-cols-2">
          {c.promo.image ? (
            <img src={c.promo.image} alt={c.promo.title} className="h-full min-h-64 w-full object-cover" />
          ) : (
            <div className="grid grid-cols-3 gap-2 p-4">
              {(c.promo.thumbs as string[]).map((t) => <img key={t} src={t} alt="" className="aspect-[9/16] w-full rounded-xl object-cover" />)}
            </div>
          )}
          <div className="flex flex-col justify-center p-6 md:p-10">
            <h2 className="text-3xl font-black uppercase leading-none tracking-tight md:text-4xl">{c.promo.title}</h2>
            <p className="mt-3 text-mute">{c.promo.sub}</p>
            {look.length > 0 && (
              <div className="mt-8">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-mute">{c.promo.lookTitle}</p>
                <ul className="divide-y divide-line border-y border-line">
                  {look.map((p) => (
                    <li key={p.id}>
                      <Link href={`/produk/${p.slug}`} className="flex items-center gap-4 py-3 hover:bg-paper/60">
                        <img src={p.image} alt="" className="size-14 rounded-lg object-cover" />
                        <span className="flex-1 text-sm font-medium">{p.name}</span>
                        <span className="text-sm font-semibold">{rupiah(p.price)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {c.promo.link && (
              <a href={c.promo.link} target="_blank" className="mt-8 inline-flex w-fit items-center gap-1 text-sm font-semibold underline underline-offset-4">
                {c.promo.button} <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* REKOMENDASI MOBIL */}
      {c.cars.items.length > 0 && (
        <section className={`${wrap} pt-24`}>
          <Heading eyebrow={c.cars.title} title={c.cars.sub} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(c.cars.items as { title: string; sub: string; query: string; image: string }[]).map((car, i) => (
              <Link key={i} href={`/produk?mobil=${encodeURIComponent(car.query)}`} className="group">
                {car.image && (
                  <div className="overflow-hidden rounded-2xl">
                    <img src={car.image} alt={car.title} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                  </div>
                )}
                <p className="mt-3 flex items-center justify-between font-semibold">
                  {car.title} <ArrowRight className="size-4 transition group-hover:tranneutral-x-1" />
                </p>
                <p className="text-sm text-mute">{car.sub}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* LOKASI */}
      <section className={`${wrap} pt-24`}>
        <Heading eyebrow={c.locations.eyebrow} title={c.locations.title} />
        <div className="grid gap-6 md:grid-cols-2">
          {branches.map((b) => (
            <article key={b.id} className="overflow-hidden rounded-3xl border border-line">
              {b.photo && <img src={b.photo} alt={b.name} className="aspect-[12/7] w-full object-cover" />}
              <div className="p-6">
                <h3 className="text-xl font-bold">{b.name}</h3>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex gap-3"><dt><MapPin className="size-4" /></dt><dd>{b.address || 'Alamat lengkap bisa ditanyakan lewat WhatsApp.'}</dd></div>
                  <div className="flex gap-3"><dt><Clock className="size-4" /></dt><dd>Buka {b.hours}</dd></div>
                  <div className="flex gap-3"><dt><Phone className="size-4" /></dt><dd>WA {b.whatsapp}</dd></div>
                </dl>
                <p className="mt-4 text-xs uppercase tracking-widest text-mute">{b.services}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <a href={waLink(b.whatsapp)} target="_blank" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper">Chat WhatsApp</a>
                  {b.mapsUrl && <a href={b.mapsUrl} target="_blank" className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold">Petunjuk arah</a>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* MEREK */}
      {brands.length > 0 && (
        <section className={`${wrap} pt-24`}>
          <p className="mb-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-mute">
            {c.brands.sub} {c.brands.highlight}
          </p>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {brands.map((b) => (
              <Link key={b.id} href={`/produk?merek=${encodeURIComponent(b.name)}`} className="grid h-24 place-items-center bg-paper p-4 hover:bg-soft">
                {b.logo ? <img src={b.logo} alt={b.name} className="max-h-10 grayscale" /> : <span className="text-lg font-bold tracking-tight">{b.name}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
