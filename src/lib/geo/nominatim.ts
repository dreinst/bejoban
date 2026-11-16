import type { GeoProvider, Place } from './types'

type NomItem = { name?: string; display_name?: string; lat: string; lon: string; address?: Record<string, string> }

// Alamat Nominatim untuk Indonesia: municipality biasanya kecamatan, suburb kelurahan,
// city atau county kota atau kabupaten.
export function mapNominatim(items: NomItem[]): Place[] {
  return items
    .map((it) => {
      const a = it.address ?? {}
      const city = a.city || a.county || a.town || a.regency || a.state_district || ''
      return {
        name: it.name || (it.display_name ?? '').split(',')[0].trim(),
        kecamatan: a.city_district || a.district || a.subdistrict || a.municipality || a.suburb || a.village || '',
        city,
        province: a.state || a.region || '',
        lat: Number(it.lat),
        lon: Number(it.lon),
        display: it.display_name ?? '',
      }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

// Aturan pakai Nominatim: paling banyak 1 permintaan per detik, User-Agent yang jelas, hasil di-cache.
// Permintaan diserialkan dan diberi jeda di sini; cache ada di search.ts.
let chain: Promise<unknown> = Promise.resolve()
let last = 0
const GAP_MS = 1100

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = last + GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    try {
      return await fn()
    } finally {
      last = Date.now()
    }
  })
  chain = run.catch(() => null)
  return run
}

export const nominatim: GeoProvider = {
  id: 'osm-nominatim',
  search(query) {
    return throttled(async () => {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'id', limit: '5', 'accept-language': 'id' }).toString()
      const res = await fetch(url, { headers: { 'User-Agent': 'BejoBanInternalTool/1.0' }, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`Penyedia lokasi menjawab ${res.status}`)
      return mapNominatim((await res.json()) as NomItem[])
    })
  },
}
