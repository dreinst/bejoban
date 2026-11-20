import Link from 'next/link'
import type { ReactNode } from 'react'
import { getContent } from '@/lib/settings'
import { currentBranch, listProducts } from '@/lib/shop'
import { db } from '@/lib/db'
import { Icon, IconChip, ICON_NAMES, type IconName } from '@/components/icons'
import { ProductCard } from '@/components/product-card'
import { branchLabel } from '@/lib/situs'

/* eslint-disable @next/next/no-img-element */

const asIcon = (v: unknown, fallback: IconName): IconName => (ICON_NAMES.includes(v as IconName) ? (v as IconName) : fallback)
const TRUST_ICONS: IconName[] = ['shield', 'balancing', 'nitrogen', 'pin', 'clock']

// Judul bagian: judul Rubik, keterangan, lalu garis pendek di bawahnya.
function Head({ title, sub, dark, eyebrow, caps }: { title: string; sub?: string; dark?: boolean; eyebrow?: string; caps?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center lg:gap-3.5">
      {eyebrow && (
        <span className={`tag px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${dark ? 'border border-[#3a3a3a] text-white' : 'border border-[#cfcfcf] text-ink'}`}>{eyebrow}</span>
      )}
      <h2 className={`font-display text-[30px] font-extrabold leading-[36px] tracking-[-0.5px] lg:text-5xl lg:leading-[54px] ${caps ? 'uppercase' : ''} ${dark ? 'text-white' : 'text-ink'}`}>{title}</h2>
      {sub && <p className={`max-w-[330px] text-[15px] leading-[22px] lg:max-w-[640px] lg:text-lg lg:leading-7 ${dark ? 'text-mute-dark' : 'text-mute'}`}>{sub}</p>}
      <span className={`mt-0.5 h-[3px] w-12 rounded-sm ${dark ? 'bg-white' : 'bg-ink'}`} aria-hidden />
    </div>
  )
}

function Section({ id, bg, children }: { id?: string; bg: string; children: ReactNode }) {
  return (
    <section id={id} className={bg}>
      <div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-20 lg:py-[104px]">{children}</div>
    </section>
  )
}

