import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { importStock } from '../../fitur-actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

type LastImport = {
  at: string
  total: number
  withPrice: number
  noPrice: number
  skipped: number
  problemCount: number
  problems: { line: number; group: string; size: string; brand: string; priceRaw: string; stockRaw: string; reason: string; imported: boolean }[]
}

export default async function StokBan({ searchParams }: PageProps<'/admin/stok-ban'>) {
  await requireOwner()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const ring = Number(sp.ring) || 0
  const where = {
    ...(ring && { ring }),
    ...(q && { OR: [{ brand: { contains: q } }, { sizeRaw: { contains: q } }, { sizeNorm: { contains: q.replace(/\s/g, '') } }] }),
  }
  const [rows, count, rings, last] = await Promise.all([
    db.stockTire.findMany({ where, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { price: 'asc' }], take: 150 }),
    db.stockTire.count({ where }),
    db.stockTire.groupBy({ by: ['ring'], _count: true, orderBy: { ring: 'asc' } }),
    db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
  ])
  const li: LastImport | null = last ? JSON.parse(last.value) : null
  const th = 'px-3 py-2 text-left text-xs font-semibold text-neutral-600'
  const td = 'px-3 py-1.5 text-sm'
  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Stok ban</h1>
      <p className="text-sm text-neutral-500">
        Data dari pricelist internal. Dipakai kalkulator ongkir dan chatbot stok, tidak tampil di toko. Mengimpor akan mengganti seluruh stok yang ada.
      </p>

      <Card title="Impor pricelist (CSV)">
        <form action={importStock} encType="multipart/form-data" className="grid gap-3">
          <label className={labelCls}>
            Berkas CSV
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className={inputCls} />
          </label>
          <label className={labelCls}>
            Atau tempel isi CSV di sini
            <textarea name="paste" rows={5} className={`${inputCls} font-mono`} placeholder=",Ukuran Ban,Merk,Harga Jual,Stok,Keterangan" />
          </label>
          <button className="w-fit rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Impor dan ganti stok</button>
        </form>
      </Card>

      {li && (
        <Card title={`Hasil impor terakhir, ${new Date(li.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`}>
          <p className="text-sm">
            <b>{li.total}</b> baris masuk ({li.withPrice} dengan harga, {li.noPrice} tanpa harga). <b>{li.skipped}</b> baris dilewati. {li.problemCount} baris bermasalah.
          </p>
          {li.problems.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="mb-2 text-xs text-neutral-500">
                Ditampilkan apa adanya dari berkas. Harga yang janggal tidak ditebak, disimpan kosong sampai diperbaiki di pricelist.
              </p>
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-neutral-50">
                  <tr>{['Baris', 'Kelompok', 'Ukuran', 'Merek', 'Harga (asli)', 'Stok (asli)', 'Masalah'].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {li.problems.map((p, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      <td className={td}>{p.line}</td>
                      <td className={td}>{p.group}</td>
                      <td className={td}>{p.size}</td>
                      <td className={td}>{p.brand}</td>
                      <td className={`${td} font-mono`}>{p.priceRaw || '(kosong)'}</td>
                      <td className={`${td} font-mono`}>{p.stockRaw || '(kosong)'}</td>
                      <td className={td}>{p.reason}{p.imported ? '' : ' (tidak masuk)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {li.problemCount > li.problems.length && (
                <p className="mt-2 text-xs text-neutral-500">Hanya {li.problems.length} dari {li.problemCount} baris yang ditampilkan.</p>
              )}
            </div>
          )}
        </Card>
      )}

      <Card title={`Isi stok (${count} baris${count > rows.length ? `, menampilkan ${rows.length}` : ''})`}>
        <form className="mb-3 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Cari merek atau ukuran" className={`${inputCls} max-w-xs`} />
          <select name="ring" defaultValue={ring || ''} className={`${inputCls} max-w-[140px]`}>
            <option value="">Semua ring</option>
            {rings.map((r) => <option key={r.ring} value={r.ring}>R{r.ring} ({r._count})</option>)}
          </select>
          <button className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold text-ink">Cari</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-neutral-50">
              <tr>{['Ring', 'Ukuran', 'Merek', 'Harga', 'Stok', 'Keterangan'].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-neutral-100">
                  <td className={td}>R{t.ring}</td>
                  <td className={td}>{t.sizeRaw}</td>
                  <td className={td}>{t.brand}</td>
                  <td className={td}>{t.price === null ? <span className="text-red-600">belum diisi</span> : 'Rp ' + t.price.toLocaleString('id-ID')}</td>
                  <td className={td}>{t.stock}</td>
                  <td className={td}>{t.note}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-neutral-500">Belum ada stok. Impor pricelist dulu.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
