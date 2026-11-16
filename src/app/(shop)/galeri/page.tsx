import { getContent } from '@/lib/settings'
import { getBranches } from '@/lib/shop'

export const metadata = { title: 'Galeri | Bejo Ban' }

/* eslint-disable @next/next/no-img-element */
export default async function Galeri() {
  const [{ gallery }, branches] = await Promise.all([getContent(), getBranches()])
  return (
    <div className="mx-auto max-w-[1440px] px-5 py-12 lg:px-20">
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight md:text-6xl">{gallery.title}</h1>
      <p className="mt-2 text-mute">{gallery.sub}</p>
      <div className="mt-6 flex gap-2">
        {branches.map((b) => (
          <a key={b.id} href={`https://www.instagram.com/${b.instagram}/`} target="_blank" className="rounded-full border border-ink px-4 py-2 text-xs font-semibold hover:bg-ink hover:text-paper">
            @{b.instagram}
          </a>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(gallery.images as string[]).map((src) => (
          <img key={src} src={src} alt="" loading="lazy" className="aspect-[9/16] w-full rounded-xl object-cover" />
        ))}
      </div>
    </div>
  )
}
