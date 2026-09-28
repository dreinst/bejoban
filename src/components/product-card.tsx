import Link from 'next/link'
import { rupiah } from '@/lib/format'
import type { CardProduct } from '@/lib/shop'
import { AddToCart } from './cart'

/* eslint-disable @next/next/no-img-element */
export function ProductCard({ p, branch, dark }: { p: CardProduct; branch?: string; dark?: boolean }) {
  return (
    <div className="group flex flex-col">
      <Link href={`/produk/${p.slug}`} className="relative block aspect-square overflow-hidden rounded-2xl bg-soft">
        {p.image && <img src={p.image} alt={p.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {p.isSample && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">Contoh</span>}
          {p.comparePrice > p.price && <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold text-ink ring-1 ring-ink">Hemat {Math.round((1 - p.price / p.comparePrice) * 100)}%</span>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <p className={`text-[11px] uppercase tracking-widest ${dark ? 'text-paper/60' : 'text-mute'}`}>{[p.brand, p.spec].filter(Boolean).join(' · ')}</p>
        <Link href={`/produk/${p.slug}`} className="mt-1 line-clamp-2 text-sm font-medium leading-snug hover:underline">{p.name}</Link>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="font-semibold">{rupiah(p.price)}</span>
          {p.comparePrice > p.price && <span className={`text-xs line-through ${dark ? 'text-paper/50' : 'text-mute'}`}>{rupiah(p.comparePrice)}</span>}
        </p>
        {branch && (
          <div className="mt-3">
            <AddToCart compact dark={dark} item={{ id: p.id, slug: p.slug, name: p.name, image: p.image, price: p.price, branch }} />
          </div>
        )}
      </div>
    </div>
  )
}
