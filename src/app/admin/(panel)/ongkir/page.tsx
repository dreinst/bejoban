import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { calcQuote } from '@/lib/ongkir/calc'
import { dbRateSource, loadShippingSettings } from '@/lib/ongkir/db-source'
import { summaryText } from '@/lib/ongkir/format'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL, type Quote, type QuoteInput } from '@/lib/ongkir/types'
import { CopyButton } from '@/components/admin/copy-button'
import { inputCls } from '@/components/admin/section-editor'
import { Card, labelCls } from '@/components/admin/simple-list'

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export default async function Ongkir({ searchParams }: PageProps<'/admin/ongkir'>) {
  const user = await requireUser()
  const sp = await searchParams
  const one = (k: string) => String(Array.isArray(sp[k]) ? sp[k][0] : (sp[k] ?? ''))
  const [settings, cities, sizes] = await Promise.all([
    loadShippingSettings(),
    dbRateSource.listCities(),
    db.stockTire.groupBy({ by: ['sizeNorm', 'sizeRaw', 'ring'], orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }] }),
  ])
  const uniqSizes = [...new Map(sizes.map((s) => [s.sizeNorm, s])).values()]
  const mode = one('mode') === 'manual' ? 'manual' : 'stok'
  const size = one('size')
  const qty = Math.min(Math.round(num(one('qty'))) || 1, 200)
  const city = one('city').trim().slice(0, 60)
  const usePacking = one('packing') === '1'
  const tire = uniqSizes.find((s) => s.sizeNorm === size)
  const kg = num(one('kg'))
  const dims = { l: num(one('pl')), w: num(one('lb')), h: num(one('tg')) }

  let input: QuoteInput | null = null
  let desc = ''
  let error = ''
  if (city) {
    if (mode === 'stok') {
      if (!tire) error = 'Pilih ukuran ban dari stok.'
      else {
        input = { tires: { count: qty, ring: tire.ring }, usePacking }
        desc = `${qty} ban ${tire.sizeRaw.trim()} ke ${city}`
      }
    } else if (!kg) error = 'Isi berat manual (kg).'
    else {
      input = { manualWeightKg: kg, manualDimsCm: dims.l && dims.w && dims.h ? dims : undefined, usePacking: false }
      desc = `paket ${kg} kg ke ${city}`
    }
  }
  let quotes: Quote[] = []
  if (input) {
    const inp = input
    quotes = await Promise.all(CARRIERS.map(async (c) => calcQuote(c, city, await dbRateSource.getRate(c, city), inp, settings)))
  }
  const text = quotes.length ? summaryText(quotes, desc, settings.origin) : ''

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Estimasi ongkir</h1>
        {user.role === 'OWNER' && (
          <Link href="/admin/ongkir/tarif" className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold text-ink">Tarif dan pengaturan</Link>
        )}
      </div>
      <p className="text-sm text-neutral-500">
        Tarif diisi admin dari daftar harga agen J&amp;T Cargo dan Baraka, belum ada sumber tarif otomatis. Angka berlabel &quot;{SAMPLE_LABEL}&quot; hanya untuk mencoba.
        {settings.origin && <> Asal kirim: <b>{settings.origin}</b>.</>}
      </p>

      <Card title="Hitung">
        <form className="grid gap-3 md:grid-cols-4">
          <label className={labelCls}>Sumber berat
            <select name="mode" defaultValue={mode} className={inputCls}>
              <option value="stok">Ban dari stok</option>
              <option value="manual">Berat manual</option>
            </select>
          </label>
          <label className={`${labelCls} md:col-span-2`}>Ukuran ban (kalau dari stok)
            <select name="size" defaultValue={size} className={inputCls}>
              <option value="">{uniqSizes.length ? 'Pilih ukuran' : 'Stok kosong, impor dulu'}</option>
              {uniqSizes.map((s) => <option key={s.sizeNorm} value={s.sizeNorm}>{s.sizeRaw.trim()} (R{s.ring})</option>)}
            </select>
          </label>
          <label className={labelCls}>Jumlah ban
            <input name="qty" type="number" min={1} max={200} defaultValue={qty} className={inputCls} />
          </label>
          <label className={labelCls}>Berat manual (kg)
            <input name="kg" defaultValue={kg || ''} inputMode="decimal" className={inputCls} />
          </label>
          <label className={labelCls}>Dimensi paket manual, cm (p, l, t)
            <span className="flex gap-1">
              <input name="pl" placeholder="p" defaultValue={dims.l || ''} className={inputCls} />
              <input name="lb" placeholder="l" defaultValue={dims.w || ''} className={inputCls} />
              <input name="tg" placeholder="t" defaultValue={dims.h || ''} className={inputCls} />
            </span>
          </label>
          <label className={`${labelCls} md:col-span-2`}>Kota tujuan
            <input name="city" list="kota" defaultValue={city} required className={inputCls} placeholder="mis. Surabaya" />
            <datalist id="kota">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="packing" value="1" defaultChecked={usePacking} />
            Tambah packing ({rp(settings.packingPerTire)}/ban)
          </label>
          <div className="md:col-span-4">
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Hitung ongkir</button>
          </div>
        </form>
      </Card>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      {quotes.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {quotes.map((q) => (
              <Card key={q.carrier} title={`${CARRIER_LABEL[q.carrier]} ke ${q.city}`}>
                {q.status === 'NO_RATE' && <p className="text-sm font-semibold text-red-700">Tarif belum diisi</p>}
                {q.status === 'NO_PACK' && <p className="text-sm font-semibold text-red-700">Ukuran kemasan ring ini belum diisi (pengaturan hanya R12 sampai R19)</p>}
                {q.status === 'OK' && (
                  <div className="space-y-2 text-sm">
                    {q.isSample && <p className="inline-block rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold text-white">{SAMPLE_LABEL}</p>}
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                      <dt>Berat asli</dt><dd>{q.actualKg} kg</dd>
                      <dt>Berat volume</dt><dd>{q.volumeKg} kg</dd>
                      <dt>Berat minimum tarif</dt><dd>{q.minWeight} kg</dd>
                      <dt>Berat ditagih</dt><dd><b>{q.billedKg} kg</b></dd>
                      <dt>Tarif per kg</dt><dd>{rp(q.perKg)}</dd>
                      <dt>Ongkir</dt><dd>{rp(q.shipping)}</dd>
                      <dt>Packing</dt><dd>{rp(q.packing)}</dd>
                      <dt className="font-bold">Total</dt><dd className="text-lg font-black text-ink">{rp(q.total)}</dd>
                      <dt>Estimasi</dt><dd>{q.etaDays ? `${q.etaDays} hari` : 'belum diisi'}</dd>
                    </dl>
                    {q.note && <p className="text-xs text-neutral-500">Catatan: {q.note}</p>}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <CopyButton text={text} />
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-4 text-xs text-neutral-700 shadow-sm">{text}</pre>
        </>
      )}
    </div>
  )
}
