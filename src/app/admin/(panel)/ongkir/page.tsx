import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { calcQuote } from '@/lib/ongkir/calc'
import { dbRateSource, loadShippingSettings } from '@/lib/ongkir/db-source'
import { summaryText } from '@/lib/ongkir/format'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL, type Quote, type QuoteInput } from '@/lib/ongkir/types'
import { searchPlaces } from '@/lib/geo/search'
import { matchCity } from '@/lib/geo/match'
import { distanceKm } from '@/lib/geo/distance'
import type { Place } from '@/lib/geo/types'
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
  const [settings, cities, sizes, branches] = await Promise.all([
    loadShippingSettings(),
    dbRateSource.listCities(),
    db.stockTire.groupBy({ by: ['sizeNorm', 'sizeRaw', 'ring'], orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }] }),
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
  ])
  const uniqSizes = [...new Map(sizes.map((s) => [s.sizeNorm, s])).values()]
  const mode = ['velg', 'manual'].includes(one('mode')) ? one('mode') : 'stok'
  const size = one('size')
  const qty = Math.min(Math.round(num(one('qty'))) || 1, 200)
  const usePacking = one('packing') === '1'
  const tire = uniqSizes.find((s) => s.sizeNorm === size)
  const kg = num(one('kg'))
  const dims = { l: num(one('pl')), w: num(one('lb')), h: num(one('tg')) }
  const cabang = branches.find((b) => b.slug === one('cabang')) ?? branches[0]
  const originLabel = cabang ? cabang.name.replace(/\s*\(.*\)/, '') : settings.origin
  const q = one('q').trim().slice(0, 120)
  const pickIdx = one('pick') === '' ? -1 : Number(one('pick'))
  const cityText = one('city').trim().slice(0, 60)

  // Pencarian lokasi lewat server (OpenStreetMap secara bawaan), hasilnya di-cache di database.
  const geo = q ? await searchPlaces(q) : null
  const place: Place | null = geo && pickIdx >= 0 ? (geo.places[pickIdx] ?? null) : null
  const match = place ? matchCity(place, cities) : null
  const city = place ? (match?.city ?? place.city) : cityText
  const origin = cabang ? settings.origins[cabang.slug] : undefined
  const km = place && origin?.lat != null && origin?.lon != null ? distanceKm({ lat: origin.lat, lon: origin.lon }, place) : null

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
    } else if (mode === 'velg') {
      input = { velg: { count: qty }, usePacking }
      desc = `${qty} velg ke ${city}`
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
  const text = quotes.length ? summaryText(quotes, desc, originLabel) : ''
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams()
    for (const k of ['mode', 'size', 'qty', 'kg', 'pl', 'lb', 'tg', 'packing', 'cabang', 'q', 'city']) if (one(k)) p.set(k, one(k))
    for (const [k, v] of Object.entries(patch)) p.set(k, v)
    return `/admin/ongkir?${p}`
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">Estimasi ongkir</h1>
        {user.role === 'OWNER' && (
          <Link href="/admin/ongkir/tarif" className="rounded-lg border border-ink px-4 py-2 text-sm font-semibold text-ink">Tarif dan pengaturan</Link>
        )}
      </div>
      <p className="text-sm text-neutral-500">
        J&amp;T Cargo dan Baraka Express melayani pengiriman ke seluruh Indonesia. Tarif diisi admin dari daftar harga agen, belum ada sumber tarif otomatis. Angka berlabel &quot;{SAMPLE_LABEL}&quot; hanya untuk mencoba.
      </p>

      <Card title="Hitung">
        <form className="grid gap-3 md:grid-cols-4">
          <label className={labelCls}>Barang
            <select name="mode" defaultValue={mode} className={inputCls}>
              <option value="stok">Ban dari stok</option>
              <option value="velg">Velg</option>
              <option value="manual">Berat manual</option>
            </select>
          </label>
          <label className={`${labelCls} md:col-span-2`}>Ukuran ban (kalau dari stok)
            <select name="size" defaultValue={size} className={inputCls}>
              <option value="">{uniqSizes.length ? 'Pilih ukuran' : 'Stok kosong, impor dulu'}</option>
              {uniqSizes.map((s) => <option key={s.sizeNorm} value={s.sizeNorm}>{s.sizeRaw.trim()} (R{s.ring})</option>)}
            </select>
          </label>
          <label className={labelCls}>Jumlah
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
          <label className={labelCls}>Cabang asal
            <select name="cabang" defaultValue={cabang?.slug} className={inputCls}>
              {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name.replace(/\s*\(.*\)/, '')}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="packing" value="1" defaultChecked={usePacking} />
            Tambah packing ({rp(settings.packingPerTire)}/ban)
          </label>
          <label className={`${labelCls} md:col-span-3`}>Cari lokasi tujuan (kecamatan, kota, atau nama tempat)
            <input name="q" defaultValue={q} className={inputCls} placeholder="mis. Wonokromo Surabaya" />
          </label>
          <label className={labelCls}>Atau ketik kota di tabel tarif
            <input name="city" list="kota" defaultValue={cityText} className={inputCls} placeholder="mis. Surabaya" />
            <datalist id="kota">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <div className="md:col-span-4">
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">Cari lokasi dan hitung</button>
            <span className="ml-3 text-xs text-neutral-500">Pencarian hanya jalan saat tombol ditekan (aturan pakai OpenStreetMap), hasilnya disimpan di cache.</span>
          </div>
        </form>
      </Card>

      {geo?.error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Pencarian lokasi gagal: {geo.error}</p>}

      {geo && !geo.error && !place && (
        <Card title={`Hasil pencarian lokasi untuk "${q}"`}>
          {geo.places.length === 0 ? (
            <p className="text-sm text-neutral-500">Tidak ada lokasi yang cocok. Coba tulis kecamatan dan kota.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {geo.places.map((p, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <b>{p.name}</b>
                    <span className="block text-xs text-neutral-500">{[p.kecamatan && `Kec. ${p.kecamatan}`, p.city, p.province].filter(Boolean).join(', ')} · {p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span>
                  </span>
                  <Link href={href({ pick: String(i) })} className="rounded-lg border border-ink px-3 py-1.5 text-xs font-semibold text-ink">Pakai lokasi ini</Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">Sumber: {geo.provider}{geo.cached ? ' (dari cache)' : ''}. Data peta oleh kontributor OpenStreetMap.</p>
        </Card>
      )}

      {place && (
        <Card title="Lokasi tujuan">
          <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Tempat</dt><dd>{place.name}</dd>
            <dt className="text-neutral-500">Kecamatan</dt><dd>{place.kecamatan || '-'}</dd>
            <dt className="text-neutral-500">Kota atau kabupaten</dt><dd>{place.city || '-'}</dd>
            <dt className="text-neutral-500">Provinsi</dt><dd>{place.province || '-'}</dd>
            <dt className="text-neutral-500">Koordinat</dt><dd>{place.lat.toFixed(5)}, {place.lon.toFixed(5)}</dd>
            <dt className="text-neutral-500">Jarak dari {originLabel}</dt>
            <dd>{km !== null ? <>sekitar <b>{Math.round(km)} km</b> garis lurus (bukan jarak tempuh)</> : <>koordinat cabang belum diisi. <Link className="underline" href="/admin/ongkir/tarif#pengaturan">Isi di pengaturan</Link></>}</dd>
            <dt className="text-neutral-500">Cocok dengan tabel tarif</dt>
            <dd>
              {match?.city ? <>Ya, &quot;{match.city}&quot; (lewat {match.via})</> : (
                <>Belum ada tarif untuk {place.city || place.name}.{' '}
                  {user.role === 'OWNER' && <Link className="font-semibold underline" href={`/admin/ongkir/tarif?kota=${encodeURIComponent(place.city || place.name)}#baru`}>Tambah tarif untuk kota ini</Link>}
                </>
              )}
            </dd>
          </dl>
          <p className="mt-2 text-xs"><Link className="underline" href={href({ pick: '' })}>Pilih lokasi lain</Link></p>
        </Card>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      {quotes.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {quotes.map((q2) => (
              <Card key={q2.carrier} title={`${CARRIER_LABEL[q2.carrier]} ke ${q2.city}`}>
                {q2.status === 'NO_RATE' && (
                  <p className="text-sm font-semibold text-red-700">
                    Tarif belum diisi{' '}
                    {user.role === 'OWNER' && <Link className="underline" href={`/admin/ongkir/tarif?kota=${encodeURIComponent(q2.city)}#baru`}>Tambah tarif</Link>}
                  </p>
                )}
                {q2.status === 'NO_PACK' && <p className="text-sm font-semibold text-red-700">Ukuran kemasan ring ini belum diisi (pengaturan hanya R12 sampai R19)</p>}
                {q2.status === 'OK' && (
                  <div className="space-y-2 text-sm">
                    {q2.isSample && <p className="inline-block rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold text-white">{SAMPLE_LABEL}</p>}
                    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                      <dt>Berat asli</dt><dd>{q2.actualKg} kg</dd>
                      <dt>Berat volume</dt><dd>{q2.volumeKg} kg</dd>
                      <dt>Berat minimum tarif</dt><dd>{q2.minWeight} kg</dd>
                      <dt>Berat ditagih</dt><dd><b>{q2.billedKg} kg</b></dd>
                      <dt>Tarif per kg</dt><dd>{rp(q2.perKg)}</dd>
                      <dt>Ongkir</dt><dd>{rp(q2.shipping)}</dd>
                      <dt>Packing</dt><dd>{rp(q2.packing)}</dd>
                      <dt className="font-bold">Total</dt><dd className="text-lg font-black text-ink">{rp(q2.total)}</dd>
                      <dt>Estimasi</dt><dd>{q2.etaDays ? `${q2.etaDays} hari` : 'belum diisi'}</dd>
                    </dl>
                    {q2.notes.map((n) => <p key={n} className="text-xs text-neutral-500">{n}</p>)}
                    {q2.note && <p className="text-xs text-neutral-500">Catatan: {q2.note}</p>}
                  </div>
                )}
              </Card>
            ))}
          </div>
          <CopyButton text={text + (km !== null ? `\nJarak garis lurus sekitar ${Math.round(km)} km.` : '')} />
          <pre className="whitespace-pre-wrap rounded-lg bg-white p-4 text-xs text-neutral-700 shadow-sm">{text}</pre>
        </>
      )}
    </div>
  )
}
