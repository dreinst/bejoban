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
import { PageBody, PageHeader, Section } from '@/components/admin/ui'
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
    db.stockTire.groupBy({ by: ['sizeNorm', 'sizeRaw', 'ring', 'cabangId'], where: { aktif: true }, orderBy: [{ ring: 'asc' }, { sizeNorm: 'asc' }] }),
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { id: true, slug: true, name: true } }),
  ])
  // Ukuran per cabang asal: baris cabang itu ditambah baris tanpa cabang (slug kosong) selama masih ada.
  const slugOf = (id: number | null) => (id === null ? '' : (branches.find((b) => b.id === id)?.slug ?? `#${id}`))
  const bySize = new Map<string, { sizeNorm: string; sizeRaw: string; ring: number; cabang: string[] }>()
  for (const s of sizes) {
    const g = bySize.get(s.sizeNorm) ?? { sizeNorm: s.sizeNorm, sizeRaw: s.sizeRaw, ring: s.ring, cabang: [] }
    if (!g.cabang.includes(slugOf(s.cabangId))) g.cabang.push(slugOf(s.cabangId))
    bySize.set(s.sizeNorm, g)
  }
  const allSizes = [...bySize.values()]
  const mode = ['velg', 'manual'].includes(one('mode')) ? one('mode') : 'stok'
  const size = one('size')
  const qty = Math.min(Math.round(num(one('qty'))) || 1, 200)
  const usePacking = one('packing') === '1'
  // Cabang asal bawaan: pilihan di alamat, lalu cabang si admin (admin cabang), lalu cabang pertama.
  const cabang = branches.find((b) => b.slug === one('cabang')) ?? (user.role === 'OWNER' ? undefined : branches.find((b) => b.id === user.branchId)) ?? branches[0]
  const adaDiCabang = (x: { cabang: string[] }) => x.cabang.includes('') || (!!cabang && x.cabang.includes(cabang.slug))
  const tire = allSizes.find((s) => s.sizeNorm === size && adaDiCabang(s))
  const kg = num(one('kg'))
  const dims = { l: num(one('pl')), w: num(one('lb')), h: num(one('tg')) }
  const originLabel = cabang ? cabang.name.replace(/\s*\(.*\)/, '') : settings.origin
  const q = one('q').trim().slice(0, 120)
  const pickIdx = one('pick') === '' ? -1 : Number(one('pick'))
  const cityText = one('city').trim().slice(0, 60)

  // Pencarian lokasi lewat server (OpenStreetMap secara bawaan), hasilnya disimpan sementara di database.
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
      if (!tire) error = 'Pilih ukuran ban dari stok cabang asal.'
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

  // Setelah ada hasil (atau daftar lokasi untuk dipilih), hasil tampil di atas dan form dilipat jadi satu baris "Ubah".
  const adaHasil = quotes.length > 0 || (!!geo && !place && geo.places.length > 0)
  const form = (
    <OngkirForm
      d={{ mode, size, qty, kg: kg ? String(kg) : '', pl: dims.l ? String(dims.l) : '', lb: dims.w ? String(dims.w) : '', tg: dims.h ? String(dims.h) : '', cabang: cabang?.slug ?? '', packing: usePacking, q, city: cityText }}
      sizes={allSizes}
      cities={cities}
      branches={branches.map((b) => ({ slug: b.slug, name: b.name }))}
      packingFee={rp(settings.packingPerTire)}
    />
  )
  const wilayah = place ? [place.kecamatan && `Kec. ${place.kecamatan}`, place.city, place.province].filter(Boolean).join(', ') : ''

  return (
    <PageBody>
      <PageHeader
        title="Hitung ongkir"
        note={<>Hitung ongkir J&amp;T Cargo dan Baraka Express ke seluruh Indonesia dari tarif agen. Angka berlabel &quot;{SAMPLE_LABEL}&quot; hanya untuk mencoba.</>}
      />

      {adaHasil && (
        <p className="text-sm text-mute">
          {desc ? <>Menghitung <b className="text-ink">{desc}</b> dari {originLabel}.</> : <>Dari {originLabel}.</>}
        </p>
      )}

      {adaHasil ? (
        <details id="form" className="adm-card px-5 py-1">
          <summary className="adm-sum flex min-h-12 cursor-pointer items-center font-display text-base font-extrabold text-ink">Ubah perhitungan</summary>
          <div className="max-w-[760px] pb-5 pt-2">{form}</div>
        </details>
      ) : (
        <Section title="Hitung">
          <div className="max-w-[760px]">{form}</div>
        </Section>
      )}

      {geo && !place && (
        <Section title={geo.places.length ? `Pilih lokasi untuk "${q.length > 60 ? q.slice(0, 60) + '...' : q}"` : 'Lokasi tidak ketemu'}>
          {geo.places.length === 0 ? (
            <div className="space-y-3 text-sm">
              <p className={geo.error ? 'font-semibold text-red-700' : 'text-neutral-700'}>
                {geo.error ? 'Pencarian lokasi sedang gagal. Coba lagi sebentar lagi, atau pilih kota dari tabel tarif.' : 'Tidak ada lokasi yang cocok.'}
              </p>
              <p className="text-neutral-700">Coba tulis kecamatan dan kota saja, tekan &quot;Cari lagi tanpa simpanan&quot;, atau pilih kota langsung dari tabel tarif:</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((c) => <Link key={c} href={href({ q: '', city: c })} className="inline-flex min-h-9 items-center rounded-full border border-ink px-3 py-1 text-xs font-semibold text-ink max-md:min-h-11">{c}</Link>)}
                {!cities.length && <span className="text-xs text-neutral-500">Tabel tarif masih kosong.</span>}
              </div>
            </div>
          ) : (
            <>
              {geo.level && geo.level.key !== 'utuh' && (
                <p className="mb-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
                  Alamat lengkap tidak ketemu. Hasil ini dari pencarian &quot;{geo.level.q}&quot;.
                </p>
              )}
              <ul className="divide-y divide-neutral-100">
                {geo.places.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <b>{p.name}</b>
                      <span className="ml-2 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{PRECISION_LABEL[p.precision ?? 'kota']}</span>
                      <span className="block text-xs text-neutral-500">{[p.kecamatan && `Kec. ${p.kecamatan}`, p.city, p.province].filter(Boolean).join(', ')}</span>
                    </span>
                    <Link href={href({ pick: String(i) })} className="adm-btn-line adm-btn-sm">Pakai lokasi ini</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-[11px] text-neutral-500">Data peta © kontributor OpenStreetMap.</p>
        </Section>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      {quotes.length > 0 && (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {quotes.map((q2) => (
              <Section key={q2.carrier} title={`${CARRIER_LABEL[q2.carrier]} ke ${q2.city}`}>
                {q2.status === 'NO_RATE' && (
                  <p className="text-sm font-semibold text-red-700">
                    Tarif belum diisi{' '}
                    {user.role === 'OWNER' && <Link className="underline" href={`/admin/ongkir/tarif?kota=${encodeURIComponent(q2.city)}#baru`}>Tambah tarif</Link>}
                  </p>
                )}
                {q2.status === 'NO_PACK' && <p className="text-sm font-semibold text-red-700">Ukuran kemasan ring ini belum diisi (pengaturan hanya untuk R12 sampai R19).</p>}
                {q2.status === 'OK' && (
                  <div className="space-y-3 text-sm">
                    {q2.isSample && <p className="inline-block rounded bg-neutral-900 px-2 py-0.5 text-xs font-bold text-white">{SAMPLE_LABEL}</p>}
                    <div>
                      <p className="text-xs text-mute">Total</p>
                      <p className="font-display text-3xl font-black leading-tight text-ink">{rp(q2.total)}</p>
                      <p className="mt-1 text-sm text-ink">Estimasi {q2.etaDays ? `${q2.etaDays} hari` : 'belum diisi'}</p>
                    </div>
                    <details className="rounded-lg border border-line px-3 py-1">
                      <summary className="adm-sum flex min-h-10 cursor-pointer items-center text-sm font-semibold text-ink max-md:min-h-11">Rincian</summary>
                      <dl className="mb-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
                        <dt>Berat asli</dt><dd>{q2.actualKg} kg</dd>
                        <dt>Berat volume</dt><dd>{q2.volumeKg} kg</dd>
                        <dt>Berat minimum tarif</dt><dd>{q2.minWeight} kg</dd>
                        <dt>Berat ditagih</dt><dd><b>{q2.billedKg} kg</b></dd>
                        <dt>Tarif per kg</dt><dd>{rp(q2.perKg)}</dd>
                        <dt>Ongkir</dt><dd>{rp(q2.shipping)}</dd>
                        <dt>Packing</dt><dd>{rp(q2.packing)}</dd>
                      </dl>
                      <p className="mb-2 text-xs text-neutral-600">Sumber berat: {q2.source}</p>
                    </details>
                    {q2.notes.map((n) => <p key={n} className="text-xs text-neutral-500">{n}</p>)}
                    {q2.note && <p className="text-xs text-neutral-500">Catatan: {q2.note}</p>}
                  </div>
                )}
              </Section>
            ))}
          </div>
          <CopyButton text={text + (km !== null ? `\nJarak garis lurus sekitar ${Math.round(km)} km.` : '')} />
        </>
      )}

      {place && (
        <Section title="Lokasi tujuan">
          <dl className="grid gap-y-1 text-sm sm:grid-cols-[190px_1fr]">
            <dt className="text-neutral-500">Tempat</dt><dd>{place.name}</dd>
            {wilayah && (<><dt className="text-neutral-500">Wilayah</dt><dd>{wilayah}</dd></>)}
            <dt className="text-neutral-500">Ketepatan</dt>
            <dd><b>{PRECISION_LABEL[place.precision ?? 'kota']}</b>{place.precision === 'kota' || place.precision === 'provinsi' ? ' (jarak ke titik pusat wilayah, cukup untuk tarif)' : place.precision === 'kecamatan' ? ' (jarak ke titik pusat kecamatan)' : ''}</dd>
            <dt className="text-neutral-500">Jarak dari {originLabel}</dt>
            <dd>{km !== null ? <>sekitar <b>{Math.round(km)} km</b> garis lurus (bukan jarak tempuh)</> : <>titik cabang belum diisi.{' '}{user.role === 'OWNER' ? <Link className="underline" href="/admin/ongkir/pengaturan#asal">Isi di tab Pengaturan</Link> : 'Minta owner mengisinya.'}</>}</dd>
            <dt className="text-neutral-500">Cocok dengan tabel tarif</dt>
            <dd>
              {match?.city ? <>Ya, &quot;{match.city}&quot;</> : (
                <>Belum ada tarif untuk {place.city || place.name}.{' '}
                  {user.role === 'OWNER' && <Link className="font-semibold underline" href={`/admin/ongkir/tarif?kota=${encodeURIComponent(place.city || place.name)}#baru`}>Tambah tarif untuk kota ini</Link>}
                </>
              )}
            </dd>
          </dl>
          <p className="mt-2 text-xs"><Link className="underline" href={href({ pick: '' })}>Pilih lokasi lain</Link></p>
        </Section>
      )}

    </PageBody>
  )
}
