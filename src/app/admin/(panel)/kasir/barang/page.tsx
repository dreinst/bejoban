import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { waktuWib } from '@/lib/format'
import { namaPendek } from '@/lib/tire/cabang'
import { Badge, PageBody, PageHeader, Section, SettingsGrid } from '@/components/admin/ui'
import { DataTable } from '@/components/admin/data-table'
import { FormActions, TextField } from '@/components/admin/field'
import { inputCls } from '@/components/admin/form-cls'
import { SubmitButton } from '@/components/admin/overlay'
import { aturBatasAksi, koreksiStokAksi, ubahHargaBatchAksi } from '../../../kasir-actions'

const rp = (n: number | null) => (n === null ? 'kosong' : `Rp ${n.toLocaleString('id-ID')}`)
const JENIS: Record<string, string> = { awal: 'Awal', koreksi: 'Koreksi', masuk: 'Barang masuk', opname: 'Opname' }
const TIPE: Record<string, string> = { jual: 'Jual', void: 'Void', koreksi: 'Koreksi', impor: 'Impor', masuk: 'Masuk', opname: 'Opname', transfer: 'Transfer' }

// Satu baris stok (ban atau produk situs) untuk owner: batch FIFO dan harganya, koreksi stok, batas minimum, riwayat.
export default async function BarangKasir({ searchParams }: PageProps<'/admin/kasir/barang'>) {
  await requireOwner()
  const sp = await searchParams
  const sumber = sp.sumber === 'produk' ? 'produk' : 'ban'
  const id = Number(sp.id) || 0
  const baris =
    sumber === 'ban'
      ? await db.stockTire.findUnique({ where: { id }, select: { id: true, sizeRaw: true, brand: true, stock: true, price: true, discount: true, cabangId: true, kode: true, batasMinimum: true } }).then((r) =>
          r ? { nama: `${r.sizeRaw} ${r.brand}`, stok: r.stock, harga: r.price === null ? null : r.price - r.discount, cabangId: r.cabangId, kode: r.kode ?? '', batas: r.batasMinimum, balik: '/admin/stok-ban' } : null,
        )
      : await db.listing.findUnique({ where: { id }, select: { stock: true, price: true, branchId: true, batasMinimum: true, product: { select: { id: true, name: true, kode: true, slug: true } } } }).then((l) =>
          l ? { nama: l.product.name, stok: l.stock, harga: l.price as number | null, cabangId: l.branchId as number | null, kode: l.product.kode || l.product.slug, batas: l.batasMinimum, balik: `/admin/harga?cabang=${l.branchId}` } : null,
        )
  if (!baris) notFound()
  const cabang = baris.cabangId === null ? null : await db.branch.findUnique({ where: { id: baris.cabangId }, select: { name: true, modeStok: true } })
  const kasir = cabang?.modeStok === 'kasir'
  const [batch, riwayat, buku, peringatan] = await Promise.all([
    db.batchStok.findMany({ where: { sumber, barisId: id }, orderBy: [{ tanggalMasuk: 'asc' }, { id: 'asc' }] }),
    db.riwayatHarga.findMany({ where: { sumber, kodeProduk: baris.kode, cabangId: baris.cabangId ?? -1 }, orderBy: { id: 'desc' }, take: 20 }),
    db.bukuStok.findMany({ where: { kodeProduk: baris.kode, cabangId: baris.cabangId }, orderBy: { id: 'desc' }, take: 20 }),
    db.peringatanStok.findFirst({ where: { sumber, barisId: id, status: 'aktif' } }),
  ])
  const depan = batch.find((b) => b.sisa > 0)
  const ini = `/admin/kasir/barang?sumber=${sumber}&id=${id}`
  const namaCabang = cabang ? namaPendek(cabang.name) : 'tanpa cabang'
  type B = (typeof batch)[number]

  return (
    <PageBody>
      <Link href={kasir ? '/admin/kasir/pengaturan#barang' : baris.balik} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-ink">
        <ArrowLeft aria-hidden className="size-4" /> Kembali
      </Link>
      <PageHeader
        title={baris.nama}
        note={`${sumber === 'ban' ? 'Ban' : 'Produk situs'}, cabang ${namaCabang}. Stok ${baris.stok}, harga ${rp(baris.harga)}.${kasir ? '' : ' Cabang ini masih mode sheet, jadi hanya batas minimum yang diatur di sini.'}`}
      />

      {kasir && (
        <Section id="batch" title="Batch" description="Penjualan mengambil batch tertua yang masih bersisa. Harga baris selalu mengikuti batch terdepan, dan perubahan harga tercatat di riwayat.">
          <DataTable<B>
            caption="Daftar batch"
            tanpaBingkai
            rows={batch}
            rowKey={(b) => b.id}
            muted={(b) => b.sisa === 0}
            columns={[
              { key: 'masuk', header: 'Masuk', mobile: 'title', cell: (b) => <span className="font-semibold text-ink">{waktuWib(b.tanggalMasuk)}{b.id === depan?.id && <span className="ml-1.5"><Badge>terdepan</Badge></span>}</span> },
              { key: 'jenis', header: 'Jenis', cell: (b) => JENIS[b.jenis] ?? b.jenis },
              { key: 'sisa', header: 'Sisa', align: 'right', cell: (b) => `${b.sisa} dari ${b.jumlahAwal}` },
              { key: 'harga', header: 'Harga jual', align: 'right', cell: (b) => (b.hargaJual > 0 ? rp(b.hargaJual) : <span className="font-semibold text-red-700">belum diatur</span>) },
            ]}
            actions={(b) =>
              b.sisa > 0 ? (
                <form action={ubahHargaBatchAksi} className="flex items-center gap-2">
                  <input type="hidden" name="batch" value={b.id} />
                  <input type="hidden" name="back" value={ini} />
                  <label htmlFor={`harga-${b.id}`} className="sr-only">Harga baru batch {waktuWib(b.tanggalMasuk)}</label>
                  <input id={`harga-${b.id}`} name="harga" inputMode="numeric" required defaultValue={b.hargaJual || ''} className={`${inputCls} min-h-11 w-32 text-right`} />
                  <SubmitButton className="adm-btn-line adm-btn-sm min-h-11">Ubah harga</SubmitButton>
                </form>
              ) : null
            }
            empty={<p className="py-4 text-sm text-mute">Belum ada batch. Stok baris ini 0 saat kasir diaktifkan. Tambah stok lewat koreksi.</p>}
          />
        </Section>
      )}

      <SettingsGrid>
        {kasir && (
          <Section id="koreksi" title="Koreksi stok" description="Untuk selisih hitung atau barang datang sebelum fitur barang masuk tersedia. Pengurangan memakai urutan batch. Penambahan membuat batch baru.">
            <form action={koreksiStokAksi}>
              <input type="hidden" name="sumber" value={sumber} />
              <input type="hidden" name="id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="k-stok" label="Stok baru" name="stok" inputMode="numeric" required defaultValue={baris.stok} />
                <TextField id="k-harga" label="Harga jual batch tambahan (Rp)" name="harga" inputMode="numeric" placeholder={String(depan?.hargaJual ?? baris.harga ?? 0)} hint="Hanya dipakai kalau stok bertambah. Kosong: harga batch terdepan." />
                <TextField id="k-alasan" className="sm:col-span-2" label="Alasan" name="alasan" required minLength={3} maxLength={200} placeholder="Mis. hasil hitung ulang rak" />
              </div>
              <FormActions>
                <SubmitButton>Simpan koreksi</SubmitButton>
              </FormActions>
            </form>
          </Section>
        )}
        <Section id="batas" title="Batas minimum" description="Kalau stok turun ke angka ini atau di bawahnya, muncul peringatan di Perlu dicek dan notifikasi ke admin cabang dan owner. Kosongkan untuk mematikan.">
          <form action={aturBatasAksi}>
            <input type="hidden" name="sumber" value={sumber} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="back" value={ini} />
            <TextField id="b-batas" label="Batas minimum" name="batas" inputMode="numeric" defaultValue={baris.batas ?? ''} placeholder="tanpa batas" className="max-w-xs" />
            <p className="mt-2 text-sm text-mute">{peringatan ? `Peringatan aktif sejak ${waktuWib(peringatan.dibuat)} (stok saat itu ${peringatan.jumlahSaatItu}).` : 'Tidak ada peringatan aktif.'}</p>
            <FormActions>
              <SubmitButton>Simpan batas</SubmitButton>
            </FormActions>
          </form>
        </Section>
      </SettingsGrid>

      <SettingsGrid>
        <Section title="Riwayat harga" description="20 perubahan terakhir.">
          {riwayat.length ? (
            <ul className="divide-y divide-line text-sm">
              {riwayat.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="text-mute">{waktuWib(r.berlakuMulai)}</span>
                  <span>{r.hargaLama === null ? `awal ${rp(r.harga)}` : `${rp(r.hargaLama)} ke ${rp(r.harga)}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Belum ada.</p>
          )}
        </Section>
        <Section title="Buku stok" description="20 perubahan stok terakhir.">
          {buku.length ? (
            <ul className="divide-y divide-line text-sm">
              {buku.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 py-2">
                  <span className="text-mute">{waktuWib(r.waktu)} · {TIPE[r.tipe] ?? r.tipe}</span>
                  <span>
                    {r.perubahan > 0 ? `+${r.perubahan}` : r.perubahan}, saldo {r.saldoAkhir}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-mute">Belum ada.</p>
          )}
        </Section>
      </SettingsGrid>
    </PageBody>
  )
}
