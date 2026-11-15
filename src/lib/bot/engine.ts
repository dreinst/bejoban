// Mesin jawab chatbot stok. Modul murni, tanpa model bahasa dan tanpa akses database:
// semua isi balasan berasal dari daftar ban yang dimasukkan sebagai argumen.
import { findRing, findSizes } from '../tire/size'

export type Tire = { id: number; ring: number; sizeRaw: string; sizeNorm: string; brand: string; price: number | null; stock: number; note: string }

export type ShipRequest = { sizeNorm: string; sizeLabel: string; ring: number; qty: number; city: string }

export type EngineOptions = {
  // Dipanggil untuk pertanyaan ongkir. Kembalikan teks balasan, atau null kalau tidak bisa menghitung.
  shipQuote?: (req: ShipRequest) => string | null
}

export type Answer = {
  intent: 'stok' | 'ongkir' | 'serahkan'
  reply: string
  handoff: boolean
  reason: string // alasan pencocokan, untuk kotak uji
  sizes: string[]
  terms: string[]
}

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const MAX_ROWS = 8

// Kata yang ada di nama merek tapi bukan merek atau model.
const NOISE = new Set(['dot', 'cek', 'lama', 'disc', 'ban', 'alus', 'kaasar', 'tahun', 'atau', 'dan'])
// Kata umum di pesan yang tidak boleh dianggap nama merek walau kebetulan ada di data.
const CHAT_WORDS = new Set(['stok', 'harga', 'ada', 'ukuran', 'ring', 'ongkir', 'kirim', 'berapa', 'mau', 'cari', 'tanya', 'sport', 'pro', 'all', 'new'])

const tokens = (s: string): string[] => s.toLowerCase().match(/[a-z][a-z0-9+]*/g) ?? []

export function brandVocabulary(tires: Tire[]): Set<string> {
  const v = new Set<string>()
  for (const t of tires) for (const w of tokens(t.brand)) if ((w.length >= 3 || w === 'gt') && !NOISE.has(w)) v.add(w)
  return v
}

const byPrice = (a: Tire, b: Tire) => (a.price ?? Infinity) - (b.price ?? Infinity)

function line(t: Tire, withSize: boolean): string {
  const harga = t.price === null ? 'harga belum diisi' : rp(t.price)
  const head = withSize ? `${t.sizeRaw.trim()} ${t.brand}` : t.brand
  const note = t.note ? ` (${t.note})` : ''
  return t.stock > 0 ? `- ${head}: ${harga}, stok ${t.stock}${note}` : `- ${head}: stok kosong${note}`
}

function listing(rows: Tire[], withSize: boolean, max = MAX_ROWS): string {
  const ready = rows.filter((t) => t.stock > 0).sort(byPrice)
  const empty = rows.filter((t) => t.stock <= 0)
  const shown = [...ready, ...empty].slice(0, max)
  const out = shown.map((t) => line(t, withSize))
  if (rows.length > shown.length) out.push(`...dan ${rows.length - shown.length} lainnya.`)
  return out.join('\n')
}

const handoff = (reason: string, reply = 'Baik, pertanyaan ini saya teruskan ke admin ya. Mohon ditunggu.'): Answer => ({
  intent: 'serahkan',
  reply,
  handoff: true,
  reason,
  sizes: [],
  terms: [],
})

const CITY_STOP = new Set(['dong', 'ya', 'yah', 'pak', 'bu', 'kak', 'berapa', 'nih', 'gan', 'min', 'admin', 'ongkirnya', 'ongkir', 'dan', 'sama', 'untuk', 'buat', 'harga', 'total', 'estimasi', 'kira', 'kira-kira'])

export function parseCity(text: string): string | null {
  const m = /\bke\s+([a-z][a-z.\-\s]{1,40})/i.exec(text)
  if (!m) return null
  const words: string[] = []
  for (const w of m[1].trim().split(/\s+/)) {
    if (CITY_STOP.has(w.toLowerCase()) || words.length >= 3) break
    words.push(w.replace(/[.,?!]+$/, ''))
  }
  const city = words.join(' ').trim()
  return city.length >= 3 ? city.replace(/\b\w/g, (c) => c.toUpperCase()) : null
}

export function parseQty(text: string): number | null {
  const m = /(?<![\d/.-])(\d{1,3})\s*(?:ban|buah|biji|pcs|pc|unit|set)\b/i.exec(text) ?? /(?<![\d/.-])(\d{1,3})\s*x\s+(?!\d)/i.exec(text)
  const n = m ? Number(m[1]) : null
  return n && n > 0 && n <= 200 ? n : null
}

const RE_ONGKIR = /\b(ongkir|ongkos\s+kirim|biaya\s+kirim|ongkos|kirim\s+ke)\b/i

