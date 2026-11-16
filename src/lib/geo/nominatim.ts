import type { GeoProvider, Place } from './types'
import { throttled } from './throttle'
import { precisionKnown } from './address'

type NomItem = { name?: string; display_name?: string; lat: string; lon: string; addresstype?: string; address?: Record<string, string> }

// Alamat Nominatim untuk Indonesia: municipality biasanya kecamatan, suburb kelurahan,
// city atau county kota atau kabupaten.
export function mapNominatim(items: NomItem[]): Place[] {
  return items
    .map((it) => {
      const a = it.address ?? {}
      const city = a.city || a.county || a.town || a.regency || a.state_district || ''
      return {
        name: it.name || (it.display_name ?? '').split(',')[0].trim(),
        kecamatan: a.city_district || a.district || a.subdistrict || a.municipality || a.suburb || a.village || (['town', 'village', 'municipality'].includes(it.addresstype ?? '') ? (it.name ?? '') : ''),
        city,
        province: a.state || a.region || '',
        lat: Number(it.lat),
        lon: Number(it.lon),
        display: it.display_name ?? '',
        precision: precisionKnown(it.addresstype),
      }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
}

export const nominatim: GeoProvider = {
  id: 'osm-nominatim',
  search(query) {
    // Jeda 1,1 detik antar permintaan (aturan pakai Nominatim), User-Agent generik.
    return throttled(async () => {
      const url = new URL('https://nominatim.openstreetmap.org/search')
      url.search = new URLSearchParams({ q: query, format: 'jsonv2', addressdetails: '1', countrycodes: 'id', limit: '5', 'accept-language': 'id' }).toString()
      const res = await fetch(url, { headers: { 'User-Agent': 'BejoBanInternalTool/1.0' }, signal: AbortSignal.timeout(10_000) })
      if (!res.ok) throw new Error(`Penyedia lokasi menjawab ${res.status}`)
      return mapNominatim((await res.json()) as NomItem[])
    })
  },
}
