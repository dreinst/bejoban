import type { GeoProvider, Place } from './types'
import { throttled } from './throttle'
import { precisionKnown } from './address'

type Feature = {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; street?: string; district?: string; locality?: string; city?: string; county?: string; state?: string; countrycode?: string; type?: string }
}

export function mapPhoton(features: Feature[]): Place[] {
  return features
    .filter((f) => (f.properties.countrycode ?? 'ID') === 'ID')
    .map((f) => {
      const p = f.properties
      const [lon, lat] = f.geometry.coordinates
      return {
        name: p.name || p.street || p.district || p.city || '',
        kecamatan: p.district || p.locality || '',
        city: p.city || p.county || '',
        province: p.state || '',
        lat,
        lon,
        display: [p.name || p.street, p.district, p.city || p.county, p.state].filter(Boolean).join(', '),
        precision: precisionKnown(p.type),
      }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

// Cadangan kalau Nominatim kosong. Server publik komoot, tanpa kunci, dipakai hemat (satu permintaan per kueri, dengan jeda).
export const photon: GeoProvider = {
  id: 'osm-photon',
  search(query) {
    return throttled(async () => {
      const url = new URL('https://photon.komoot.io/api/')
      url.search = new URLSearchParams({ q: query, limit: '5', lang: 'en' }).toString()
      const res = await fetch(url, { headers: { 'User-Agent': 'BejoBanInternalTool/1.0' }, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`Penyedia cadangan menjawab ${res.status}`)
      return mapPhoton(((await res.json()) as { features: Feature[] }).features ?? [])
    })
  },
}
