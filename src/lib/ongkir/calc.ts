// Kalkulator ongkir. Modul murni: tarif dan pengaturan masuk sebagai argumen.
import type { Carrier, PackSpec, QuoteInput, Quote, Rate, ShippingSettings } from './types'

export const DEFAULT_RING_PACK: Record<string, PackSpec> = {
  '12': { weightKg: 5, lengthCm: 52, widthCm: 52, heightCm: 16 },
  '13': { weightKg: 6, lengthCm: 56, widthCm: 56, heightCm: 17 },
  '14': { weightKg: 7.5, lengthCm: 59, widthCm: 59, heightCm: 18 },
  '15': { weightKg: 9, lengthCm: 62, widthCm: 62, heightCm: 19 },
  '16': { weightKg: 11, lengthCm: 65, widthCm: 65, heightCm: 20 },
  '17': { weightKg: 13, lengthCm: 68, widthCm: 68, heightCm: 21 },
  '18': { weightKg: 15, lengthCm: 71, widthCm: 71, heightCm: 22 },
  '19': { weightKg: 17, lengthCm: 74, widthCm: 74, heightCm: 23 },
}

export const DEFAULT_SETTINGS: ShippingSettings = {
  origin: '',
  divisor: { JNT_CARGO: 4000, BARAKA: 4000 },
  packingPerTire: 0,
  ringPack: DEFAULT_RING_PACK,
  ringPackSample: true,
  // Velg: perkiraan toko 7 sampai 12 kg per buah. Ukuran kemasan belum diketahui, jadi berat volume tidak dihitung.
  velg: { weightKg: 10, lengthCm: 0, widthCm: 0, heightCm: 0 },
  velgNote: 'perkiraan toko, 7 sampai 12 kg per velg',
  origins: {
    // Perkiraan titik pusat wilayah, bukan titik toko. Ganti dengan koordinat toko di pengaturan.
    batu: { lat: -7.8672, lon: 112.5239 },
    karanglo: { lat: -7.9139, lon: 112.6578 },
  },
}

// Gabung data tersimpan dengan bawaan, supaya bidang baru tidak membuat pembacaan gagal.
export function mergeSettings(saved: Partial<ShippingSettings> | null | undefined): ShippingSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    divisor: { ...DEFAULT_SETTINGS.divisor, ...saved?.divisor },
    ringPack: { ...DEFAULT_SETTINGS.ringPack, ...saved?.ringPack },
    velg: { ...DEFAULT_SETTINGS.velg, ...saved?.velg },
    origins: { ...DEFAULT_SETTINGS.origins, ...saved?.origins },
  }
}

export const normCity = (s: string) => s.toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, '').replace(/\s+/g, ' ').trim()

// Berat ditagih dibulatkan ke atas per 1 kg (kebiasaan ekspedisi kargo; cek ke agen).
const ceilKg = (n: number) => Math.ceil(n - 1e-9)

export function calcQuote(carrier: Carrier, city: string, rate: Rate | null, input: QuoteInput, s: ShippingSettings): Quote {
  if (!rate) return { carrier, status: 'NO_RATE', city }
  let actualKg = 0
  let volumeKg = 0
  let packSample = false
  const notes: string[] = []
  let source = ''
  if (input.velg) {
    const v = s.velg
    const n = input.velg.count
    actualKg = v.weightKg * n
    volumeKg = ((v.lengthCm * v.widthCm * v.heightCm) * n) / s.divisor[carrier]
    source = `${n} velg x ${v.weightKg} kg per velg (pengaturan velg)`
    if (s.velgNote) notes.push(`Berat velg ${s.velgNote}`)
    if (!(v.lengthCm * v.widthCm * v.heightCm)) notes.push('Ukuran kemasan velg belum diisi, berat volume tidak dihitung')
  } else if (input.tires) {
    const pack = s.ringPack[String(input.tires.ring)]
    if (!pack) return { carrier, status: 'NO_PACK', city }
    const n = input.tires.count
    actualKg = pack.weightKg * n
    // Anggapan: ban ditumpuk, jadi volume = jumlah ban x volume satu kemasan.
    volumeKg = (pack.lengthCm * pack.widthCm * pack.heightCm * n) / s.divisor[carrier]
    packSample = s.ringPackSample
    source = `${n} ban R${input.tires.ring} x ${pack.weightKg} kg per ban (pengaturan kemasan ring${s.ringPackSample ? ', angka contoh' : ''})`
  } else {
    actualKg = input.manualWeightKg ?? 0
    const d = input.manualDimsCm
    volumeKg = d ? (d.l * d.w * d.h) / s.divisor[carrier] : 0
    source = `berat manual ${actualKg} kg${d ? ` dan dimensi ${d.l} x ${d.w} x ${d.h} cm` : ''}`
  }
  const billedKg = ceilKg(Math.max(actualKg, volumeKg, rate.minWeight))
  const shipping = billedKg * rate.perKg
  const packing = input.usePacking && (input.tires || input.velg) ? s.packingPerTire * (input.tires?.count ?? input.velg!.count) : 0
  return {
    carrier,
    status: 'OK',
    city: rate.city,
    actualKg: round1(actualKg),
    volumeKg: round1(volumeKg),
    billedKg,
    minWeight: rate.minWeight,
    perKg: rate.perKg,
    shipping,
    packing,
    total: shipping + packing,
    etaDays: rate.etaDays,
    note: rate.note,
    isSample: rate.isSample || packSample,
    notes,
    source,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10