export default async function Home() {
  const [c, { branch }] = await Promise.all([getContent(), currentBranch()])
  const [branches, brandRows] = await Promise.all([
    db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }] }),
    db.brand.findMany({ where: { aktif: true }, orderBy: [{ sort: 'asc' }, { name: 'asc' }], select: { id: true, name: true, logo: true, byOrder: true } }),
  ])
  const ids: number[] = c.newest.products ?? []
  const products = ids.length ? await listProducts(branch.id, { ids }, {}) : await listProducts(branch.id, {}, { take: 6 })
  const ordered = ids.length ? ids.map((id) => products.find((p) => p.id === id)).filter((p): p is (typeof products)[number] => !!p) : products
  const wa = `/wa/${branch.slug}`
  const trust = c.trust.items as { title: string; sub: string; icon?: string }[]
  const services = c.services.items as { title: string; icon?: string; sub: string }[]
  const steps = c.steps.items as { title: string; sub: string }[]
  const cars = (c.cars.items as { title: string; sub: string; query: string; tone?: string; image: string }[]) ?? []
  const gallery: string[] = (c.gallery.images ?? []).slice(0, 4)
  const cta2 = String(c.hero.cta2)

  return (
    <>
      {/* HERO */}
      <section className="overflow-hidden bg-ink text-white">
        <div className="mx-auto grid max-w-[1440px] px-5 lg:min-h-[604px] lg:grid-cols-[1fr_660px] lg:px-20">
          <div className="flex flex-col items-start pb-8 pt-6 lg:justify-start lg:pb-12 lg:pt-[54px]">
            <span className="tag border border-[#3a3a3a] px-[11px] py-[7px] text-xs text-white lg:px-3.5 lg:py-[9px] lg:text-[13px]">
              <Icon name="shield" size={16} c="#ffffff" d="#1a1a1a" />
              {c.hero.eyebrow}
            </span>
            <h1 className="mt-5 font-display text-[38px] font-extrabold leading-[44px] tracking-[-1px] lg:mt-6 lg:text-[76px] lg:leading-[80px] lg:tracking-[-1.5px]">{c.hero.title}</h1>
            <p className="mt-2 max-w-[250px] font-display text-2xl font-bold leading-7 text-mute-dark lg:mt-3 lg:max-w-[480px] lg:text-5xl lg:leading-[54px] lg:tracking-[-0.5px]">{c.hero.highlight}</p>
            <p className="mt-5 max-w-[520px] text-[15px] leading-[22px] text-soft-dark lg:mt-7 lg:text-lg lg:leading-7">{c.hero.text}</p>
            <div className="mt-7 grid w-full max-w-[360px] grid-cols-[1fr_1.06fr] gap-3 lg:mt-10 lg:flex lg:max-w-none lg:gap-4">
              <Link href={c.hero.cta1Href || '/produk'} className="btn btn-w h-[50px] text-sm lg:h-[60px] lg:w-[220px] lg:text-[17px]">
                {c.hero.cta1}
                <span className="hidden lg:inline"><Icon name="arrow" size={20} c="#0a0a0a" d="#ffffff" /></span>
              </Link>
              <a href={wa} target="_blank" rel="noopener" className="btn btn-k h-[50px] text-sm lg:h-[60px] lg:w-[272px] lg:text-[17px]">
                <Icon name="wa" size={18} c="#ffffff" d="#161616" />
                <span className="lg:hidden">{cta2.replace(/via WhatsApp/i, 'WA')}</span>
                <span className="hidden lg:inline">{cta2}</span>
              </a>
            </div>
          </div>
          <div className="relative -mx-5 pb-[68px] pt-2 lg:mx-0 lg:-mr-20 lg:pb-[126px] lg:pt-4">
            <div className="absolute inset-x-0 bottom-[90px] h-px bg-[#2f2f2f] lg:bottom-40" aria-hidden />
            <div className="relative mx-auto w-[330px] lg:ml-[120px] lg:w-[580px]" style={{ aspectRatio: '1600 / 1274' }}>
              <span className="absolute left-1/2 top-1/2 aspect-square w-[102%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#262626]" aria-hidden />
              <span className="absolute left-1/2 top-1/2 aspect-square w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#1d1d1d]" aria-hidden />
              <span className="absolute inset-x-0 -bottom-1 h-[30px] rounded-[50%] bg-[radial-gradient(rgba(0,0,0,.8),rgba(0,0,0,0)_70%)] lg:h-11" aria-hidden />
              {c.hero.image && <img src={c.hero.image} alt="Mobil di Bejo Ban" className="absolute inset-0 size-full object-contain" />}
            </div>
          </div>
        </div>
      </section>

      {/* BAR KEUNGGULAN */}
      <section className="border-t border-line-dark bg-white">
        <ul className="mx-auto grid max-w-[1440px] px-5 py-2.5 lg:grid-cols-5 lg:items-center lg:px-20 lg:py-0">
          {trust.map((t, i) => (
            <li key={i} className={`flex items-center gap-3.5 py-3.5 lg:h-[120px] lg:px-3.5 lg:py-0 ${i ? 'border-t border-line lg:border-l lg:border-t-0' : ''}`}>
              <IconChip name={asIcon(t.icon, TRUST_ICONS[i] ?? 'shield')} size={28} box={46} className="lg:!size-[54px] [&_svg]:lg:size-[34px]" />
              <div>
                <p className="font-display text-base font-extrabold leading-5 text-ink lg:text-[17px] lg:leading-[22px]">{t.title}</p>
                <p className="text-[13px] leading-[18px] text-mute">{t.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* LAYANAN */}
      <Section id="layanan" bg="bg-soft">
        <Head title={c.services.title} sub={c.services.sub} />
        <ol className="mt-8 grid gap-3 lg:mt-14 lg:grid-cols-3 lg:gap-7">
          {services.map((s, i) => (
            <li key={i} className="card-l relative flex gap-4 p-5 lg:min-h-[164px] lg:gap-5 lg:p-7">
              <IconChip name={asIcon(s.icon, 'tire')} size={36} box={58} className="lg:!size-[72px] [&_svg]:lg:size-[46px]" />
              <div className="min-w-0 pr-9 lg:pr-10">
                <h3 className="font-display text-[21px] font-extrabold leading-[27px] text-ink lg:text-2xl lg:leading-[30px]">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-mute lg:text-[15px] lg:leading-[22px]">{s.sub}</p>
              </div>
              <span className="absolute right-[18px] top-4 font-display text-[13px] font-extrabold tracking-[1px] text-[#c4c4c4] lg:right-6 lg:top-[22px] lg:text-sm">{String(i + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* PRODUK */}
      <Section id="produk" bg="bg-ink">
        <Head title={c.newest.title} sub={c.newest.sub} dark />
        <div className="mt-8 grid grid-cols-2 gap-3.5 lg:mt-14 lg:grid-cols-3 lg:gap-7">
          {ordered.map((p) => <ProductCard key={p.id} p={p} button={c.newest.button} />)}
        </div>
        {!ordered.length && <p className="mt-10 text-center text-mute-dark">Produk belum ditambahkan.</p>}
      </Section>

      {/* ALUR */}
      <Section id="cara-pesan" bg="bg-white">
        <Head title={c.steps.title} sub={c.steps.sub} />
        <ol className="mx-auto mt-10 max-w-[360px] lg:mt-[72px] lg:grid lg:max-w-none lg:grid-cols-5">
          {steps.map((s, i) => (
            <li key={i} className="relative flex items-start gap-5 pb-5 last:pb-0 lg:flex-col lg:items-center lg:gap-6 lg:pb-0">
              <span className="chip-k size-[72px] shrink-0 !rounded-full font-display text-[26px] font-black text-white lg:text-[28px]">{i + 1}</span>
              {i < steps.length - 1 && (
                <>
                  <span className="absolute left-[35px] top-[72px] h-5 w-0.5 bg-[#d4d4d4] lg:hidden" aria-hidden />
                  <span className="absolute left-[calc(50%+48px)] top-9 hidden h-0.5 w-[calc(100%-96px)] bg-[#d4d4d4] lg:block" aria-hidden />
                </>
              )}
              <div className="pt-3 lg:pt-0 lg:text-center">
                <p className="font-display text-xl font-extrabold leading-6 text-ink lg:text-[21px] lg:leading-[26px]">{s.title}</p>
                <p className="mt-0.5 text-sm leading-5 text-mute lg:mt-1 lg:text-[15px] lg:leading-[22px]">{s.sub}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* REKOMENDASI MOBIL */}
      {cars.length > 0 && (
        <Section bg="bg-soft">
          <Head title={c.cars.title} sub={c.cars.sub} caps />
          <ul className="mt-8 grid grid-cols-2 gap-3.5 lg:mt-14 lg:grid-cols-5 lg:gap-5">
            {cars.map((car, i) => (
              <li key={i} className={i === cars.length - 1 && cars.length % 2 ? 'col-span-2 lg:col-span-1' : ''}>
                <Link href={`/produk?mobil=${encodeURIComponent(car.query || '')}`} className="card-l flex h-full flex-col p-2 lg:min-h-[372px] lg:p-3">
                  <div className={`slot h-[130px] lg:h-[190px] ${car.tone === 'gelap' ? 'slot-dk' : ''} ${i === cars.length - 1 && cars.length % 2 ? 'h-[230px] lg:h-[190px]' : ''}`}>
                    {car.image && <img src={car.image} alt={car.title} loading="lazy" className="absolute inset-x-0 bottom-1.5 mx-auto h-[96%] w-full object-contain object-bottom lg:bottom-2" />}
                  </div>
                  <div className="flex flex-1 flex-col p-1.5 pt-4 lg:p-1.5 lg:pt-6">
                    <h3 className="font-display text-[15px] font-extrabold leading-5 text-ink lg:text-[19px] lg:leading-6">{car.title}</h3>
                    <p className="mt-1 text-xs leading-4 text-mute lg:text-sm lg:leading-5">{car.sub}</p>
                    <span className="btn btn-k mt-auto h-[34px] w-9 self-end lg:h-10 lg:w-[42px]" aria-hidden>
                      <Icon name="arrow" size={18} c="#ffffff" d="#161616" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* MEREK */}
      <section className="bg-graphite">
        <div className="mx-auto max-w-[1440px] px-5 py-14 lg:px-20 lg:py-24">
          <Head title={c.brands.title} sub={c.brands.sub} dark />
          {/* Logo merek dari tabel Brand (menu Merek), urut sort, satu warna putih lewat filter CSS.
              Merek tanpa logo memakai namanya sebagai teks. Desktop 6 per baris, mobile 3, baris terakhir rata tengah. */}
          <ul className="mx-auto mt-8 flex max-w-[1180px] flex-wrap justify-center gap-x-4 gap-y-8 border-y border-[#2a2a2a] py-8 lg:mt-12 lg:gap-x-10 lg:gap-y-12 lg:py-12">
            {brandRows.map((b) => (
              <li key={b.id} className="flex w-[calc((100%-2rem)/3)] flex-col items-center justify-start gap-2 text-center lg:w-[calc((100%-12.5rem)/6)]">
                <div className="flex h-10 w-full items-center justify-center lg:h-14">
                  {b.logo ? (
                    <img src={b.logo} alt={b.name} loading="lazy" className="h-full w-auto max-w-full object-contain [filter:brightness(0)_invert(1)]" />
                  ) : (
                    <span className="font-display text-[15px] font-extrabold uppercase leading-tight tracking-[1px] text-white [overflow-wrap:anywhere] lg:text-[22px] lg:tracking-[2px]">{b.name}</span>
                  )}
                </div>
                {b.byOrder && <span className="rounded border border-[#3a3a3a] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-mute-dark lg:text-[11px]">by order</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* GALERI */}
      {gallery.length > 0 && (
        <Section id="galeri" bg="bg-white">
          <Head title={c.gallery.title} sub={c.gallery.sub} />
          <ul className="mt-8 grid grid-cols-2 gap-3.5 lg:mt-14 lg:grid-cols-4 lg:gap-5">
            {gallery.map((g, i) => (
              <li key={i} className="card-l p-2 lg:p-2.5">
                <div className="slot slot-dk aspect-[4/5]">
                  <img src={g} alt={`Pekerjaan bengkel ${i + 1}`} loading="lazy" className="size-full object-cover" />
                  <span className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_4px_10px_rgba(0,0,0,.4)]" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
          {(c.gallery.images ?? []).length > 4 && (
            <div className="mt-8 text-center"><Link href="/galeri" className="btn btn-k h-12 px-6 text-sm">Lihat semua foto</Link></div>
          )}
        </Section>
      )}

      {/* LOKASI */}
      <Section id="cabang" bg="bg-ink">
        <Head title={c.locations.title} dark eyebrow={c.locations.eyebrow} />
        <div className="mt-8 grid gap-4 lg:mt-14 lg:grid-cols-2 lg:gap-7">
          {branches.map((b) => {
            const sub = /\((.*)\)/.exec(b.name)?.[1]
            const label = branchLabel(b.name)
            const rows: [IconName, string][] = [
              ['pin', b.address || 'Alamat lengkap bisa ditanyakan lewat WhatsApp.'],
              ['clock', /^\d/.test(b.hours) ? `Pukul ${b.hours}` : b.hours],
              ...(b.instagram ? ([['ig', `@${b.instagram}`]] as [IconName, string][]) : []),
            ]
            return (
              <article key={b.id} className="card-d flex flex-col p-2.5 lg:p-3.5">
                <div className="slot slot-dk aspect-[598/210] max-h-[210px] w-full">
                  {b.photo && <img src={b.photo} alt={`Tampak ${label}`} loading="lazy" className="size-full object-cover" />}
                  <span className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_5px_12px_rgba(0,0,0,.5)]" aria-hidden />
                </div>
                <div className="flex flex-1 flex-col px-2.5 pb-2.5 pt-5 lg:px-[18px] lg:pb-4 lg:pt-6">
                  <h3 className="font-display text-[22px] font-extrabold leading-8 text-white lg:text-[28px]">{label}</h3>
                  {sub && <span className="tag mt-2.5 self-start border border-[#3a3a3a] px-[9px] py-1 text-xs text-white">{sub}</span>}
                  <ul className="mt-3 space-y-2.5 text-sm font-medium leading-5 text-soft-dark lg:space-y-3 lg:text-base lg:leading-[22px]">
                    {rows.map(([ico, text], i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-px flex-none"><Icon name={ico} size={20} c="#ffffff" d="#1a1a1a" /></span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                  {b.mapsUrl && <a href={b.mapsUrl} target="_blank" rel="noopener" className="mt-3 self-start text-sm text-soft-dark underline underline-offset-4 hover:text-white">Petunjuk arah</a>}
                  <div className="mt-auto pt-6 lg:pt-8">
                    <a href={`/wa/${b.slug}`} target="_blank" rel="noopener" className="btn btn-w h-[52px] w-full text-base lg:h-14">
                      <Icon name="wa" size={20} c="#0a0a0a" d="#ffffff" />
                      Chat {label}
                    </a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </Section>
    </>
  )
}
