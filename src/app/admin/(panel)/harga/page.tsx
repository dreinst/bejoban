import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { savePrices } from '../../actions'

export default async function Harga({ searchParams }: PageProps<'/admin/harga'>) {
  const s = await requireUser()
  const sp = await searchParams
  const branches = await db.branch.findMany({ orderBy: { sort: 'asc' } })
  const branchId = s.role === 'OWNER' ? Number(sp.cabang) || branches[0].id : s.branchId!
  const branch = branches.find((b) => b.id === branchId)!
  const products = await db.product.findMany({
    orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    include: { brand: true, category: true, listings: { where: { branchId } } },
  })
  const cell = 'w-28 rounded border border-neutral-300 px-2 py-1.5 text-right text-sm'
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Pricelist & Stok</h1>
      <p className="mb-4 text-sm text-neutral-500">Ubah banyak harga sekaligus lalu tekan Simpan di bawah. Produk yang tidak dicentang Dijual tidak tampil di cabang ini.</p>
      {s.role === 'OWNER' && (
        <div className="mb-4 flex gap-2">
          {branches.map((b) => (
            <Link key={b.id} href={`/admin/harga?cabang=${b.id}`} className={`rounded-full px-4 py-2 text-sm font-semibold ${b.id === branchId ? 'bg-ink text-white' : 'bg-white text-ink'}`}>{b.name}</Link>
          ))}
        </div>
      )}
      <form action={savePrices}>
        <input type="hidden" name="branchId" value={branchId} />
        <input type="hidden" name="ids" value={products.map((p) => p.id).join(',')} />
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
              <tr><th className="p-3">Produk ({branch.name})</th><th className="p-3 text-right">Harga jual</th><th className="p-3 text-right">Harga coret</th><th className="p-3 text-right">Stok</th><th className="p-3 text-center">Dijual</th><th className="p-3 text-center">Flash</th></tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const l = p.listings[0]
                return (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="p-3">
                      <Link href={`/admin/produk/${p.id}`} className="font-semibold text-ink">{p.name}</Link>
                      <p className="text-xs text-neutral-500">{[p.category?.name, p.brand?.name].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="p-3 text-right"><input name={`p${p.id}_price`} inputMode="numeric" defaultValue={l?.price ?? ''} className={cell} /></td>
                    <td className="p-3 text-right"><input name={`p${p.id}_compare`} inputMode="numeric" defaultValue={l?.comparePrice || ''} className={cell} /></td>
                    <td className="p-3 text-right"><input name={`p${p.id}_stock`} inputMode="numeric" defaultValue={l?.stock ?? ''} className="w-20 rounded border border-neutral-300 px-2 py-1.5 text-right" /></td>
                    <td className="p-3 text-center"><input type="checkbox" name={`p${p.id}_sell`} defaultChecked={l?.available ?? false} className="size-4" /></td>
                    <td className="p-3 text-center"><input type="checkbox" name={`p${p.id}_flash`} defaultChecked={l?.flashSale ?? false} className="size-4" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button className="sticky bottom-4 mt-4 rounded-lg bg-ink px-6 py-3 text-sm font-bold text-white shadow-lg">Simpan semua harga</button>
      </form>
    </div>
  )
}
