// Penghubung engine dengan database. Dipakai halaman admin dan skrip worker.
import { db } from '../db'
import { answer, type Answer, type ShipRequest, type Tire } from './engine'
import { mergeBot, type BotSettings } from './policy'
import { calcQuote, normCity } from '../ongkir/calc'
import { loadShippingSettings } from '../ongkir/db-source'
import { summaryText } from '../ongkir/format'
import { CARRIERS, type Rate } from '../ongkir/types'

export async function loadBotSettings(): Promise<BotSettings> {
  const row = await db.setting.findUnique({ where: { key: 'bot' } })
  return mergeBot(row ? JSON.parse(row.value) : null)
}

export async function respond(text: string): Promise<Answer> {
  const tires: Tire[] = await db.stockTire.findMany({
    select: { id: true, ring: true, sizeRaw: true, sizeNorm: true, brand: true, price: true, stock: true, note: true },
  })
  const settings = await loadShippingSettings()
  const rates = await db.shippingRate.findMany()
  const shipQuote = (r: ShipRequest) => {
    const quotes = CARRIERS.map((c) => {
      const hit = rates.find((x) => x.carrier === c && normCity(x.city) === normCity(r.city))
      const rate: Rate | null = hit ? { ...hit, carrier: c } : null
      return calcQuote(c, r.city, rate, { tires: { count: r.qty, ring: r.ring }, usePacking: true }, settings)
    })
    if (quotes.some((q) => q.status === 'NO_PACK')) return null
    return summaryText(quotes, `${r.qty} ban ${r.sizeLabel} ke ${r.city}`, settings.origin)
  }
  return answer(text, tires, { shipQuote })
}
