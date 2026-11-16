import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { parseImages } from '@/lib/format'
import { savePrices } from '../../actions'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, ListToolbar, Thumb } from '@/components/admin/data-table'
import { inputCls } from '@/components/admin/form-cls'
import { SubmitButton } from '@/components/admin/overlay'

const SARINGAN = [
  { key: '', label: 'Semua' },
  { key: 'stok0', label: 'Stok 0' },
  { key: 'tanpa-foto', label: 'Tanpa foto' },
]

// Produk situs: harga dan stok produk di situs per cabang, plus tautan ke detail produk.
// Gabungan halaman Produk dan Pricelist & Stok lama (/admin/produk dialihkan ke sini).
export default async function Harga({ searchParams }: PageProps<'/admin/harga'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const f = ['tanpa-foto', 'stok0'].includes(String(sp.f)) ? String(sp.f) : ''
  const branches = await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] })
  const branchId = owner ? (branches.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : branches[0].id) : s.branchId!
  const branch = branches.find((b) => b.id === branchId)!
  const where = {
    ...(q && { name: { contains: q } }),
    ...(f === 'tanpa-foto' && { images: '[]' }),
    ...(f === 'stok0' && { listings: { some: { branchId, available: true, stock: 0 } } }),
  }
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
      include: { brand: true, category: true, listings: { where: { branchId } } },
    }),
    db.product.count(),
  ])
  const url = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ cabang: owner ? String(branchId) : '', q, f, ...patch }).filter(([, v]) => v))
    return `/admin/harga${p.size ? `?${p}` : ''}`
  }
  const tambah = <Link href="/admin/produk/baru" className="adm-btn">+ Tambah produk</Link>
  // Kolom isian: dibungkus supaya lebarnya tetap kecil di tabel dan tidak melebar di kartu 390 px.
  const angka = (name: string, label: string, value: string | number, lebar = 'w-28') => (
    <span className={`inline-block ${lebar} align-middle`}>
      <input name={name} inputMode="numeric" aria-label={label} defaultValue={value} className={`${inputCls} min-h-10 text-right max-md:min-h-11`} />
    </span>
  )

  return (
    <PageBody>
      <PageHeader
        title="Produk situs"
        note="Produk yang tampil di situs, dengan harga dan stok per cabang. Ubah banyak baris sekaligus lalu tekan Simpan. Produk yang tidak dicentang Dijual tidak tampil di cabang ini."
        actions={tambah}
      />
      {owner && (
        <FilterChips
          label="Pilih cabang"
          items={branches.map((b) => ({ href: url({ cabang: String(b.id) }), label: b.name, active: b.id === branchId }))}
        />
      )}
      <ListToolbar
        count={products.length}
        total={q || f ? total : undefined}
        noun="produk"
        search={{ placeholder: 'Cari nama produk', value: q, keep: { cabang: owner ? branchId : undefined, f } }}
      >
        <FilterChips label="Saring produk" items={SARINGAN.map((x) => ({ href: url({ f: x.key }), label: x.label, active: f === x.key }))} />
      </ListToolbar>
      {products.length ? (
        <form action={savePrices} className="space-y-4">
          <input type="hidden" name="branchId" value={branchId} />
          <input type="hidden" name="ids" value={products.map((p) => p.id).join(',')} />
          <DataTable
            caption={`Harga dan stok produk di ${branch.name}`}
            rows={products}
            rowKey={(p) => p.id}
            muted={(p) => !p.active}
            thumb={(p) => <Thumb src={parseImages(p.images)[0]} alt={`Foto ${p.name}`} variant="photo" />}
            columns={[
              {
                key: 'produk',
                header: `Produk (${branch.name})`,
                cell: (p) => (
                  <>
                    <span className="block font-semibold text-ink">{p.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mute">
                      {[p.category?.name, p.brand?.name].filter(Boolean).join(' · ')}
                      {!parseImages(p.images).length && <Badge tone="outline">tanpa foto</Badge>}
                      {p.isSample && <Badge>contoh</Badge>}
                      {!p.active && <Badge tone="light">disembunyikan</Badge>}
                    </span>
                  </>
                ),
              },
              { key: 'harga', header: 'Harga jual', align: 'right', cell: (p) => angka(`p${p.id}_price`, `Harga jual ${p.name}`, p.listings[0]?.price ?? '') },
              { key: 'coret', header: 'Harga coret', align: 'right', cell: (p) => angka(`p${p.id}_compare`, `Harga coret ${p.name}`, p.listings[0]?.comparePrice || '') },
              { key: 'stok', header: 'Stok', align: 'right', cell: (p) => angka(`p${p.id}_stock`, `Stok ${p.name}`, p.listings[0]?.stock ?? '', 'w-20') },
              {
                key: 'dijual',
                header: 'Dijual',
                align: 'center',
                cell: (p) => <input type="checkbox" name={`p${p.id}_sell`} aria-label={`Dijual ${p.name}`} defaultChecked={p.listings[0]?.available ?? false} className="size-5 accent-ink" />,
              },
              {
                key: 'flash',
                header: 'Flash',
                align: 'center',
                cell: (p) => <input type="checkbox" name={`p${p.id}_flash`} aria-label={`Flash sale ${p.name}`} defaultChecked={p.listings[0]?.flashSale ?? false} className="size-5 accent-ink" />,
              },
            ]}
            actions={(p) => (
              <Link href={`/admin/produk/${p.id}`} className="adm-btn-line adm-btn-sm" aria-label={`Ubah detail ${p.name}`}>Ubah detail</Link>
            )}
          />
          <div className="sticky bottom-4 z-10 flex justify-end">
            <SubmitButton className="adm-btn adm-btn-lg shadow-lg">Simpan harga dan stok</SubmitButton>
          </div>
        </form>
      ) : (
        <Empty title={q || f ? 'Tidak ada produk yang cocok' : 'Belum ada produk'} action={q || f ? undefined : tambah}>
          {q || f ? 'Ubah kata pencarian atau pilih saringan Semua.' : 'Tambah produk pertama, lalu atur harga dan stoknya di sini.'}
        </Empty>
      )}
    </PageBody>
  )
}
