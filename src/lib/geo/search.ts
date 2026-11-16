import { db } from '../db'
import { googleProvider } from './google'
import { nominatim } from './nominatim'
import type { GeoProvider, Place } from './types'

export function getGeoProvider(): GeoProvider {
  const key = process.env.GOOGLE_MAPS_API_KEY
  return key ? googleProvider(key) : nominatim
}

const TTL_MS = 30 * 24 * 3600_000

// Hasil dicari di cache dulu. Cache tersimpan di database supaya permintaan yang sama tidak diulang.
export async function searchPlaces(raw: string): Promise<{ places: Place[]; cached: boolean; provider: string; error?: string }> {
  const query = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
  const provider = getGeoProvider()
  if (query.length < 3) return { places: [], cached: false, provider: provider.id, error: 'Ketik minimal 3 huruf.' }
  const hit = await db.geoCache.findUnique({ where: { provider_query: { provider: provider.id, query } } })
  if (hit && Date.now() - hit.createdAt.getTime() < TTL_MS) return { places: JSON.parse(hit.results), cached: true, provider: provider.id }
  try {
    const places = await provider.search(query)
    await db.geoCache.upsert({
      where: { provider_query: { provider: provider.id, query } },
      create: { provider: provider.id, query, results: JSON.stringify(places) },
      update: { results: JSON.stringify(places), createdAt: new Date() },
    })
    return { places, cached: false, provider: provider.id }
  } catch (e) {
    return { places: [], cached: false, provider: provider.id, error: (e as Error).message }
  }
}
