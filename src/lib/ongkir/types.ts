export const CARRIERS = ['JNT_CARGO', 'BARAKA'] as const
export type Carrier = (typeof CARRIERS)[number]
export const CARRIER_LABEL: Record<Carrier, string> = { JNT_CARGO: 'J&T Cargo', BARAKA: 'Baraka' }

export const SAMPLE_LABEL = 'contoh, belum dari agen'

export type Rate = {
  carrier: Carrier
  city: string
  perKg: number
  minWeight: number
  etaDays: string
  note: string
  isSample: boolean
}

// Kemasan satu ban per ring.
export type PackSpec = { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }

export type ShippingSettings = {
  origin: string
  divisor: Record<Carrier, number> // pembagi berat volume (cm3 per kg)
  packingPerTire: number // biaya packing per ban, 0 kalau tidak dipakai
  ringPack: Record<string, PackSpec> // kunci: nomor ring sebagai teks, "12" sampai "19"
  ringPackSample: boolean // true selama angka kemasan masih contoh
}

// Antarmuka sumber tarif. Sekarang hanya tabel isian admin (db-source.ts);
// sumber API bisa ditambahkan dengan mengimplementasikan antarmuka ini.
export interface RateSource {
  id: string
  label: string
  getRate(carrier: Carrier, city: string): Promise<Rate | null>
  listCities(): Promise<string[]>
}

export type QuoteInput = {
  tires?: { count: number; ring: number }
  manualWeightKg?: number
  manualDimsCm?: { l: number; w: number; h: number } // dimensi total paket, opsional
  usePacking: boolean
}

export type Quote =
  | { carrier: Carrier; status: 'NO_RATE'; city: string }
  | {
      carrier: Carrier
      status: 'OK'
      city: string
      actualKg: number
      volumeKg: number
      billedKg: number
      minWeight: number
      perKg: number
      shipping: number
      packing: number
      total: number
      etaDays: string
      note: string
      isSample: boolean // tarif atau ukuran kemasan masih contoh
    }
  | { carrier: Carrier; status: 'NO_PACK'; city: string }
