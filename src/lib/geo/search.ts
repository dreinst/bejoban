import { db } from '../db'
import { buildLevels, type Level } from './address'
import { googleProvider } from './google'
import { nominatim } from './nominatim'
import { photon } from './photon'
import type { GeoProvider, Place } from './types'

export function getGeoProvider(): GeoProvider {
  const key = process.env.GOOGLE_MAPS_API_KEY
  return key ? googleProvider(key) : nominatim
}

export const TTL_MS = 30 * 24 * 3600_000 // hasil berisi
export const TTL_EMPTY_MS = 5 * 60_000 // hasil kosong hanya diingat sebentar

export type Attempt = { label: string; q: string; provider: string; count: number; cached: boolean; error?: string }
export type SearchResult = {
  places: Place[]
  provider: string
  cached: boolean
  level: Level | null // tingkat pencarian yang memberi hasil
  attempts: Attempt[]
  error?: string
}

type CacheRow = { results: string; createdAt: Date } | null

// Pure: apakah entri cache masih boleh dipakai.
export function cacheUsable(row: CacheRow, now = Date.now()) {
  if (!row) return false
  const empty = row.results === '[]'
  return now - row.createdAt.getTime() < (empty ? TTL_EMPTY_MS : TTL_MS)
}

async function lookup(provider: GeoProvider, q: string, fresh: boolean): Promise<{ places: Place[]; cached: boolean }> {
  const query = q.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
  const where = { provider_query: { provider: provider.id, query } }
  if (!fresh) {
    const hit = await db.geoCache.findUnique({ where })
    if (hit && cacheUsable(hit)) return { places: JSON.parse(hit.results), cached: true }
  }
  const places = await provider.search(query)
  await db.geoCache.upsert({
    where,
    create: { provider: provider.id, query, results: JSON.stringify(places) },
    update: { results: JSON.stringify(places), createdAt: new Date() },
  })
  return { places, cached: false }
}

// Menelusuri tingkat satu per satu dan berhenti di yang pertama memberi hasil. Fungsi `look` dipisah supaya bisa diuji tanpa jaringan.
export async function walkLevels(
  levels: Level[],
  look: (l: Level) => Promise<{ places: Place[]; cached: boolean }>,
  providerId: string,
  attempts: Attempt[],
): Promise<SearchResult | null> {
  for (const l of levels) {
    try {
      const r = await look(l)
      attempts.push({ label: l.label, q: l.q, provider: providerId, count: r.places.length, cached: r.cached })
      if (r.places.length) {
        const places = r.places.map((p) => ({ ...p, precision: p.precision ?? l.precision }))
        return { places, provider: providerId, cached: r.cached, level: l, attempts }
      }
    } catch (e) {
      attempts.push({ label: l.label, q: l.q, provider: providerId, count: 0, cached: false, error: (e as Error).message })
    }
  }
  return null
}

// Pencarian bertingkat: teks utuh dulu, lalu versi yang makin pendek, berhenti di yang pertama memberi hasil.
// Kalau Nominatim kosong di semua tingkat, Photon dicoba sebagai cadangan. `fresh` melewati cache.
export async function searchPlaces(raw: string, opts: { fresh?: boolean } = {}): Promise<SearchResult> {
  const main = getGeoProvider()
  const levels = buildLevels(raw)
  const attempts: Attempt[] = []
  if (raw.trim().length < 3 || !levels.length) return { places: [], provider: main.id, cached: false, level: null, attempts, error: 'Ketik minimal 3 huruf.' }

  const run = (provider: GeoProvider, ls: Level[]) => walkLevels(ls, (l) => lookup(provider, l.q, !!opts.fresh), provider.id, attempts)

  const found = await run(main, levels)
  if (found) return found
  // Cadangan: hanya tiga kueri (paling lengkap yang bersih, kecamatan, kota) supaya server publik tidak dibebani.
  if (main.id === nominatim.id) {
    const pick = levels.filter((l) => ['bersih', 'kecamatan', 'kota'].includes(l.key)).slice(0, 3)
    const second = await run(photon, pick.length ? pick : levels.slice(0, 1))
    if (second) return second
  }
  const failed = attempts.filter((a) => a.error).length
  return {
    places: [],
    provider: main.id,
    cached: attempts.every((a) => a.cached),
    level: null,
    attempts,
    error: failed === attempts.length ? `Penyedia lokasi tidak bisa dihubungi (${attempts[0]?.error})` : undefined,
  }
}
