// Mencocokkan hasil pencarian lokasi dengan kota di tabel tarif. Modul murni.
import { normCity } from '../ongkir/calc'
import type { Place } from './types'

export type CityMatch = { city: string | null; via: 'kecamatan' | 'kota' | 'nama' | null; tried: string[] }

// Urutan dari yang paling spesifik: kecamatan, kota atau kabupaten, lalu nama tempat.
// Kecocokan harus sama persis setelah awalan "Kota", "Kab.", "Kabupaten" dibuang, tidak ditebak.
export function matchCity(place: Place, rateCities: string[]): CityMatch {
  const cands: [CityMatch['via'], string][] = [
    ['kecamatan', place.kecamatan],
    ['kota', place.city],
    ['nama', place.name],
  ]
  const tried = cands.map(([, v]) => v).filter(Boolean)
  for (const [via, v] of cands) {
    if (!v) continue
    const hit = rateCities.find((c) => normCity(c) === normCity(v))
    if (hit) return { city: hit, via, tried }
  }
  return { city: null, via: null, tried }
}
