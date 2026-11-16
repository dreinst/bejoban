export const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

/** Harga baru dicetak bila sakelar situs menyala dan harganya terisi. Harga 0 berarti tanya lewat WhatsApp. */
export const bisaTampilHarga = (showPrices: boolean, price: number) => showPrices && price > 0

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const waLink = (phone: string, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '62')}${text ? '?text=' + encodeURIComponent(text) : ''}`

export const parseImages = (s: string): string[] => {
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const isFuture = (s: string) => !!s && new Date(s).getTime() > Date.now()

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Waktu seragam di admin, zona Jakarta: "16 Nov 2026, 17.23". */
export function waktuWib(d: Date | string | number): string {
  const w = new Date(new Date(d).getTime() + 7 * 3600_000)
  const dua = (n: number) => String(n).padStart(2, '0')
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${dua(w.getUTCHours())}.${dua(w.getUTCMinutes())}`
}