export function answer(text: string, tires: Tire[], opts: EngineOptions = {}): Answer {
  const msg = text.trim()
  if (!msg) return handoff('pesan kosong')
  const sizes = findSizes(msg)
  const ring = sizes.length ? null : findRing(msg)
  const vocab = brandVocabulary(tires)
  const terms = [...new Set(tokens(msg).filter((w) => vocab.has(w) && !CHAT_WORDS.has(w)))]
  const base = { sizes: sizes.map((s) => s.norm), terms }

  // Ongkir
  if (RE_ONGKIR.test(msg)) {
    const city = parseCity(msg)
    const qty = parseQty(msg)
    if (sizes.length !== 1 || !city || !opts.shipQuote) {
      return {
        ...handoff(
          `ongkir: ${sizes.length !== 1 ? 'ukuran ban tidak tunggal' : !city ? 'kota tujuan tidak terbaca' : 'modul ongkir tidak tersedia'}`,
          'Untuk ongkir, mohon sebutkan ukuran ban, jumlah, dan kota tujuan. Admin akan membantu menghitung.',
        ),
        ...base,
      }
    }
    const s = sizes[0]
    const q = opts.shipQuote({ sizeNorm: s.norm, sizeLabel: s.label, ring: s.ring, qty: qty ?? 1, city })
    if (!q) return { ...handoff('ongkir: modul ongkir tidak bisa menghitung (ukuran kemasan atau tarif belum ada)'), ...base }
    return { intent: 'ongkir', reply: q, handoff: false, reason: `ongkir: ${qty ?? 1} ban ${s.label} ke ${city}${qty ? '' : ' (jumlah tidak disebut, dianggap 1)'}`, ...base }
  }

  if (!sizes.length && !ring && !terms.length) return { ...handoff('tidak ada ukuran, ring, atau merek yang dikenali'), ...base }

  const matchTerms = (t: Tire) => terms.every((w) => tokens(t.brand).includes(w))
  const parts: string[] = []
  const why: string[] = []
  let missing = 0

  if (sizes.length) {
    for (const s of sizes.slice(0, 3)) {
      const atSize = tires.filter((t) => t.sizeNorm === s.norm)
      if (!atSize.length) {
        parts.push(`Ukuran ${s.label} belum ada di daftar stok kami. Saya teruskan ke admin untuk dicek ya.`)
        why.push(`${s.norm}: tidak ada baris`)
        missing++
        continue
      }
      const rows = terms.length ? atSize.filter(matchTerms) : atSize
      if (terms.length && !rows.length) {
        const others = atSize.filter((t) => t.stock > 0)
        parts.push(`Ukuran ${s.label} untuk ${terms.join(' ')} tidak ada di daftar.${others.length ? ` Merek lain yang ada:\n${listing(others, false, 5)}` : ''}`)
        why.push(`${s.norm}: ${atSize.length} baris, tak ada yang cocok dengan "${terms.join(' ')}"`)
        continue
      }
      const ready = rows.filter((t) => t.stock > 0)
      if (!ready.length) {
        const others = atSize.filter((t) => t.stock > 0 && !rows.includes(t))
        parts.push(
          `Ukuran ${s.label}${terms.length ? ` (${terms.join(' ')})` : ''} sedang kosong.\n${listing(rows, false)}` +
            (others.length ? `\nMerek lain di ukuran yang sama:\n${listing(others, false, 5)}` : '\nMerek lain di ukuran ini juga kosong.'),
        )
        why.push(`${s.norm}: ${rows.length} baris cocok, semua stok 0; ${others.length} merek lain ready`)
        continue
      }
      parts.push(`Ukuran ${s.label}:\n${listing(rows, false)}`)
      why.push(`${s.norm}: ${rows.length} baris cocok, ${ready.length} ready`)
    }
  } else if (ring) {
    const rows = tires.filter((t) => t.ring === ring && (!terms.length || matchTerms(t)))
    if (!rows.length) {
      parts.push(`Tidak ada ban ring ${ring}${terms.length ? ` untuk ${terms.join(' ')}` : ''} di daftar stok kami.`)
    } else if (terms.length) {
      parts.push(`Ring ${ring} ${terms.join(' ')}:\n${listing(rows, true)}`)
    } else {
      const sz = [...new Set(rows.filter((t) => t.stock > 0).map((t) => t.sizeRaw.trim()))]
      parts.push(`Ring ${ring} yang ready: ${sz.slice(0, 20).join(', ')}${sz.length > 20 ? ', dan lainnya' : ''}.\nSebutkan ukuran lengkapnya (misalnya 185/65 R15) supaya saya cek harga dan stoknya.`)
    }
    why.push(`ring ${ring}: ${rows.length} baris`)
  } else {
    const rows = tires.filter(matchTerms)
    parts.push(rows.length ? `${terms.join(' ')}:\n${listing(rows, true)}\nSebutkan ukuran ban untuk hasil yang lebih tepat.` : `Tidak ada ${terms.join(' ')} di daftar stok kami.`)
    why.push(`merek ${terms.join(' ')}: ${rows.length} baris`)
  }
  // Semua ukuran yang ditanyakan tidak ada di data: diam-diam serahkan ke manusia.
  const allMissing = sizes.length > 0 && missing === Math.min(sizes.length, 3)
  return { intent: allMissing ? 'serahkan' : 'stok', reply: parts.join('\n\n'), handoff: allMissing, reason: why.join('; '), ...base }
}
