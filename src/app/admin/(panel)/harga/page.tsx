import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { parseImages } from '@/lib/format'
import { savePrices } from '../../actions'
import { saveTampilHarga } from '../../fitur-actions'
import { getSitus } from '@/lib/situs-server'
import { CheckField } from '@/components/admin/field'
import { Badge, Empty, PageBody, PageHeader } from '@/components/admin/ui'
import { DataTable, FilterChips, ListToolbar, Thumb } from '@/components/admin/data-table'
import { inputCls } from '@/components/admin/form-cls'
import { SubmitButton } from '@/components/admin/overlay'
import { RupiahInput } from '@/components/admin/rupiah-input'
import { PeringatanUbah } from '@/components/admin/peringatan-ubah'
import { BilahSimpan } from '@/components/admin/bilah-simpan'
import { namaPendek } from '@/lib/tire/cabang'

const SARINGAN = [
  { key: '', label: 'Semua' },
  { key: 'stok0', label: 'Stok 0' },
  { key: 'tanpa-foto', label: 'Tanpa foto' },
]
const SEMBUNYI = 'disembunyikan'

// Produk situs: harga dan stok produk di situs per cabang, plus tautan ke detail produk.
// Gabungan halaman Produk dan Pricelist & Stok lama (/admin/produk dialihkan ke sini).
export default async function Harga({ searchParams }: PageProps<'/admin/harga'>) {
  const s = await requireUser()
  const owner = s.role === 'OWNER'
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const f = ['tanpa-foto', 'stok0', SEMBUNYI].includes(String(sp.f)) ? String(sp.f) : ''
  const [branches, situs] = await Promise.all([db.branch.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }), getSitus()])
  const branchId = owner ? (branches.some((b) => b.id === Number(sp.cabang)) ? Number(sp.cabang) : branches[0].id) : s.branchId!
  const branch = branches.find((b) => b.id === branchId)!
  // Bawaan hanya produk yang tampil di situs. Yang disembunyikan (mis. produk contoh) dilihat lewat chip tersendiri.
  const where = {
    active: f !== SEMBUNYI,
    ...(q && { name: { contains: q, mode: 'insensitive' as const } }),
    ...(f === 'tanpa-foto' && { images: '[]' }),
    ...(f === 'stok0' && { listings: { some: { branchId, available: true, stock: 0 } } }),
  }
  const [urutDb, total, nSembunyi] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
      include: { brand: true, category: true, listings: { where: { branchId } } },
    }),
    db.product.count({ where: { active: f !== SEMBUNYI } }),
    db.product.count({ where: { active: false } }),
  ])
  // Produk tanpa kategori tetap di depan seperti di SQLite. PostgreSQL menaruh NULL di belakang untuk urutan naik,
  // dan Prisma tidak mengizinkan pilihan nulls pada kolom relasi yang wajib. Urutan dalam tiap kelompok tidak berubah.
  const products = urutDb.toSorted((a, b) => Number(b.categoryId === null) - Number(a.categoryId === null))
  const url = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ cabang: owner ? String(branchId) : '', q, f, ...patch }).filter(([, v]) => v))
    return `/admin/harga${p.size ? `?${p}` : ''}`
  }
  // Produk dipakai bersama semua cabang, jadi hanya owner yang menambah.
  const tambah = owner ? <Link href="/admin/produk/baru" className="adm-btn-line">+ Tambah produk</Link> : undefined
  const namaCabang = namaPendek(branch.name)
  // Kolom isian: dibungkus supaya lebarnya tetap kecil di tabel dan tidak melebar di kartu 390 px.
  const angka = (name: string, label: string, value: string | number, lebar = 'w-28') => (
    <span className={`inline-block ${lebar} align-middle max-md:w-full`}>
      <input name={name} inputMode="numeric" aria-label={label} defaultValue={value} className={`${inputCls} min-h-10 text-right max-md:min-h-11`} />
    </span>
  )

  return (
    <PageBody>
      <PageHeader
        title="Produk situs"
        note="Harga dan stok produk per cabang. Ubah banyak baris sekaligus, dan produk yang tidak dicentang Dijual tidak tampil di cabang ini."
        actions={tambah}
      />
      {owner && (
        <form action={saveTampilHarga} className="adm-card flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4">
          <input type="hidden" name="cabang" value={branchId} />
          <CheckField
            className="min-w-0 flex-1 basis-80"
            label="Tampilkan harga di situs"
            name="showPrices"
            defaultChecked={situs.showPrices}
            hint="Kalau mati, beranda dan halaman produk hanya menampilkan ajakan tanya harga lewat WhatsApp. Harga jasa tidak pernah tampil di situs."
          />
          <SubmitButton className="adm-btn-line">Simpan</SubmitButton>
        </form>
      )}
      {owner && (
        <FilterChips
          label="Pilih cabang"
          items={branches.map((b) => ({ href: url({ cabang: String(b.id) }), label: namaPendek(b.name), active: b.id === branchId }))}
        />
      )}
      <ListToolbar
        count={products.length}
        total={q || f ? total : undefined}
        noun="produk"
        search={{ placeholder: 'Cari nama produk', value: q, keep: { cabang: owner ? branchId : undefined, f } }}
      >
        <FilterChips label="Saring produk" items={[...SARINGAN, ...(nSembunyi || f === SEMBUNYI ? [{ key: SEMBUNYI, label: `Disembunyikan (${nSembunyi})` }] : [])].map((x) => ({ href: url({ f: x.key }), label: x.label, active: f === x.key }))} />
      </ListToolbar>
      {products.length ? (
        <form id="form-harga" action={savePrices} className="space-y-4 pb-24">
          <PeringatanUbah formId="form-harga" />
          <input type="hidden" name="branchId" value={branchId} />
          <input type="hidden" name="ids" value={products.map((p) => p.id).join(',')} />
          <DataTable
            caption={`Harga dan stok produk di cabang ${namaCabang}`}
            rows={products}
            rowKey={(p) => p.id}
            muted={(p) => !p.active}
            thumb={(p) => <Thumb src={parseImages(p.images)[0]} alt={`Foto ${p.name}`} variant="photo" />}
            isianHp
            columns={[
              {
                key: 'produk',
                hpKolom: '1 / 3',
                header: `Produk (cabang ${namaCabang})`,
                cell: (p) => (
                  <>
                    <span className="block font-semibold text-ink">{p.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mute">
                      {[p.category?.name, p.brand?.name].filter(Boolean).join(' · ')}
                      {!parseImages(p.images).length && <Badge tone="outline">tanpa foto</Badge>}
                      {owner && p.isSample && <Badge>contoh</Badge>}
                      {!p.active && <Badge tone="light">disembunyikan</Badge>}
                    </span>
                  </>
                ),
              },
              { key: 'harga', header: 'Harga jual', align: 'right', hpKolom: '1 / 3', cell: (p) => <RupiahInput name={`p${p.id}_price`} label={`Harga jual ${p.name}`} defaultValue={p.listings[0]?.price ?? ''} /> },
              { key: 'coret', header: 'Harga coret', align: 'right', hpKolom: '3 / -1', cell: (p) => <RupiahInput name={`p${p.id}_compare`} label={`Harga coret ${p.name}`} defaultValue={p.listings[0]?.comparePrice || ''} /> },
              { key: 'stok', header: 'Stok', align: 'right', hpKolom: '1 / 3', cell: (p) => angka(`p${p.id}_stock`, `Stok ${p.name}`, p.listings[0]?.stock ?? '', 'w-20') },
              {
                key: 'dijual',
                hpKolom: '3',
                header: 'Dijual',
                align: 'center',
                cell: (p) => (
                  <label className="inline-grid size-6 place-items-center max-md:size-11">
                    <input type="checkbox" name={`p${p.id}_sell`} aria-label={`Dijual ${p.name}`} defaultChecked={p.listings[0]?.available ?? false} className="size-5 accent-ink" />
                  </label>
                ),
              },
              {
                key: 'flash',
                hpKolom: '4',
                header: 'Promo kilat',
                align: 'center',
                cell: (p) => (
                  <label className="inline-grid size-6 place-items-center max-md:size-11">
                    <input type="checkbox" name={`p${p.id}_flash`} aria-label={`Promo kilat ${p.name}`} defaultChecked={p.listings[0]?.flashSale ?? false} className="size-5 accent-ink" />
                  </label>
                ),
              },
            ]}
            actions={(p) => (
              <Link href={`/admin/produk/${p.id}`} className="adm-btn-line adm-btn-sm" aria-label={`Ubah detail ${p.name}`}>Ubah detail</Link>
            )}
          />
          <BilahSimpan formId="form-harga">Simpan harga dan stok</BilahSimpan>
        </form>
      ) : (
        <Empty title={q || f ? 'Tidak ada produk yang cocok' : 'Belum ada produk'} action={q || f ? undefined : tambah}>
          {q || f ? 'Ubah kata pencarian atau pilih saringan Semua.' : owner ? 'Tambah produk pertama, lalu atur harga dan stoknya di sini.' : 'Produk ditambahkan oleh owner. Setelah ada, harga dan stok cabang kamu diatur di sini.'}
        </Empty>
      )}
    </PageBody>
  )
}
