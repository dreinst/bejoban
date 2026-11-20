import { db } from '../db'
import { normCity } from './calc'
import type { Carrier, Rate, RateSource } from './types'

type Row = Awaited<ReturnType<typeof db.shippingRate.findMany>>[number]
const toRate = (r: Row): Rate => ({
  carrier: r.carrier as Carrier,
  city: r.city,
  perKg: r.perKg,
  minWeight: r.minWeight,
  etaDays: r.etaDays,
  note: r.note,
  isSample: r.isSample,
})

// Sumber tarif dari tabel isian admin.
export const dbRateSource: RateSource = {
  id: 'tabel-admin',
  label: 'Tabel tarif isian admin',
  async getRate(carrier, city) {
    const rows = await db.shippingRate.findMany({ where: { carrier }, orderBy: { id: 'asc' } })
    const want = normCity(city)
    const hit = rows.find((r) => normCity(r.city) === want)
    return hit ? toRate(hit) : null
  },
  async listCities() {
    const rows = await db.shippingRate.findMany({ select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' } })
    return rows.map((r) => r.city)
  },
}

export async function loadShippingSettings() {
  const { mergeSettings } = await import('./calc')
  const row = await db.setting.findUnique({ where: { key: 'ongkir' } })
  return mergeSettings(row ? JSON.parse(row.value) : null)
}
