import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { importStock, saveStockRow, syncSheet } from '../../fitur-actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

type LastImport = {
  at: string
  source?: 'berkas' | 'sheet'
  total: number
  withPrice: number
  noPrice: number
  skipped: number
  manualKept?: number
  manualOrphans?: number
  manualOverwritten?: number
  created?: number
  deactivated?: number
  reactivated?: number
  stockChanges?: number
  problemCount: number
  problems: { line: number; group: string; size: string; brand: string; priceRaw: string; stockRaw: string; reason: string; imported: boolean }[]
}

const wib = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })

export default async function StokBan({ searchParams }: PageProps<'/admin/stok-ban'>) {
  await requireOwner()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const ring = Number(sp.ring) || 0
  const f = ['masalah', 'manual'].includes(String(sp.f)) ? String(sp.f) : ''
  const where = {
    aktif: true,
    ...(ring && { ring }),
    ...(f === 'masalah' && { priceIssue: { not: '' } }),
    ...(f === 'manual' && { manual: true }),
    ...(q && { OR: [{ brand: { contains: q } }, { sizeRaw: { contains: q } }, { sizeNorm: { contains: q.replace(/\s/g, '') } }] }),
  }
  const [rows, count, rings, last, sheet, issues] = await Promise.all([
    db.stockTire.findMany({ where, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }], take: 100 }),
    db.stockTire.count({ where }),
    db.stockTire.groupBy({ by: ['ring'], where: { aktif: true }, _count: true, orderBy: { ring: 'asc' } }),
    db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
    db.setting.findUnique({ where: { key: 'stok.sheet' } }),
    db.stockTire.count({ where: { aktif: true, priceIssue: { not: '' } } }),
  ])
  const li: LastImport | null = last ? JSON.parse(last.value) : null
  const sheetUrl: string = sheet ? JSON.parse(sheet.value).url : ''
  const back = `/admin/stok-ban?${new URLSearchParams(Object.entries({ q, ring: ring ? String(ring) : '', f }).filter(([, v]) => v) as [string, string][])}`
  const th = 'px-3 py-2 text-left text-xs font-semibold text-neutral-600'
  const td = 'px-3 py-1.5 text-sm'
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-neutral-300'}`
  const cell = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm'
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Stok ban</h1>
      <p className="text-sm text-neutral-500">
        Data dari pricelist internal. Dipakai kalkulator ongkir dan chatbot stok, tidak tampil di toko. Impor atau sinkron memperbarui baris yang sama (dikenali dari ukuran dan merek), kecuali baris yang diubah manual dan dikunci. Baris yang hilang dari sumber dinonaktifkan dan aktif lagi kalau muncul kembali. Tiap perubahan stok tercatat di buku stok.
      </p>

      <Card title="Sinkron dari Google Sheets">
        <form action={syncSheet} className="grid gap-3">
          <label className={labelCls}>
            URL spreadsheet
            <input name="url" defaultValue={sheetUrl} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0" className={inputCls} />
          </label>
          <p className="text-xs text-neutral-500">
            Spreadsheet harus dibagikan sebagai &quot;Siapa saja yang memiliki tautan dapat melihat&quot;. URL disimpan di pengaturan database, bukan di kode. Sinkron mengambil ekspor CSV tab yang dibuka (gid di URL) dan menjalankan impor yang sama.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="adm-btn">Sinkron sekarang</button>
            {li && <span className="text-xs text-neutral-600">Terakhir: {wib(li.at)} ({li.source === 'sheet' ? 'Google Sheets' : 'berkas CSV'}), {li.total} baris, {li.problemCount} bermasalah</span>}
          </div>
        </form>
      </Card>

      <Card title="Impor dari berkas CSV">
        <form action={importStock} encType="multipart/form-data" className="grid gap-3">
          <label className={labelCls}>
            Berkas CSV
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className={inputCls} />
          </label>
          <label className={labelCls}>
            Atau tempel isi CSV di sini
            <textarea name="paste" rows={4} className={`${inputCls} font-mono`} placeholder=",Ukuran Ban,Merk,Harga Jual,Stok,Keterangan" />
          </label>
          <button className="w-fit adm-btn">Impor dan ganti stok</button>
        </form>
      </Card>

      {li && (
        <Card title={`Hasil impor terakhir, ${wib(li.at)}`}>
          <p className="text-sm">
            <b>{li.total}</b> baris masuk ({li.withPrice} dengan harga, {li.noPrice} tanpa harga). <b>{li.skipped}</b> baris dilewati. {li.problemCount} baris bermasalah.
            {(li.manualKept ?? 0) + (li.manualOrphans ?? 0) + (li.manualOverwritten ?? 0) > 0 && (
              <> Baris manual: {li.manualKept ?? 0} dipertahankan, {li.manualOrphans ?? 0} tidak ada lagi di sumber tapi disimpan, {li.manualOverwritten ?? 0} ditimpa.</>
            )}
            {li.deactivated !== undefined && (
              <> Baris baru {li.created ?? 0}, dinonaktifkan {li.deactivated}, diaktifkan kembali {li.reactivated ?? 0}, stok berubah {li.stockChanges ?? 0}.</>
            )}
          </p>
          {li.problems.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <p className="mb-2 text-xs text-neutral-500">
                Ditampilkan apa adanya dari berkas. Harga kosong berarti barang belum pernah dibeli toko, jadi bot menganggapnya tidak tersedia. Harga janggal tidak ditebak: isi manual di tabel di bawah.
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
        <p className="mb-3 text-xs text-neutral-500">
          Ubah harga, potongan, stok, atau keterangan langsung di baris lalu tekan Simpan. Baris yang diubah diberi penanda &quot;manual&quot;. Kalau dicentang Kunci, sinkron berikutnya tidak menimpa baris itu.
        </p>
        <form className="mb-3 flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Cari merek atau ukuran" className={`${inputCls} max-w-xs`} />
          <select name="ring" defaultValue={ring || ''} className={`${inputCls} max-w-[140px]`}>
            <option value="">Semua ring</option>
            {rings.map((r) => <option key={r.ring} value={r.ring}>R{r.ring} ({r._count})</option>)}
          </select>
          <input type="hidden" name="f" value={f} />
          <button className="adm-btn-line">Cari</button>
          <a href="/admin/stok-ban" className={chip(!f)}>Semua</a>
          <a href="/admin/stok-ban?f=masalah" className={chip(f === 'masalah')}>Harga bermasalah ({issues})</a>
          <a href="/admin/stok-ban?f=manual" className={chip(f === 'manual')}>Diubah manual</a>
        </form>
        <div className="overflow-x-auto">
          <div className="min-w-[860px] space-y-1">
            <div className="grid grid-cols-[50px_120px_1fr_110px_100px_70px_1fr_60px_70px] gap-2 px-1">
              {['Ring', 'Ukuran', 'Merek', 'Harga asli', 'Potongan', 'Stok', 'Keterangan', 'Kunci', ''].map((h) => <span key={h} className="text-xs font-semibold text-neutral-600">{h}</span>)}
            </div>
            {rows.map((t) => (
              <form key={`${t.id}-${t.manualAt?.getTime() ?? 0}`} action={saveStockRow} className={`grid grid-cols-[50px_120px_1fr_110px_100px_70px_1fr_60px_70px] items-center gap-2 border-t border-neutral-100 px-1 py-1 ${t.priceIssue ? 'bg-neutral-50' : ''}`}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="back" value={back} />
                <span className="text-sm">R{t.ring}</span>
                <span className="text-sm">{t.sizeRaw}</span>
                <span className="text-sm">
                  {t.brand}
                  {t.manual && <span className="ml-1 rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">manual</span>}
                  {t.priceIssue === 'kosong' && <span className="block text-xs text-neutral-500">harga kosong: belum pernah dibeli</span>}
                  {t.priceIssue.startsWith('format') && <span className="block text-xs font-semibold text-red-600">harga janggal ({t.priceIssue.replace('format janggal: ', '')}), isi manual</span>}
                </span>
                <input name="price" defaultValue={t.price ?? ''} inputMode="numeric" placeholder="kosong" className={cell} aria-label="Harga asli" />
                <input name="discount" defaultValue={t.discount || ''} inputMode="numeric" placeholder="0" className={cell} aria-label="Potongan" />
                <input name="stock" defaultValue={t.stock} inputMode="numeric" className={cell} aria-label="Stok" />
                <input name="note" defaultValue={t.note} className={cell} aria-label="Keterangan" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="lock" defaultChecked={t.manual ? t.lockManual : true} />Kunci</label>
                <button className="adm-btn-line adm-btn-sm">Simpan</button>
              </form>
            ))}
            {!rows.length && <p className="px-3 py-6 text-center text-sm text-neutral-500">Tidak ada baris. Impor pricelist dulu atau ubah pencarian.</p>}
          </div>
        </div>
      </Card>
    </div>
  )
}
