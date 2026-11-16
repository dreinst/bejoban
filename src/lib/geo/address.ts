// Pengurai alamat Indonesia gaya Google Maps dan daftar kueri bertingkat untuk pencarian lokasi. Modul murni.
//   "Jl. Raya Pandanlandung No.16, Krajan, Bandulan, Kec. Wagir, Kabupaten Malang, Jawa Timur 65146"

export type ParsedAddress = {
  raw: string
  jalan: string // tanpa nomor rumah, "Jl." sudah menjadi "Jalan"
  nomor: string
  kodepos: string
  kelurahan: string[] // "Kel." atau "Desa" bertanda, atau bagian tanpa penanda di antara jalan dan kecamatan
  kecamatan: string
  kota: string // sudah lengkap dengan awalan, mis. "Kabupaten Malang" atau "Kota Batu"
  provinsi: string
}

export type Level = { key: 'utuh' | 'bersih' | 'jalan' | 'kecamatan' | 'kota'; label: string; q: string; precision: Precision }
export type Precision = 'alamat' | 'kecamatan' | 'kota' | 'provinsi'

export const PRECISION_LABEL: Record<Precision, string> = {
  alamat: 'sampai alamat',
  kecamatan: 'sampai kecamatan',
  kota: 'sampai kota atau kabupaten',
  provinsi: 'sampai provinsi',
}

export const PROVINCES = [
  'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung',
  'DKI Jakarta', 'Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Daerah Istimewa Yogyakarta', 'Yogyakarta', 'Jawa Timur',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
  'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku', 'Maluku Utara',
  'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan',
]
const PROV_SET = new Set(PROVINCES.map((p) => p.toLowerCase()))

const RE_JALAN = /^(jl\.?|jln\.?|jalan|gg\.?|gang)\s*/i
const RE_NOMOR = /\s*(?:\bno\.?|\bnomor|\bblok)\s*[\w./-]+/gi
const RE_KEC = /^(kec\.?|kecamatan)\s+/i
const RE_KAB = /^(kab\.?|kabupaten|kota|kotamadya)\s+/i
const RE_KEL = /^(kel\.?|kelurahan|desa|ds\.?)\s+/i
const RE_KODEPOS = /\b(\d{5})\b/

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '')
const title = (s: string) => s.replace(/\b([a-z])([a-z]*)/gi, (_, a: string, b: string) => a.toUpperCase() + b.toLowerCase())

function expandKab(s: string): string {
  const m = RE_KAB.exec(s)
  if (!m) return s
  const kind = /^kota/i.test(m[1]) ? 'Kota' : 'Kabupaten'
  return `${kind} ${clean(s.slice(m[0].length))}`
}

export function parseAddress(raw: string): ParsedAddress {
  const p: ParsedAddress = { raw: raw.trim(), jalan: '', nomor: '', kodepos: '', kelurahan: [], kecamatan: '', kota: '', provinsi: '' }
  let segs = raw.split(/[,;\n]/).map(clean).filter(Boolean)
  // Kode pos biasanya menempel di akhir ("Jawa Timur 65146"), kadang berdiri sendiri.
  segs = segs.flatMap((sg) => {
    const m = RE_KODEPOS.exec(sg)
    if (!m) return [sg]
    p.kodepos ||= m[1]
    const rest = clean(sg.replace(m[1], ''))
    return rest ? [rest] : []
  })
  const rest: string[] = []
  for (const [i, sg] of segs.entries()) {
    if (PROV_SET.has(sg.toLowerCase())) p.provinsi = sg
    else if (RE_KEC.test(sg)) p.kecamatan = clean(sg.replace(RE_KEC, ''))
    else if (RE_KAB.test(sg)) p.kota = expandKab(sg)
    else if (RE_KEL.test(sg)) p.kelurahan.push(clean(sg.replace(RE_KEL, '')))
    else if (i === 0 && (RE_JALAN.test(sg) || RE_NOMOR.test(sg))) {
      const no = /\b(?:no\.?|nomor)\s*([\w./-]+)/i.exec(sg)
      p.nomor = no?.[1] ?? ''
      p.jalan = clean(sg.replace(RE_NOMOR, '').replace(RE_JALAN, (m) => (/^g/i.test(m) ? 'Gang ' : 'Jalan ')))
    } else rest.push(sg)
  }
  RE_NOMOR.lastIndex = 0
  // Bagian tanpa penanda antara jalan dan kecamatan dianggap kelurahan atau dusun.
  p.kelurahan.push(...rest)
  // Tanpa penanda "Kec.", bagian tak bertanda terakhir sebelum kota dipakai sebagai kecamatan.
  if (!p.kecamatan && p.kota && p.kelurahan.length > 1) p.kecamatan = p.kelurahan[p.kelurahan.length - 1]
  return p
}

// Kueri berurutan dari yang paling lengkap ke yang paling pendek. Berhenti di yang pertama memberi hasil.
export function buildLevels(raw: string): Level[] {
  const p = parseAddress(raw)
  const levels: Level[] = []
  const add = (key: Level['key'], label: string, parts: (string | undefined)[], precision: Precision) => {
    const q = clean(parts.filter(Boolean).join(', '))
    if (q && !levels.some((l) => l.q.toLowerCase() === q.toLowerCase())) levels.push({ key, label, q, precision })
  }
  add('utuh', 'teks utuh', [clean(raw)], p.jalan ? 'alamat' : p.kecamatan ? 'kecamatan' : 'kota')
  add('bersih', 'tanpa kode pos dan nomor rumah', [p.jalan, ...p.kelurahan, p.kecamatan && `Kecamatan ${p.kecamatan}`, p.kota, p.provinsi], p.jalan ? 'alamat' : 'kecamatan')
  if (p.jalan && (p.kecamatan || p.kota)) add('jalan', 'nama jalan, kecamatan, dan kabupaten atau kota', [p.jalan, p.kecamatan, p.kota], 'alamat')
  if (p.kecamatan && (p.kota || p.provinsi)) add('kecamatan', 'kecamatan, kabupaten atau kota, dan provinsi', [p.kecamatan, p.kota, p.provinsi], 'kecamatan')
  if (p.kota) add('kota', 'kabupaten atau kota dan provinsi', [p.kota, p.provinsi], 'kota')
  return levels
}

// Tingkat ketepatan hasil dari jenis tempat yang dikembalikan penyedia (addresstype Nominatim, type Photon).
// Jenis yang tidak dikenal menghasilkan undefined, supaya tingkat pencarian yang berhasil yang dipakai.
export function precisionKnown(kind: string | undefined): Precision | undefined {
  const k = (kind ?? '').toLowerCase()
  if (!k) return undefined
  if (['house', 'building', 'road', 'street', 'residential', 'amenity', 'shop', 'office', 'tourism', 'highway', 'railway', 'place_of_worship', 'locality', 'hamlet', 'isolated_dwelling', 'neighbourhood'].includes(k)) return 'alamat'
  if (['municipality', 'city_district', 'district', 'subdistrict', 'suburb', 'village', 'town', 'quarter', 'borough'].includes(k)) return 'kecamatan'
  if (['city', 'county', 'regency', 'state_district', 'administrative'].includes(k)) return 'kota'
  if (['state', 'region', 'province'].includes(k)) return 'provinsi'
  return undefined
}

export const precisionOf = (kind: string | undefined, fallback: Precision): Precision => precisionKnown(kind) ?? fallback

export { title as _title }
