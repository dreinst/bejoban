import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export default async function Dashboard() {
  const s = await requireUser()
  const branchFilter = s.role === 'OWNER' ? {} : { branchId: s.branchId! }
  const [products, samples, listings, noPhoto, zeroStock] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isSample: true } }),
    db.listing.count({ where: { ...branchFilter, available: true } }),
    db.product.count({ where: { images: '[]' } }),
    db.listing.count({ where: { ...branchFilter, available: true, stock: 0 } }),
  ])
  const card = (label: string, n: number, href: string, warn = false) => (
    <Link href={href} className={`rounded-xl bg-white p-5 shadow-sm ${warn && n ? 'ring-2 ring-ink' : ''}`}>
      <p className="text-3xl font-black text-ink">{n}</p>
      <p className="text-sm">{label}</p>
    </Link>
  )
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Ringkasan</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {card('Produk', products, '/admin/produk')}
        {card('Dijual di cabang', listings, '/admin/harga')}
        {card('Produk contoh (hapus/ganti)', samples, '/admin/produk?contoh=1', true)}
        {card('Produk tanpa foto', noPhoto, '/admin/produk', true)}
        {card('Stok 0', zeroStock, '/admin/harga', true)}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Link href="/admin/produk/baru" className="rounded-xl bg-ink p-5 font-bold text-paper">+ Tambah produk</Link>
        <Link href="/admin/harga" className="rounded-xl bg-white p-5 font-bold text-ink shadow-sm">Update harga & stok cepat</Link>
        <Link href="/admin/panduan-foto" className="rounded-xl bg-white p-5 font-bold text-ink shadow-sm">Panduan ukuran foto</Link>
      </div>
    </div>
  )
}
