import { CARRIER_LABEL, SAMPLE_LABEL, type Quote } from './types'

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

// Ringkasan teks untuk ditempel ke WhatsApp. Angka contoh selalu diberi label.
export function quoteText(q: Quote): string {
  const name = CARRIER_LABEL[q.carrier]
  if (q.status === 'NO_RATE') return `${name} ke ${q.city}: tarif belum diisi`
  if (q.status === 'NO_PACK') return `${name} ke ${q.city}: ukuran kemasan ring ini belum diisi`
  const eta = q.etaDays ? `, estimasi ${q.etaDays} hari` : ''
  const sample = q.isSample ? ` (${SAMPLE_LABEL})` : ''
  return `${name} ke ${q.city}: ${rp(q.total)}${eta}, ditagih ${q.billedKg} kg x ${rp(q.perKg)}${q.packing ? ` + packing ${rp(q.packing)}` : ''}${sample}`
}

export function summaryText(quotes: Quote[], desc: string, origin: string): string {
  const head = `Estimasi ongkir ${desc}${origin ? ` dari ${origin}` : ''}`
  const lines = quotes.map((q) => '- ' + quoteText(q))
  const sample = quotes.some((q) => q.status === 'OK' && q.isSample)
  return [head, ...lines, sample ? `Catatan: angka berlabel "${SAMPLE_LABEL}" belum tarif asli.` : 'Estimasi, tarif final mengikuti agen.'].join('\n')
}
