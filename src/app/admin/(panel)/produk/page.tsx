import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { parseImages, rupiah } from '@/lib/format'

/* eslint-disable @next/next/no-img-element */
export default async function Produk({ searchParams }: PageProps<'/admin/produk'>) {
  await requireUser()
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const products = await db.product.findMany({
    where: { ...(q && { name: { contains: q } }), ...(sp.contoh && { isSample: true }) },
    include: { brand: true, category: true, listings: { include: { branch: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink">Produk ({products.length})</h1>
        <div className="flex gap-2">
          <form><input name="q" defaultValue={q} placeholder="Cari nama…" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm" /></form>
          <Link href="/admin/produk/baru" className="adm-btn">+ Tambah</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr><th className="p-3">Produk</th><th className="p-3">Kategori</th><th className="p-3">Harga per cabang</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="p-3">
                  <Link href={`/admin/produk/${p.id}`} className="flex items-center gap-3">
                    {parseImages(p.images)[0] ? <img src={parseImages(p.images)[0]} alt="" className="size-12 rounded object-cover" /> : <span className="grid size-12 place-items-center rounded bg-neutral-200 text-[10px] text-neutral-700">tanpa foto</span>}
                    <span>
                      <span className="block font-semibold text-ink">{p.name}</span>
                      <span className="text-xs text-neutral-500">{p.brand?.name} {p.spec}</span>
                    </span>
                  </Link>
                </td>
                <td className="p-3">{p.category?.name ?? '(tanpa kategori)'}</td>
                <td className="p-3 text-xs">
                  {p.listings.length ? p.listings.map((l) => (
                    <p key={l.id}>{l.branch.name.replace(/ \(.*\)/, '')}: <b>{rupiah(l.price)}</b> · stok {l.stock}{!l.available && ' (tidak dijual)'}</p>
                  )) : 'Belum dijual'}
                </td>
                <td className="p-3 text-xs">
                  {p.isSample && <span className="mr-1 rounded bg-ink px-1.5 py-0.5 font-bold text-paper">CONTOH</span>}
                  {!p.active && <span className="rounded bg-neutral-200 px-1.5 py-0.5">Disembunyikan</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
