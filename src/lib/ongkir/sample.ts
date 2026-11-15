import { db } from '../db'

// Isi awal bertanda CONTOH supaya kalkulator bisa dicoba. Bukan tarif asli.
export async function ensureSampleRates() {
  if (await db.shippingRate.count()) return
  const rows: [string, string, number, number, string][] = [
    ['JNT_CARGO', 'Surabaya', 4500, 10, '2-3'],
    ['JNT_CARGO', 'Jakarta', 6000, 10, '3-4'],
    ['JNT_CARGO', 'Bandung', 5800, 10, '3-4'],
    ['BARAKA', 'Surabaya', 4200, 10, '3-4'],
    ['BARAKA', 'Jakarta', 5600, 15, '4-5'],
  ]
  for (const [carrier, city, perKg, minWeight, etaDays] of rows)
    await db.shippingRate.create({ data: { carrier, city, perKg, minWeight, etaDays, note: 'CONTOH', isSample: true } })
}
