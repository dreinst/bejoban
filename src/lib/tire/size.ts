// Pengenal ukuran ban dari tulisan bebas. Modul murni, tanpa akses database.

export type SizeKind = 'radial' | 'muatan' | 'flotasi'
export type Size = { norm: string; ring: number; kind: SizeKind; label: string }

// Bentuk baku (norm):
//   radial   185/65R15
//   muatan   165-13 atau 750-16
//   flotasi  31x10.5-15
const num = (s: string) => s.replace(',', '.')

function build(kind: SizeKind, a: string, b: string, ring: string): Size {
  const r = Number(ring)
  if (kind === 'radial') return { norm: `${a}/${b}R${r}`, ring: r, kind, label: `${a}/${b} R${r}` }
  if (kind === 'flotasi') return { norm: `${a}x${num(b)}-${r}`, ring: r, kind, label: `${a}x${num(b)}-${r}` }
  return { norm: `${a}-${r}`, ring: r, kind, label: `${a}-${r}` }
}

const RE_FLOT = /(?<![\d.])(\d{2})\s*x\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*(?:-|r|\s)\s*(\d{2})(?!\d)/i
const RE_RADIAL = /(?<![\d/])(\d{3})\s*(?:\/|\s)\s*(\d{2})\s*(?:-|r|\s)?\s*(\d{2})(?!\d)/i
const RE_RADIAL_RAPAT = /(?<!\d)(\d{3})(\d{2})(\d{2})(?!\d)/
const RE_MUATAN = /(?<![\d/])(\d{3})\s*(?:-|r)\s*(\d{2})(?!\d)/i

// Cari semua ukuran dalam satu teks. Urutan: flotasi, radial, muatan, supaya "31x10.5-15"
// tidak terbaca sebagai potongan ukuran lain.
export function findSizes(text: string): Size[] {
  let t = ' ' + text.toLowerCase() + ' '
  const out: Size[] = []
  const take = (re: RegExp, make: (m: RegExpExecArray) => Size | null) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m: RegExpExecArray | null
    const hits: [number, number][] = []
    while ((m = g.exec(t))) {
      const s = make(m)
      if (s && !out.some((o) => o.norm === s.norm)) out.push(s)
      if (s) hits.push([m.index, m.index + m[0].length])
    }
    for (const [i, j] of hits) t = t.slice(0, i) + ' '.repeat(j - i) + t.slice(j)
  }
  take(RE_FLOT, (m) => build('flotasi', m[1], m[2], m[3]))
  take(RE_RADIAL, (m) => (validRadial(m[1], m[2], m[3]) ? build('radial', m[1], m[2], m[3]) : null))
  take(RE_RADIAL_RAPAT, (m) => (validRadial(m[1], m[2], m[3]) ? build('radial', m[1], m[2], m[3]) : null))
  take(RE_MUATAN, (m) => (validRing(m[2]) ? build('muatan', m[1], '', m[2]) : null))
  return out
}

const validRing = (r: string) => Number(r) >= 10 && Number(r) <= 24
const validRadial = (w: string, a: string, r: string) =>
  Number(w) >= 125 && Number(w) <= 355 && Number(a) >= 25 && Number(a) <= 85 && validRing(r)

// Normalisasi satu sel ukuran dari pricelist ("185/65-15", "165-13", "175/80-13 ").
export function normalizeSize(raw: string): Size | null {
  const s = findSizes(raw.trim())
  return s.length === 1 ? s[0] : null
}

// "ring 15", "r15", "r 15". Angka di depan R tidak boleh ada (supaya "185/65 r15" tidak ikut).
export function findRing(text: string): number | null {
  const m = /(?<![\d/\w])(?:ring|r)\s*(1[0-9]|2[0-4])(?!\d)/i.exec(text)
  return m ? Number(m[1]) : null
}
