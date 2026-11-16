import Link from 'next/link'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { calcQuote } from '@/lib/ongkir/calc'
import { dbRateSource, loadShippingSettings } from '@/lib/ongkir/db-source'
import { summaryText } from '@/lib/ongkir/format'
import { CARRIERS, CARRIER_LABEL, SAMPLE_LABEL, type Quote, type QuoteInput } from '@/lib/ongkir/types'
import { searchPlaces } from '@/lib/geo/search'
import { PRECISION_LABEL } from '@/lib/geo/address'
import { matchCity } from '@/lib/geo/match'
import { distanceKm } from '@/lib/geo/distance'
import type { Place } from '@/lib/geo/types'
import { CopyButton } from '@/components/admin/copy-button'
import { Card } from '@/components/admin/simple-list'
import { OngkirForm } from '@/components/admin/ongkir-form'

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
    db.stockTire.groupBy({ by: ['sizeNorm', 'sizeRaw', 'ring'], where: { aktif: true }, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }] }),
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
  const geo = q ? await searchPlaces(q, { fresh: one('fresh') === '1' }) : null
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
          <Link href="/admin/ongkir/tarif" className="adm-btn-line">Tarif dan pengaturan</Link>
        )}
      </div>
      <p className="text-sm text-neutral-500">
        J&amp;T Cargo dan Baraka Express melayani pengiriman ke seluruh Indonesia. Tarif diisi admin dari daftar harga agen, belum ada sumber tarif otomatis. Angka berlabel &quot;{SAMPLE_LABEL}&quot; hanya untuk mencoba.
      </p>

      <Card title="Hitung">
        <OngkirForm
          d={{ mode, size, qty, kg: kg ? String(kg) : '', pl: dims.l ? String(dims.l) : '', lb: dims.w ? String(dims.w) : '', tg: dims.h ? String(dims.h) : '', cabang: cabang?.slug ?? '', packing: usePacking, q, city: cityText }}
          sizes={uniqSizes}
          cities={cities}
          branches={branches}
          packingFee={rp(settings.packingPerTire)}
        />
      </Card>

      {geo && !place && (
        <Card title={geo.places.length ? `Hasil pencarian lokasi untuk "${q.length > 60 ? q.slice(0, 60) + '...' : q}"` : 'Lokasi tidak ketemu'}>
          {geo.places.length === 0 ? (
            <div className="space-y-3 text-sm">
              <p className={geo.error ? 'font-semibold text-red-700' : 'text-neutral-700'}>
                {geo.error ? `Pencarian lokasi gagal: ${geo.error}.` : 'Tidak ada lokasi yang cocok di semua tingkat pencarian.'}
              </p>
              <div>
                <p className="text-xs font-semibold text-neutral-600">Yang sudah dicoba:</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-neutral-600">
                  {geo.attempts.map((a, i) => (
                    <li key={i}>{a.label} ({a.provider}): &quot;{a.q}&quot; {a.error ? `gagal, ${a.error}` : `0 hasil${a.cached ? ', dari cache' : ''}`}</li>
                  ))}
                </ol>
              </div>
              <p className="text-neutral-700">Coba tulis kecamatan dan kota saja, tekan &quot;Cari ulang&quot;, atau pilih kota langsung dari tabel tarif:</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((c) => <Link key={c} href={href({ q: '', city: c })} className="rounded-full border border-ink px-3 py-1 text-xs font-semibold text-ink">{c}</Link>)}
                {!cities.length && <span className="text-xs text-neutral-500">Tabel tarif masih kosong.</span>}
              </div>
            </div>
          ) : (
            <>
              {geo.level && geo.level.key !== 'utuh' && (
                <p className="mb-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
                  Teks utuh tidak ketemu. Hasil ini dari pencarian &quot;{geo.level.label}&quot;: &quot;{geo.level.q}&quot;.
                </p>
              )}
              <ul className="divide-y divide-neutral-100">
                {geo.places.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <b>{p.name}</b>
                      <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{PRECISION_LABEL[p.precision ?? 'kota']}</span>
                      <span className="block text-xs text-neutral-500">{[p.kecamatan && `Kec. ${p.kecamatan}`, p.city, p.province].filter(Boolean).join(', ')} · {p.lat.toFixed(4)}, {p.lon.toFixed(4)}</span>
                    </span>
                    <Link href={href({ pick: String(i) })} className="adm-btn-line adm-btn-sm">Pakai lokasi ini</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-xs text-neutral-500">Sumber: {geo.provider}{geo.cached ? ' (dari cache)' : ''}. Data peta oleh kontributor OpenStreetMap.</p>
        </Card>
      )}

      {place && (
        <Card title="Lokasi tujuan">
          <dl className="grid grid-cols-[160px_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Ketepatan</dt>
            <dd><b>{PRECISION_LABEL[place.precision ?? 'kota']}</b>{place.precision === 'kota' || place.precision === 'provinsi' ? ': jarak dihitung ke titik pusat wilayah, bukan alamat persis. Untuk tarif, kota atau kabupaten yang cocok sudah cukup.' : place.precision === 'kecamatan' ? ': jarak dihitung ke titik pusat kecamatan.' : ': jarak dihitung ke titik alamat.'}</dd>
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
                    <p className="text-xs text-neutral-600">Sumber berat: {q2.source}</p>
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
