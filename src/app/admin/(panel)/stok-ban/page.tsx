import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { importStock, saveStockRow, syncSheet, tetapkanCabang } from '../../fitur-actions'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'
import { Badge, Empty } from '@/components/admin/ui'
import { bandingCabang, namaPendek } from '@/lib/tire/cabang'

type LastImport = {
  at: string
  source?: 'berkas' | 'sheet'
  cabangId?: number | null
  gabungan?: boolean
  bagian?: { cabangId: number | null; total: number }[]
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

const GABUNGAN = '__gabungan'
const rpAngka = (n: number | null) => (n === null ? 'kosong' : n.toLocaleString('id-ID'))

export default async function StokBan({ searchParams }: PageProps<'/admin/stok-ban'>) {
  await requireOwner()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const ring = Number(sp.ring) || 0
  const f = ['masalah', 'manual'].includes(String(sp.f)) ? String(sp.f) : ''
  const branches = await db.branch.findMany({ orderBy: { sort: 'asc' }, select: { id: true, slug: true, name: true } })
  // Filter cabang: kosong = semua, "tanpa" = baris tanpa cabang, atau slug cabang.
  const cbRaw = String(sp.cb ?? '')
  const cbBranch = branches.find((b) => b.slug === cbRaw) ?? null
  const cb = cbBranch ? cbBranch.slug : cbRaw === 'tanpa' ? 'tanpa' : ''
  const banding = sp.view === 'banding'
  const where = {
    aktif: true,
    ...(ring && { ring }),
    ...(f === 'masalah' && { priceIssue: { not: '' } }),
    ...(f === 'manual' && { manual: true }),
    ...(cb === 'tanpa' && { cabangId: null }),
    ...(cbBranch && { cabangId: cbBranch.id }),
    ...(q && { OR: [{ brand: { contains: q } }, { sizeRaw: { contains: q } }, { sizeNorm: { contains: q.replace(/\s/g, '') } }] }),
  }
  const sheetKeys = ['stok.sheet', ...branches.map((b) => `stok.sheet.${b.slug}`), 'stok.sheet.gabungan']
  const [rows, count, rings, last, sheets, issues, perCabang] = await Promise.all([
    banding
      ? db.stockTire.findMany({ where: { ...where, cabangId: undefined }, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }], take: 1500 })
      : db.stockTire.findMany({ where, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }], take: 100 }),
    db.stockTire.count({ where }),
    db.stockTire.groupBy({ by: ['ring'], where: { aktif: true }, _count: true, orderBy: { ring: 'asc' } }),
    db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
    db.setting.findMany({ where: { key: { in: sheetKeys } } }),
    db.stockTire.count({ where: { aktif: true, priceIssue: { not: '' } } }),
    db.stockTire.groupBy({ by: ['cabangId'], where: { aktif: true }, _count: true }),
  ])
  const li: LastImport | null = last ? JSON.parse(last.value) : null
  const sheetUrl = (key: string): string => {
    const r = sheets.find((x) => x.key === key)
    return r ? (JSON.parse(r.value).url ?? '') : ''
  }
  const namaCabang = (id: number | null | undefined) => (id == null ? 'tanpa cabang' : namaPendek(branches.find((b) => b.id === id)?.name ?? `cabang ${id}`))
  const jumlahCabang = (id: number | null) => perCabang.find((x) => x.cabangId === id)?._count ?? 0
  const tanpaCabang = jumlahCabang(null)
  const params = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ q, ring: ring ? String(ring) : '', f, cb, view: banding ? 'banding' : '', ...patch }).filter(([, v]) => v) as [string, string][])
    return `/admin/stok-ban${p.size ? `?${p}` : ''}`
  }
  const back = params({})
  const th = 'px-3 py-2 text-left text-xs font-semibold text-neutral-600'
  const td = 'px-3 py-1.5 text-sm'
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-neutral-300'}`
  const cell = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm'
  const pilihanTujuan = (
    <>
      <option value="">Tanpa cabang (seperti sebelumnya)</option>
      {branches.map((b) => <option key={b.slug} value={b.slug}>Cabang {namaPendek(b.name)}</option>)}
      <option value={GABUNGAN}>Sheet gabungan (kolom Cabang)</option>
    </>
  )
  const targets = [
    { value: '', label: 'Tanpa cabang', url: sheetUrl('stok.sheet') },
    ...branches.map((b) => ({ value: b.slug, label: namaPendek(b.name), url: sheetUrl(`stok.sheet.${b.slug}`) })),
    { value: GABUNGAN, label: 'Sheet gabungan', url: sheetUrl('stok.sheet.gabungan') },
  ]
  const grup = banding ? bandingCabang(rows) : []
  const kolomBanding: (number | null)[] = [...(tanpaCabang ? [null] : []), ...branches.map((b) => b.id)]
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold text-ink">Stok ban</h1>
      <p className="text-sm text-neutral-500">
        Data dari pricelist internal. Dipakai kalkulator ongkir dan chatbot stok, tidak tampil di toko. Stok Batu dan Karanglo terpisah: tiap impor atau sinkron masuk ke satu cabang (atau ke baris tanpa cabang seperti sebelumnya) dan hanya memperbarui baris cabang itu, dikenali dari ukuran dan merek, kecuali baris yang diubah manual dan dikunci. Baris yang hilang dari sumber dinonaktifkan dan aktif lagi kalau muncul kembali. Tiap perubahan stok tercatat di buku stok.
      </p>

      <Card title="Sinkron dari Google Sheets">
        <div className="grid gap-2">
          {targets.map((t) => (
            <form key={t.value || 'tanpa'} action={syncSheet} className="grid items-center gap-2 md:grid-cols-[150px_1fr_auto]">
              <input type="hidden" name="cabang" value={t.value} />
              <span className="text-sm font-semibold text-ink">{t.label}</span>
              <input name="url" defaultValue={t.url} aria-label={`URL spreadsheet ${t.label}`} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0" className={inputCls} />
              <button className="adm-btn-line adm-btn-sm">Sinkron sekarang</button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Satu URL per cabang. Spreadsheet harus dibagikan sebagai &quot;Siapa saja yang memiliki tautan dapat melihat&quot;. URL disimpan di pengaturan database, bukan di kode. Sinkron mengambil ekspor CSV tab yang dibuka (gid di URL). Sheet gabungan dipakai kalau satu sheet berisi dua cabang dengan kolom &quot;Cabang&quot; di baris judul (isi Batu atau Karanglo). Baris dengan cabang kosong atau tidak dikenal dilewati dan dilaporkan.
        </p>
        {li && <p className="mt-2 text-xs text-neutral-600">Terakhir: {wib(li.at)} ({li.source === 'sheet' ? 'Google Sheets' : 'berkas CSV'}, {li.gabungan ? 'sheet gabungan' : namaCabang(li.cabangId)}), {li.total} baris, {li.problemCount} bermasalah</p>}
      </Card>

      <Card title="Impor dari berkas CSV">
        <form action={importStock} encType="multipart/form-data" className="grid gap-3">
          <label className={labelCls}>
            Masuk ke
            <select name="cabang" defaultValue="" className={`${inputCls} max-w-sm`}>{pilihanTujuan}</select>
          </label>
          <label className={labelCls}>
            Berkas CSV
            <input type="file" name="file" accept=".csv,text/csv,text/plain" className={inputCls} />
          </label>
          <label className={labelCls}>
            Atau tempel isi CSV di sini
            <textarea name="paste" rows={4} className={`${inputCls} font-mono`} placeholder=",Ukuran Ban,Merk,Harga Jual,Stok,Keterangan" />
          </label>
          <button className="w-fit adm-btn">Impor dan ganti stok cabang ini</button>
        </form>
      </Card>

      {tanpaCabang > 0 && branches.length > 0 && (
        <Card title={`Baris tanpa cabang (${tanpaCabang} aktif)`}>
          <p className="mb-3 text-sm text-neutral-600">
            Baris ini belum punya cabang, jadi dipakai sebagai stok bersama (bot menjawabnya tanpa menanyakan cabang). Kalau owner sudah tahu pricelist ini milik cabang mana, tetapkan sekaligus di sini. Baris yang kodenya sudah ada di cabang tujuan dilewati dan tetap tanpa cabang.
          </p>
          <form action={tetapkanCabang} className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Tetapkan semua baris tanpa cabang ke
              <select name="cabang" required defaultValue="" className={`${inputCls} ml-2 inline-block w-auto`}>
                <option value="" disabled>Pilih cabang</option>
                {branches.map((b) => <option key={b.slug} value={b.slug}>{namaPendek(b.name)}</option>)}
              </select>
            </label>
            <label className="text-xs"><input type="checkbox" name="yakin" required className="mr-1" />Yakin</label>
            <button className="adm-btn-line adm-btn-sm">Tetapkan</button>
          </form>
        </Card>
      )}

      {li && (
        <Card title={`Hasil impor terakhir, ${wib(li.at)}`}>
          <p className="mb-1 text-sm">
            Tujuan: <b>{li.gabungan ? `sheet gabungan (${(li.bagian ?? []).map((b) => `${namaCabang(b.cabangId)} ${b.total} baris`).join(', ')})` : namaCabang(li.cabangId)}</b>
          </p>
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

      <Card title={banding ? `Banding cabang (${grup.length} ukuran dan merek)` : `Isi stok (${count} baris${count > rows.length ? `, menampilkan ${rows.length}` : ''})`}>
        <p className="mb-3 text-xs text-neutral-500">
          {banding
            ? 'Satu baris per ukuran dan merek, stok dan harga tiap cabang berdampingan. Tanda strip berarti cabang itu tidak punya baris tersebut. Ubah angkanya di tampilan biasa.'
            : 'Ubah harga, potongan, stok, atau keterangan langsung di baris lalu tekan Simpan. Baris yang diubah diberi penanda "manual". Kalau dicentang Kunci, sinkron berikutnya tidak menimpa baris itu.'}
        </p>
        <form className="mb-3 flex flex-wrap items-center gap-2">
          <input name="q" defaultValue={q} placeholder="Cari merek atau ukuran" className={`${inputCls} max-w-xs`} />
          <select name="ring" defaultValue={ring || ''} className={`${inputCls} max-w-[140px]`}>
            <option value="">Semua ring</option>
            {rings.map((r) => <option key={r.ring} value={r.ring}>R{r.ring} ({r._count})</option>)}
          </select>
          <input type="hidden" name="f" value={f} />
          <input type="hidden" name="cb" value={cb} />
          {banding && <input type="hidden" name="view" value="banding" />}
          <button className="adm-btn-line">Cari</button>
          <a href={params({ f: '' })} className={chip(!f)}>Semua</a>
          <a href={params({ f: 'masalah' })} className={chip(f === 'masalah')}>Harga bermasalah ({issues})</a>
          <a href={params({ f: 'manual' })} className={chip(f === 'manual')}>Diubah manual</a>
        </form>
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Filter cabang">
          <span className="text-xs font-semibold text-neutral-600">Cabang:</span>
          <a href={params({ cb: '', view: '' })} className={chip(!cb && !banding)}>Semua</a>
          <a href={params({ cb: 'tanpa', view: '' })} className={chip(cb === 'tanpa' && !banding)}>Tanpa cabang ({tanpaCabang})</a>
          {branches.map((b) => (
            <a key={b.slug} href={params({ cb: b.slug, view: '' })} className={chip(cb === b.slug && !banding)}>{namaPendek(b.name)} ({jumlahCabang(b.id)})</a>
          ))}
          <a href={params({ cb: '', view: 'banding' })} className={chip(banding)}>Banding cabang</a>
        </div>
        {banding ? (
          grup.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className={th} rowSpan={2}>Ukuran</th>
                    <th className={th} rowSpan={2}>Merek</th>
                    {kolomBanding.map((id) => <th key={id ?? 'tanpa'} className={`${th} border-l border-neutral-200 text-center`} colSpan={2}>{id === null ? 'Tanpa cabang' : namaCabang(id)}</th>)}
                  </tr>
                  <tr>
                    {kolomBanding.map((id) => [
                      <th key={`s${id}`} className={`${th} border-l border-neutral-200`}>Stok</th>,
                      <th key={`h${id}`} className={th}>Harga</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {grup.slice(0, 300).map((g) => (
                    <tr key={g.kode} className="border-t border-neutral-100">
                      <td className={td}>{g.contoh.sizeRaw}</td>
                      <td className={td}>{g.contoh.brand}</td>
                      {kolomBanding.map((id) => {
                        const x = g.isi.get(id)
                        return [
                          <td key={`s${id}`} className={`${td} border-l border-neutral-100 ${x && x.stock === 0 ? 'text-neutral-400' : ''}`}>{x ? x.stock : '-'}</td>,
                          <td key={`h${id}`} className={td}>{x ? rpAngka(x.price === null ? null : x.price - x.discount) : '-'}</td>,
                        ]
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {grup.length > 300 && <p className="mt-2 text-xs text-neutral-500">Menampilkan 300 dari {grup.length}. Persempit dengan pencarian atau ring.</p>}
            </div>
          ) : (
            <Empty>Tidak ada baris yang cocok. Impor pricelist per cabang dulu atau ubah pencarian.</Empty>
          )
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[960px] space-y-1">
              <div className="grid grid-cols-[50px_120px_90px_1fr_110px_100px_70px_1fr_60px_70px] gap-2 px-1">
                {['Ring', 'Ukuran', 'Cabang', 'Merek', 'Harga asli', 'Potongan', 'Stok', 'Keterangan', 'Kunci', ''].map((h) => <span key={h} className="text-xs font-semibold text-neutral-600">{h}</span>)}
              </div>
              {rows.map((t) => (
                <form key={`${t.id}-${t.manualAt?.getTime() ?? 0}`} action={saveStockRow} className={`grid grid-cols-[50px_120px_90px_1fr_110px_100px_70px_1fr_60px_70px] items-center gap-2 border-t border-neutral-100 px-1 py-1 ${t.priceIssue ? 'bg-neutral-50' : ''}`}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <span className="text-sm">R{t.ring}</span>
                  <span className="text-sm">{t.sizeRaw}</span>
                  <span>{t.cabangId === null ? <Badge tone="outline">tanpa</Badge> : <Badge tone="light">{namaCabang(t.cabangId)}</Badge>}</span>
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
              {!rows.length && <Empty>Tidak ada baris. Impor pricelist dulu atau ubah pencarian.</Empty>}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
