import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { parseImages } from '@/lib/format'
import { savePrices } from '../../actions'
import { Badge, Empty, PageHeader } from '@/components/admin/ui'

// Produk situs: harga dan stok produk di situs per cabang, plus tautan ke detail produk.
// Gabungan halaman Produk dan Pricelist & Stok lama (/admin/produk dialihkan ke sini).
export default async function Harga({ searchParams }: PageProps<'/admin/harga'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const f = ['tanpa-foto', 'stok0'].includes(String(sp.f)) ? String(sp.f) : ''
  const branches = await db.branch.findMany({ orderBy: { sort: 'asc' } })
  const branchId = owner ? Number(sp.cabang) || branches[0].id : s.branchId!
  const branch = branches.find((b) => b.id === branchId)!
  const products = await db.product.findMany({
    where: {
      ...(q && { name: { contains: q } }),
      ...(f === 'tanpa-foto' && { images: '[]' }),
      ...(f === 'stok0' && { listings: { some: { branchId, available: true, stock: 0 } } }),
    },
    orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    include: { brand: true, category: true, listings: { where: { branchId } } },
  })
  const url = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ cabang: owner ? String(branchId) : '', q, f, ...patch }).filter(([, v]) => v))
    return `/admin/harga${p.size ? `?${p}` : ''}`
  }
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-neutral-300'}`
  const cell = 'w-28 rounded border border-neutral-300 px-2 py-1.5 text-right text-sm'
  return (
    <div>
      <PageHeader
        title="Produk situs"
        note="Produk yang tampil di situs, dengan harga dan stok per cabang. Ubah banyak baris sekaligus lalu tekan Simpan. Produk yang tidak dicentang Dijual tidak tampil di cabang ini."
        actions={<Link href="/admin/produk/baru" className="adm-btn">+ Tambah produk</Link>}
      />
      {owner && (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Pilih cabang">
          {branches.map((b) => (
            <Link key={b.id} href={url({ cabang: String(b.id) })} aria-current={b.id === branchId ? 'true' : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${b.id === branchId ? 'bg-ink text-white' : 'bg-white text-ink'}`}>{b.name}</Link>
          ))}
        </div>
      )}
      <form className="mb-4 flex flex-wrap items-center gap-2">
        {owner && <input type="hidden" name="cabang" value={branchId} />}
        <input type="hidden" name="f" value={f} />
        <input name="q" defaultValue={q} aria-label="Cari nama produk" placeholder="Cari nama produk" className="w-56 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm" />
        <button className="adm-btn-line adm-btn-sm">Cari</button>
        <a href={url({ f: '' })} className={chip(!f)}>Semua</a>
        <a href={url({ f: 'stok0' })} className={chip(f === 'stok0')}>Stok 0</a>
        <a href={url({ f: 'tanpa-foto' })} className={chip(f === 'tanpa-foto')}>Tanpa foto</a>
      </form>
      {products.length ? (
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
                        <p className="font-semibold text-ink">{p.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                          {[p.category?.name, p.brand?.name].filter(Boolean).join(' · ')}
                          {!parseImages(p.images).length && <Badge tone="outline">tanpa foto</Badge>}
                          {p.isSample && <Badge>contoh</Badge>}
                          {!p.active && <Badge tone="light">disembunyikan</Badge>}
                        </p>
                        <Link href={`/admin/produk/${p.id}`} className="mt-1 inline-block text-xs font-semibold text-ink underline underline-offset-2" aria-label={`Ubah detail ${p.name}`}>Ubah detail</Link>
                      </td>
                      <td className="p-3 text-right"><input name={`p${p.id}_price`} inputMode="numeric" aria-label={`Harga jual ${p.name}`} defaultValue={l?.price ?? ''} className={cell} /></td>
                      <td className="p-3 text-right"><input name={`p${p.id}_compare`} inputMode="numeric" aria-label={`Harga coret ${p.name}`} defaultValue={l?.comparePrice || ''} className={cell} /></td>
                      <td className="p-3 text-right"><input name={`p${p.id}_stock`} inputMode="numeric" aria-label={`Stok ${p.name}`} defaultValue={l?.stock ?? ''} className="w-20 rounded border border-neutral-300 px-2 py-1.5 text-right" /></td>
                      <td className="p-3 text-center"><input type="checkbox" name={`p${p.id}_sell`} aria-label={`Dijual ${p.name}`} defaultChecked={l?.available ?? false} className="size-4" /></td>
                      <td className="p-3 text-center"><input type="checkbox" name={`p${p.id}_flash`} aria-label={`Flash sale ${p.name}`} defaultChecked={l?.flashSale ?? false} className="size-4" /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <button className="sticky bottom-4 mt-4 adm-btn adm-btn-lg shadow-lg">Simpan harga dan stok</button>
        </form>
      ) : (
        <Empty>{q || f ? 'Tidak ada produk yang cocok.' : 'Belum ada produk. Tambah produk dulu.'}</Empty>
      )}
    </div>
  )
}
