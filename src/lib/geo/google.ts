import type { GeoProvider, Place } from './types'

type GComp = { long_name: string; types: string[] }
type GResult = { formatted_address: string; address_components: GComp[]; geometry: { location: { lat: number; lng: number } } }

const pick = (c: GComp[], ...types: string[]) => c.find((x) => types.some((t) => x.types.includes(t)))?.long_name ?? ''

export function mapGoogle(results: GResult[]): Place[] {
  return results.map((r) => ({
    name: r.address_components[0]?.long_name ?? r.formatted_address.split(',')[0],
    kecamatan: pick(r.address_components, 'administrative_area_level_3'),
    city: pick(r.address_components, 'administrative_area_level_2', 'locality'),
    province: pick(r.address_components, 'administrative_area_level_1'),
    lat: r.geometry.location.lat,
    lon: r.geometry.location.lng,
    display: r.formatted_address,
  }))
}

// Aktif kalau GOOGLE_MAPS_API_KEY diisi di .env. Belum dipakai secara bawaan.
export const googleProvider = (key: string): GeoProvider => ({
  id: 'google-geocoding',
  async search(query) {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.search = new URLSearchParams({ address: query, region: 'id', language: 'id', key }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`Penyedia lokasi menjawab ${res.status}`)
    const body = (await res.json()) as { status: string; results: GResult[] }
    if (body.status !== 'OK' && body.status !== 'ZERO_RESULTS') throw new Error(`Google Maps: ${body.status}`)
    return mapGoogle(body.results.slice(0, 5))
  },
})
