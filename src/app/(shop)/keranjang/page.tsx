import { getBranches } from '@/lib/shop'
import { getSitus } from '@/lib/situs-server'
import { CartView } from './cart-view'

export const metadata = { title: 'Keranjang | Bejo Ban' }

export default async function Keranjang() {
  const [branches, situs] = await Promise.all([getBranches(), getSitus()])
  const list = branches.map((b) => ({
    slug: b.slug,
    name: b.name,
  }))
  return <CartView branches={list} showPrices={situs.showPrices} />
}
