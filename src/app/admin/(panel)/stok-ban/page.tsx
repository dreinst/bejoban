import Link from 'next/link'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { importStock, saveStockRow, syncSheet, tetapkanCabang } from '../../fitur-actions'
import { Badge, Empty, PageBody, PageHeader, StatCard } from '@/components/admin/ui'
import { DataTable, FilterChips, Halaman, ListToolbar } from '@/components/admin/data-table'
import { BerkasInput } from '@/components/admin/berkas-input'
import { waktuWib } from '@/lib/format'
import { CheckField, FormActions, FormGrid, SelectField, TextAreaField, TextField } from '@/components/admin/field'
import { CloseButton, ConfirmDialog, Drawer, SubmitButton } from '@/components/admin/overlay'
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

const wib = (iso: string) => waktuWib(iso)
const GABUNGAN = '__gabungan'
const rpAngka = (n: number | null) => (n === null ? 'kosong' : n.toLocaleString('id-ID'))
const rp = (n: number | null) => (n === null ? 'kosong' : `Rp ${n.toLocaleString('id-ID')}`)
const BATAS = 100

export default async function StokBan({ searchParams }: PageProps<'/admin/stok-ban'>) {
  await requireOwner()
  const sp = await searchParams
  const q = String(sp.q ?? '').trim().slice(0, 60)
  const ring = Number(sp.ring) || 0
  const f = ['masalah', 'manual', 'habis'].includes(String(sp.f)) ? String(sp.f) : ''
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
    ...(f === 'habis' && { stock: 0 }),
    ...(cb === 'tanpa' && { cabangId: null }),
    ...(cbBranch && { cabangId: cbBranch.id }),
    ...(q && { OR: [{ brand: { contains: q } }, { sizeRaw: { contains: q } }, { sizeNorm: { contains: q.replace(/\s/g, '') } }] }),
  }
  const count = await db.stockTire.count({ where })
  const halaman = Math.min(Math.max(1, Math.floor(Number(sp.hal)) || 1), Math.max(1, Math.ceil(count / BATAS)))
  const sheetKeys = ['stok.sheet', ...branches.map((b) => `stok.sheet.${b.slug}`), 'stok.sheet.gabungan']
  const [rows, rings, last, sheets, issues, perCabang, habis] = await Promise.all([
    banding
      ? db.stockTire.findMany({ where: { ...where, cabangId: undefined }, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }], take: 1500 })
      : db.stockTire.findMany({ where, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }, { id: 'asc' }], skip: (halaman - 1) * BATAS, take: BATAS }),
    db.stockTire.groupBy({ by: ['ring'], where: { aktif: true }, _count: true, orderBy: { ring: 'asc' } }),
    db.setting.findUnique({ where: { key: 'stok.lastImport' } }),
    db.setting.findMany({ where: { key: { in: sheetKeys } } }),
    db.stockTire.count({ where: { aktif: true, priceIssue: { not: '' } } }),
    db.stockTire.groupBy({ by: ['cabangId'], where: { aktif: true }, _count: true }),
    db.stockTire.count({ where: { aktif: true, stock: 0 } }),
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
  const back = params({ hal: halaman > 1 ? String(halaman) : '' })
  const targets = [
    { value: '', label: 'Tanpa cabang', url: sheetUrl('stok.sheet') },
    ...branches.map((b) => ({ value: b.slug, label: namaPendek(b.name), url: sheetUrl(`stok.sheet.${b.slug}`) })),
    { value: GABUNGAN, label: 'Satu sheet untuk semua cabang', url: sheetUrl('stok.sheet.gabungan') },
  ]
  const grup = banding ? bandingCabang(rows) : []
  const kolomBanding: (number | null)[] = [...(tanpaCabang ? [null] : []), ...branches.map((b) => b.id)]
  const adaCabang = perCabang.some((x) => x.cabangId !== null)
  const kolomCabang = !cb && adaCabang
  type Baris = (typeof rows)[number]
  type Grup = (typeof grup)[number]
  const tujuanImpor = li ? (li.gabungan ? `satu sheet untuk semua cabang (${(li.bagian ?? []).map((b) => `${namaCabang(b.cabangId)} ${b.total} baris`).join(', ')})` : namaCabang(li.cabangId)) : ''

  const perbarui = (
    <Drawer
      trigger="Perbarui dari pricelist"
      triggerClassName="adm-btn"
      title="Perbarui dari pricelist"
      description="Tiap sinkron atau impor hanya mengganti stok cabang yang dipilih. Ban yang diubah manual dan dikunci tidak ditimpa."
    >
      <div className="space-y-6">
        <section aria-labelledby="sinkron-judul">
          <h3 id="sinkron-judul" className="font-display text-base font-extrabold text-ink">Ambil dari Google Sheets</h3>
          <p className="mt-1 text-sm text-mute">Tempel satu tautan per cabang, lalu tekan Sinkron.</p>
          <details className="mt-1">
            <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink">Cara menyiapkan</summary>
            <div className="space-y-1.5 pb-2 text-xs leading-snug text-mute">
              <p>Di Google Sheets, bagikan spreadsheet dengan akses &quot;Siapa saja yang memiliki tautan dapat melihat&quot;. Yang diambil adalah tab yang sedang terbuka di tautan itu.</p>
              <p>Kalau satu sheet berisi dua cabang, tempel di kolom &quot;Satu sheet untuk semua cabang&quot; dan beri kolom &quot;Cabang&quot; (isi Batu atau Karanglo). Baris yang cabangnya kosong dilewati dan dilaporkan.</p>
            </div>
          </details>
          <div className="mt-2 space-y-3">
            {targets.map((t) => (
              <form key={t.value || 'tanpa'} action={syncSheet} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="cabang" value={t.value} />
                <TextField className="min-w-0 flex-1 basis-60" id={`sheet-${t.value || 'tanpa'}`} label={t.label} name="url" defaultValue={t.url} placeholder="Tempel tautan Google Sheets" />
                <SubmitButton className="adm-btn-line" pending="Menyinkron...">Sinkron</SubmitButton>
              </form>
            ))}
          </div>
        </section>

        <section aria-labelledby="impor-judul" className="border-t border-line pt-5">
          <h3 id="impor-judul" className="font-display text-base font-extrabold text-ink">Impor dari berkas CSV</h3>
          <p className="mb-3 mt-1 text-sm text-mute">Stok cabang tujuan diganti dengan isi berkas.</p>
          <form action={importStock}>
            <FormGrid cols={1}>
              <SelectField label="Masuk ke" name="cabang" id="impor-cabang" defaultValue="">
                <option value="">Tanpa cabang</option>
                {branches.map((b) => <option key={b.slug} value={b.slug}>Cabang {namaPendek(b.name)}</option>)}
                <option value={GABUNGAN}>Satu sheet untuk semua cabang (ada kolom Cabang)</option>
              </SelectField>
              <BerkasInput label="Berkas CSV" name="file" accept=".csv,text/csv,text/plain" />
              <TextAreaField label="Atau tempel isi berkas" name="paste" rows={3} placeholder="Tempel isi pricelist di sini" />
            </FormGrid>
            <FormActions><SubmitButton pending="Mengimpor...">Impor dan ganti stok</SubmitButton></FormActions>
          </form>
        </section>

        {li && (
          <section aria-labelledby="hasil-judul" className="border-t border-line pt-5">
            <h3 id="hasil-judul" className="font-display text-base font-extrabold text-ink">Hasil impor terakhir</h3>
            <p className="mb-3 mt-1 text-sm text-mute">{wib(li.at)}, {li.source === 'sheet' ? 'Google Sheets' : 'berkas CSV'}, ke {tujuanImpor}.</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Baris masuk" value={li.total} hint={`${li.withPrice} dengan harga`} />
              <StatCard label="Tanpa harga" value={li.noPrice} />
              <StatCard label="Dilewati" value={li.skipped} />
              <StatCard label="Bermasalah" value={li.problemCount} warn={li.problemCount > 0} />
            </div>
            <p className="mt-3 text-sm text-mute">
              {li.deactivated !== undefined && <>Baru {li.created ?? 0}, hilang dari sumber {li.deactivated}, muncul lagi {li.reactivated ?? 0}, stok berubah {li.stockChanges ?? 0}. </>}
              {(li.manualKept ?? 0) + (li.manualOrphans ?? 0) + (li.manualOverwritten ?? 0) > 0 && <>Baris manual: {li.manualKept ?? 0} dipertahankan, {li.manualOrphans ?? 0} tidak ada lagi di sumber tapi disimpan, {li.manualOverwritten ?? 0} ditimpa.</>}
            </p>
            {li.problems.length > 0 && (
              <details className="mt-3">
                <summary className="flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink">Lihat {li.problems.length} baris bermasalah</summary>
                <p className="mb-2 text-xs text-mute">Harga kosong berarti barang belum pernah dibeli toko, jadi bot menganggapnya tidak tersedia. Harga yang tidak terbaca diisi manual di tabel stok.</p>
                <DataTable
                  caption="Baris bermasalah dari impor terakhir"
                  rows={li.problems.map((p, i) => ({ ...p, i }))}
                  rowKey={(p) => p.i}
                  columns={[
                    { key: 'ukuran', header: 'Ukuran', cell: (p) => `${p.size} ${p.brand}` },
                    { key: 'baris', header: 'Baris', cell: (p) => p.line },
                    { key: 'harga', header: 'Harga (asli)', cell: (p) => <span className="font-mono">{p.priceRaw || '(kosong)'}</span> },
                    { key: 'stok', header: 'Stok (asli)', mobile: 'hide', cell: (p) => <span className="font-mono">{p.stockRaw || '(kosong)'}</span> },
                    { key: 'masalah', header: 'Masalah', cell: (p) => `${p.reason}${p.imported ? '' : ' (tidak masuk)'}` },
                  ]}
                />
                {li.problemCount > li.problems.length && <p className="mt-2 text-xs text-mute">Hanya {li.problems.length} dari {li.problemCount} baris yang ditampilkan.</p>}
              </details>
            )}
          </section>
        )}
      </div>
    </Drawer>
  )

  return (
    <PageBody>
      <PageHeader
        title="Stok ban"
        note="Stok dan harga ban dari pricelist toko. Dipakai chatbot dan kalkulator ongkir, tidak tampil di situs."
        actions={perbarui}
      />

      {li && (
        <p className="text-sm text-mute">
          Pricelist terakhir diperbarui {wib(li.at)} ({li.source === 'sheet' ? 'Google Sheets' : 'berkas'}, {tujuanImpor}).{' '}
          {li.problemCount > 0 && <Link href={params({ f: 'masalah' })} className="font-semibold text-ink underline underline-offset-2">{li.problemCount} baris bermasalah</Link>}
        </p>
      )}

      {tanpaCabang > 0 && branches.length > 0 && (
        <div className="adm-card flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <p className="min-w-0 flex-1 basis-72 text-sm text-ink">
            <b>{tanpaCabang.toLocaleString('id-ID')} ban belum punya cabang.</b>{' '}
            <span className="text-mute">Dianggap stok bersama, jadi bot menjawabnya tanpa menanyakan cabang. Kalau sudah tahu milik cabang mana, tetapkan sekaligus.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <ConfirmDialog
                key={b.slug}
                trigger={`Tetapkan ke ${namaPendek(b.name)}`}
                triggerClassName="adm-btn-line adm-btn-sm"
                title={`Tetapkan ${tanpaCabang} ban ke ${namaPendek(b.name)}?`}
                message={
                  <>
                    <p>Semua {tanpaCabang} baris tanpa cabang menjadi stok cabang {namaPendek(b.name)}. Bot lalu hanya menyebut stok ini untuk pelanggan cabang itu.</p>
                    <p className="text-mute">Baris yang ukuran dan mereknya sudah ada di {namaPendek(b.name)} dilewati dan tetap tanpa cabang. Aksi ini tercatat di log aktivitas dan buku stok.</p>
                  </>
                }
                alternative={{ action: tetapkanCabang, fields: { cabang: b.slug, yakin: 'on' }, label: `Tetapkan ke ${namaPendek(b.name)}` }}
              />
            ))}
          </div>
        </div>
      )}

      <section aria-labelledby="isi-stok" className="space-y-3">
        <h2 id="isi-stok" className="sr-only">{banding ? 'Banding cabang' : 'Isi stok'}</h2>
        <ListToolbar
          count={banding ? Math.min(grup.length, 300) : rows.length}
          total={banding ? grup.length : count}
          noun={banding ? 'ukuran dan merek' : 'baris stok'}
          search={{ placeholder: 'Cari merek atau ukuran', value: q, keep: { ring: ring || undefined, f, cb, view: banding ? 'banding' : undefined } }}
        >
          <form className="flex items-center gap-2">
            {q && <input type="hidden" name="q" value={q} />}
            {f && <input type="hidden" name="f" value={f} />}
            {cb && <input type="hidden" name="cb" value={cb} />}
            {banding && <input type="hidden" name="view" value="banding" />}
            <label htmlFor="saring-ring" className="sr-only">Ring</label>
            <select id="saring-ring" name="ring" defaultValue={ring || ''} className="min-h-10 rounded-lg border border-[#cfcfcf] bg-white px-3 text-sm">
              <option value="">Semua ring</option>
              {rings.map((r) => <option key={r.ring} value={r.ring}>R{r.ring} ({r._count})</option>)}
            </select>
            <button className="adm-btn-line adm-btn-sm">Terapkan</button>
          </form>
        </ListToolbar>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <FilterChips
            label="Saring cabang"
            items={[
              { href: params({ cb: '', view: '' }), label: 'Semua cabang', active: !cb && !banding },
              { href: params({ cb: 'tanpa', view: '' }), label: 'Tanpa cabang', active: cb === 'tanpa' && !banding, count: tanpaCabang },
              ...branches.map((b) => ({ href: params({ cb: b.slug, view: '' }), label: namaPendek(b.name), active: cb === b.slug && !banding, count: jumlahCabang(b.id) })),
              { href: params({ cb: '', view: 'banding' }), label: 'Banding cabang', active: banding },
            ]}
          />
          <FilterChips
            label="Saring masalah"
            items={[
              { href: params({ f: '' }), label: 'Semua', active: !f },
              { href: params({ f: 'masalah' }), label: 'Harga bermasalah', active: f === 'masalah', count: issues },
              { href: params({ f: 'manual' }), label: 'Diubah manual', active: f === 'manual' },
              { href: params({ f: 'habis' }), label: 'Stok habis', active: f === 'habis', count: habis },
            ]}
          />
        </div>
        <p className="text-xs text-mute">
          {banding
            ? 'Satu baris per ukuran dan merek, stok dan harga setelah potongan tiap cabang berdampingan. Tanda strip berarti cabang itu tidak punya baris tersebut. Ubah angkanya di tampilan biasa.'
            : 'Ubah harga, potongan, stok, atau keterangan lewat tombol Ubah. Baris yang diubah diberi penanda "manual". Kalau dikunci, sinkron berikutnya tidak menimpa baris itu.'}
        </p>
        {banding ? (
          <DataTable<Grup>
            caption="Banding stok antar cabang"
            rows={grup.slice(0, 300)}
            rowKey={(g) => g.kode}
            columns={[
              { key: 'ukuran', header: 'Ukuran', cell: (g) => `${g.contoh.sizeRaw} ${g.contoh.brand}` },
              ...kolomBanding.map((id) => ({
                key: `c${id ?? 'tanpa'}`,
                header: id === null ? 'Tanpa cabang' : namaCabang(id),
                cell: (g: Grup) => {
                  const x = g.isi.get(id)
                  return x ? <span className={x.stock === 0 ? 'text-mute' : ''}>stok {x.stock}, Rp {rpAngka(x.price === null ? null : x.price - x.discount)}</span> : '-'
                },
              })),
            ]}
            empty={<Empty title="Tidak ada baris yang cocok">Impor pricelist per cabang dulu atau ubah pencarian.</Empty>}
          />
        ) : (
          <DataTable<Baris>
            caption="Isi stok ban"
            rows={rows}
            rowKey={(t) => `${t.id}-${t.manualAt?.getTime() ?? 0}`}
            columns={[
              {
                key: 'ban',
                header: 'Ukuran dan merek',
                cell: (t) => (
                  <span className="block">
                    <span className="font-semibold text-ink">{t.sizeRaw}</span> {t.brand}
                    {t.manual && <span className="ml-1.5"><Badge>manual</Badge></span>}
                    {t.priceIssue === 'kosong' && <span className="block text-xs font-normal text-mute">harga kosong: belum pernah dibeli</span>}
                    {t.priceIssue.startsWith('format') && <span className="block text-xs font-semibold text-red-700">harga janggal ({t.priceIssue.replace('format janggal: ', '')}), isi manual</span>}
                  </span>
                ),
              },
              ...(kolomCabang
                ? [{ key: 'cabang', header: 'Cabang', cell: (t: Baris) => (t.cabangId === null ? <Badge tone="outline">tanpa cabang</Badge> : <Badge tone="light">{namaCabang(t.cabangId)}</Badge>) }]
                : []),
              { key: 'harga', header: 'Harga', align: 'right', cell: (t) => rp(t.price) },
              { key: 'potongan', header: 'Potongan', align: 'right', mobile: 'hide', cell: (t) => (t.discount ? rpAngka(t.discount) : '-') },
              { key: 'stok', header: 'Stok', align: 'right', cell: (t) => (t.stock === 0 ? <Badge tone="outline">Habis</Badge> : t.stock) },
              { key: 'ket', header: 'Keterangan', mobile: 'hide', cell: (t) => <span className="line-clamp-2 text-mute">{t.note || '-'}</span> },
            ]}
            actions={(t) => (
              <Drawer trigger="Ubah" triggerLabel={`Ubah ${t.sizeRaw} ${t.brand}`} title={`Ubah ${t.sizeRaw} ${t.brand}`} description={`Ring ${t.ring}, ${t.cabangId === null ? 'tanpa cabang' : `cabang ${namaCabang(t.cabangId)}`}. Perubahan stok tercatat di buku stok sebagai koreksi.`}>
                <form action={saveStockRow}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <FormGrid>
                    <TextField label="Harga asli (Rp)" name="price" defaultValue={t.price ?? ''} inputMode="numeric" placeholder="kosong" hint="Kosongkan kalau belum ada harga." />
                    <TextField label="Potongan (Rp)" name="discount" defaultValue={t.discount || ''} inputMode="numeric" placeholder="0" />
                    <TextField label="Stok" name="stock" defaultValue={t.stock} inputMode="numeric" required />
                    <TextField label="Keterangan" name="note" defaultValue={t.note} maxLength={200} />
                    <CheckField className="sm:col-span-2" label="Kunci baris ini" name="lock" defaultChecked={t.manual ? t.lockManual : true} hint="Sinkron dan impor berikutnya tidak menimpa harga, potongan, stok, dan keterangan baris ini." />
                  </FormGrid>
                  <FormActions><CloseButton /><SubmitButton>Simpan baris</SubmitButton></FormActions>
                </form>
              </Drawer>
            )}
            empty={<Empty title="Tidak ada baris stok" action={q || f || cb || ring ? <Link href="/admin/stok-ban" className="adm-btn-line">Hapus saringan</Link> : undefined}>{q || f || cb || ring ? 'Ubah pencarian dan saringan.' : 'Isi stok dulu lewat tombol Perbarui dari pricelist.'}</Empty>}
          />
        )}
        {!banding && <Halaman hal={halaman} total={count} per={BATAS} href={(n) => params({ hal: n > 1 ? String(n) : '' })} />}
        {banding && grup.length > 300 && <p className="text-xs text-mute">Menampilkan 300 dari {grup.length}. Persempit dengan pencarian atau ring.</p>}
      </section>
    </PageBody>
  )
}
