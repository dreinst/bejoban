import { getBranches } from '@/lib/shop'
import { CartView } from './cart-view'

export const metadata = { title: 'Keranjang | Bejo Ban' }

export default async function Keranjang() {
  const branches = (await getBranches()).map((b) => ({ slug: b.slug, name: b.name, whatsapp: b.whatsapp }))
  return <CartView branches={branches} />
}
