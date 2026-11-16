import Link from 'next/link'
import { rupiah } from '@/lib/format'
import { currentBranch, type CardProduct } from '@/lib/shop'
import { getSitus } from '@/lib/situs-server'
import { Icon } from './icons'

/* eslint-disable @next/next/no-img-element */
// Kartu produk desain hitam putih. Harga tidak tampil kecuali pengaturan "Tampilkan harga di situs" dinyalakan.
export async function ProductCard({ p, button = 'Tanya harga via WhatsApp' }: { p: CardProduct; button?: string }) {
  const [{ showPrices }, { branch }] = await Promise.all([getSitus(), currentBranch()])
  return (
    <div className="card-l flex h-full flex-col p-2.5 sm:p-5">
      <Link href={`/produk/${p.slug}`} className="slot block h-[130px] sm:h-[220px]" aria-label={`Lihat ${p.name}`}>
        {p.image && <img src={p.image} alt={p.name} loading="lazy" className="absolute inset-x-0 top-0 mx-auto h-full w-auto max-w-full object-contain p-1.5 sm:p-2.5" />}
        {p.isSample && <span className="tag absolute left-2 top-2 bg-ink px-2 py-0.5 text-[10px] uppercase text-white">Contoh</span>}
      </Link>
      <div className="mt-4 flex flex-1 flex-col sm:mt-6">
        <Link href={`/produk/${p.slug}`} className="line-clamp-2 min-h-[34px] text-[13px] font-bold leading-[17px] text-ink hover:underline sm:min-h-[44px] sm:text-[17px] sm:leading-[22px]">{p.name}</Link>
        {p.spec && <span className="tag mt-1.5 self-start rounded-md bg-ink px-[7px] py-[3px] text-[11px] text-white sm:mt-2.5 sm:px-2.5 sm:py-[5px] sm:text-[13px]">{p.spec}</span>}
        {showPrices && <p className="mt-2 text-sm font-bold text-ink">{rupiah(p.price)}</p>}
        <a
          href={`/wa/${branch.slug}?p=${encodeURIComponent(p.name)}`}
          target="_blank"
          rel="noopener"
          className="btn btn-k mt-auto h-11 w-full whitespace-nowrap px-1 text-[11px] tracking-tight sm:mt-4 sm:tracking-normal sm:h-[52px] sm:px-3 sm:text-[15px]"
        >
          <span className="hidden sm:inline"><Icon name="wa" size={18} c="#ffffff" d="#161616" /></span>
          {button}
        </a>
      </div>
    </div>
  )
}
