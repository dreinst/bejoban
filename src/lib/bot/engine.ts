// Mesin jawab chatbot. Modul murni, tanpa model bahasa dan tanpa akses database.
//
// Skema:
//  1. kenali cabang (dari kalimat pembuka tombol situs), ukuran, merek, dan jasa
//  2. cari di data stok dan harga jasa
//  3. ada dan stok lebih dari 0 (atau jasa ada di tabel): jawab harga dan stok asli dari data
//  4. selain itu (tidak ada, stok 0, harga kosong, tidak dikenali): jangan jawab harga,
//     kirim satu kalimat serah ke admin dan siapkan ringkasan untuk admin
import { findRing, findSizes, type Size } from '../tire/size'
import { renderTemplate } from '../text/template'
import { detectBranch, type BotBranch } from './branch'

import type { Status } from './conversation'
import { DEFAULT_TEMPLATES, type Templates } from './templates'

export type Tire = {
  id: number
  ring: number
  sizeRaw: string
  sizeNorm: string
  brand: string
  price: number | null // harga asli
  discount: number
  stock: number
  note: string
}

export type Service = {
  id: number
  groupName: string
  name: string
  variant: string
  ringMin: number | null
  ringMax: number | null
  minDiameter: number | null
  price: number | null
  unit: string
  altLabel: string
  altPrice: number | null
  note: string
  keywords: string
}

export type BotContext = {
  branches: BotBranch[]
  adminNumbers: Record<string, string> // slug cabang -> nomor admin
  ownerNumber: string
  templates?: Templates
  services?: Service[]
  jamBuka?: string
  customer?: string
  knownBranch?: string // cabang yang diingat untuk nomor pelanggan ini (slug)
  awaiting?: { action: 'serah' | 'ganti'; text: string } | null // bot sedang menunggu jawaban cabang
  forceOwner?: boolean // cabang tidak diketahui: serahkan ke owner tanpa bertanya lagi
  extraNote?: string // tambahan di ringkasan untuk admin
}

export type Outcome = {
  kind: 'stok_ada' | 'jasa_ada' | 'sapaan' | 'tanya_ukuran' | 'serah' | 'tanya_cabang' | 'cabang_diganti'
  reply: string // untuk pelanggan, selalu ada
  adminNote: string | null // untuk admin, hanya saat serah
  adminNumber: string // nomor tujuan ringkasan (admin cabang, atau owner)
  status: Status // status percakapan sesudah balasan ini
  branchSlug: string
  branchLabel: string
  sizes: string[]
  sizeLabel: string
  result: string
  reason: string
  branchChosen: string // slug cabang yang disebut atau dipilih pelanggan di pesan ini, untuk diingat
  awaiting: { action: 'serah' | 'ganti'; text: string } | null // simpan di percakapan kalau bot menanyakan cabang
}

const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const MAX_LIST = 6

const tokens = (s: string): string[] => s.toLowerCase().match(/[a-z][a-z0-9+]*/g) ?? []
const NOISE = new Set(['dot', 'cek', 'lama', 'disc', 'ban', 'alus', 'kaasar', 'tahun', 'atau', 'dan'])
const CHAT_WORDS = new Set(['stok', 'harga', 'ada', 'ukuran', 'ring', 'ongkir', 'kirim', 'berapa', 'mau', 'cari', 'tanya', 'sport', 'pro', 'all', 'new', 'bejo', 'batu', 'karanglo', 'halo', 'kak'])

export function brandVocabulary(tires: Tire[]): Set<string> {
  const v = new Set<string>()
  for (const t of tires) for (const w of tokens(t.brand)) if ((w.length >= 3 || w === 'gt') && !NOISE.has(w)) v.add(w)
  return v
}

const noteWithoutDisc = (n: string) => n.replace(/\bdisc(?:ount)?\.?\s*(?:rp\.?\s*)?[\d.,]+/i, '').replace(/\s+/g, ' ').trim()

// Satu baris jawaban stok. Harga setelah potongan disebut bersama harga asalnya.
export function tireLine(t: Tire, withSize = false): string {
  const price = t.price as number
  const head = withSize ? `${t.sizeRaw.trim()} ${t.brand}` : t.brand
  const hargaTxt = t.discount > 0 ? `${rp(price - t.discount)} (harga asal ${rp(price)}, potongan ${rp(t.discount)})` : rp(price)
  const note = noteWithoutDisc(t.note)
  return `- ${head}: ${hargaTxt}, stok ${t.stock}${note ? ` (${note})` : ''}`
}

const usable = (t: Tire) => t.stock > 0 && t.price !== null
const effective = (t: Tire) => (t.price ?? 0) - t.discount
const byPrice = (a: Tire, b: Tire) => effective(a) - effective(b)

function describeMissing(rows: Tire[]): string {
  if (!rows.length) return 'tidak ada baris di data stok'
  const ready = rows.filter((t) => t.stock > 0)
  if (!ready.length) return `stok 0 di semua baris (${rows.length} baris)`
  return `ada stok tapi harga kosong (${ready.length} baris)`
}

// ---------- Jasa ----------

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasWord = (text: string, kw: string) => new RegExp(`(?<![a-z0-9])${esc(kw)}(?![a-z0-9])`).test(text)

export function serviceLine(s: Service): string {
  const name = [s.name, s.variant].filter(Boolean).join(' ')
  const main = s.price === 0 ? 'gratis' : `${rp(s.price as number)}${s.unit ? ` ${s.unit}` : ''}`
  const alt = s.altPrice !== null && s.altLabel ? `, ${s.altLabel} ${rp(s.altPrice)}` : ''
  return `- ${name}: ${main}${alt}${s.note ? `, ${s.note}` : ''}`
}

export type ServiceMatch = { groups: string[]; rows: Service[]; failed: string }

export function matchServices(text: string, services: Service[], sizes: Size[], ring: number | null): ServiceMatch {
  const t = text.toLowerCase()
  const scored = services
    .map((s) => ({ s, score: Math.max(0, ...s.keywords.split(',').map((k) => k.trim().toLowerCase()).filter((k) => k && hasWord(t, k)).map((k) => k.length)) }))
    .filter((x) => x.score > 0)
  if (!scored.length) return { groups: [], rows: [], failed: '' }
  const groups = [...new Set(scored.map((x) => x.s.groupName))]
  const knownRing = sizes[0]?.ring ?? ring
  const flot = sizes.find((z) => z.kind === 'flotasi')
  const diameter = flot ? Number(flot.norm.split('x')[0]) : null
  const rows: Service[] = []
  let failed = ''
  for (const g of groups) {
    const inGroup = scored.filter((x) => x.s.groupName === g)
    const top = Math.max(...inGroup.map((x) => x.score))
    let cand = inGroup.filter((x) => x.score === top).map((x) => x.s)
    const big = cand.filter((s) => s.minDiameter !== null && diameter !== null && diameter >= s.minDiameter)
    if (big.length) cand = big
    else {
      cand = cand.filter((s) => s.minDiameter === null || knownRing === null)
      if (knownRing !== null) cand = cand.filter((s) => (s.ringMin === null || knownRing >= s.ringMin) && (s.ringMax === null || knownRing <= s.ringMax))
    }
    if (!cand.length) failed = `jasa ${g}: tidak ada tarif untuk ring ${knownRing}`
    rows.push(...cand)
  }
  if (!failed && rows.some((s) => s.price === null)) failed = 'jasa: harga belum diisi di tabel'
  return { groups, rows, failed }
}

// ---------- Mesin utama ----------

const RE_BOOKING = /\b(?:mau|ingin|pengen|bisa|boleh)\s+(?:datang|dateng|mampir|pasang|booking|pesan|beli)\b|\b(?:booking|reservasi|jadwal|datang|dateng|mampir|ke toko)\b/i
const RE_GANTI = /\b(?:ganti|pindah|ubah)\s+cabang\b/i
const GREETING = new Set('halo hai hi hello kak kakak bejo ban batu karanglo singosari saya aku mau ingin tanya bertanya nanya stok stock dan harga selamat pagi siang sore malam min admin permisi ada yang untuk dong ya mohon info informasi tentang pak bu mas mbak toko tolong cabang di'.split(' '))

function core(text: string, tires: Tire[], ctx: BotContext, branch: BotBranch | null): Outcome {
  const tpl = ctx.templates ?? DEFAULT_TEMPLATES
  const msg = text.trim()
  const cabang = branch ? branch.name.replace(/\s*\(.*\)\s*/, '').trim() : 'Bejo Ban'
  const adminNumber = (branch && ctx.adminNumbers[branch.slug]) || ctx.ownerNumber || ''
  const base = { branchSlug: branch?.slug ?? '', branchLabel: cabang }

  const serahNow = (reason: string, result: string, sizes: Size[] = []): Outcome => {
    const sizeLabel = sizes.map((s) => s.label).join(', ') || 'ban yang ditanyakan'
    const shown = adminNumber ? (adminNumber.startsWith('62') ? '0' + adminNumber.slice(2) : adminNumber) : ''
    const vars = {
      cabang,
      ukuran: sizeLabel,
      nomorAdmin: shown,
      kontakAdmin: shown ? `Kalau perlu cepat, kakak bisa hubungi admin di ${shown}.` : '',
      pelanggan: ctx.customer ?? '',
      pertanyaan: msg + (ctx.extraNote ? ` (${ctx.extraNote})` : ''),
      hasil: result,
    }
    return {
      kind: 'serah',
      reply: renderTemplate(tpl.serahAdmin, vars),
      adminNote: renderTemplate(tpl.ringkasanAdmin, vars),
      adminNumber,
      status: 'DISERAHKAN',
      sizes: sizes.map((s) => s.norm),
      sizeLabel: sizes.map((s) => s.label).join(', '),
      result,
      reason,
      branchChosen: '',
      awaiting: null,
      ...base,
    }
  }
  const ask = (reason: string, result: string, sizes: Size[] = []): Outcome => ({
    kind: 'tanya_cabang',
    reply: renderTemplate(tpl.tanyaCabang, { pilihan: branchChoices(ctx.branches) }),
    adminNote: null,
    adminNumber: ctx.ownerNumber,
    status: 'BARU',
    sizes: sizes.map((z) => z.norm),
    sizeLabel: sizes.map((z) => z.label).join(', '),
    result,
    reason: `${reason}; cabang belum diketahui, bot menanyakan cabang`,
    branchChosen: '',
    awaiting: { action: 'serah', text: msg },
    ...base,
  })
  // Cabang baru ditanyakan saat dibutuhkan, yaitu sebelum serah terima ke admin.
  const serah = (reason: string, result: string, sizes: Size[] = []): Outcome =>
    !branch && !ctx.forceOwner ? ask(reason, result, sizes) : serahNow(reason, result, sizes)
  const say = (kind: Outcome['kind'], reply: string, reason: string, result: string, sizes: Size[] = []): Outcome => ({
    kind,
    reply,
    adminNote: null,
    adminNumber,
    status: 'DIJAWAB_BOT',
    sizes: sizes.map((s) => s.norm),
    sizeLabel: sizes.map((s) => s.label).join(', '),
    result,
    reason,
    branchChosen: '',
    awaiting: null,
    ...base,
  })

  if (!msg) return serah('pesan kosong', 'pesan kosong')

  const sizes = findSizes(msg)
  const ring = sizes.length ? null : findRing(msg)
  const vocab = brandVocabulary(tires)
  const terms = [...new Set(tokens(msg).filter((w) => vocab.has(w) && !CHAT_WORDS.has(w)))]
  const jasa = matchServices(msg, ctx.services ?? [], sizes, ring)
  const matchTerms = (t: Tire) => terms.every((w) => tokens(t.brand).includes(w))
  const whyParts: string[] = []
  const resultParts: string[] = []
  const answers: string[] = []

  // Kalau pesan menyebut jasa, ukuran dan ring hanya dipakai untuk memilih tarif jasa, stok tidak dicari.
  const jasaMode = jasa.groups.length > 0

  // Stok
  let stockFailed = false
  if (jasaMode) {
    // dilewati
  } else if (sizes.length) {
    const found: string[] = []
    for (const s of sizes.slice(0, 3)) {
      const rows = tires.filter((t) => t.sizeNorm === s.norm && (!terms.length || matchTerms(t)))
      const ok = rows.filter(usable).sort(byPrice)
      if (!ok.length) {
        stockFailed = true
        // Pelanggan menyebut merek yang tidak ada: laporkan juga kondisi ukuran tanpa filter merek.
        const all = tires.filter((t) => t.sizeNorm === s.norm)
        resultParts.push(`Ukuran ${s.label}${terms.length ? ` (${terms.join(' ')})` : ''}: ${describeMissing(rows)}${terms.length && !rows.length ? `; tanpa filter merek ${describeMissing(all)}` : ''}`)
        whyParts.push(`${s.norm}: ${describeMissing(rows)}`)
        continue
      }
      resultParts.push(`Ukuran ${s.label}: ${ok.length} baris ready`)
      whyParts.push(`${s.norm}: ${rows.length} baris cocok, ${ok.length} ready`)
      found.push(`${s.label}:\n${ok.slice(0, MAX_LIST).map((t) => tireLine(t)).join('\n')}${ok.length > MAX_LIST ? `\n...dan ${ok.length - MAX_LIST} lainnya.` : ''}`)
    }
    if (!stockFailed) {
      const ukuran = sizes.slice(0, 3).map((s) => s.label).join(', ')
      const daftar = found.length === 1 ? found[0].split('\n').slice(1).join('\n') : found.join('\n\n')
      answers.push(renderTemplate(tpl.stokAda, { cabang, ukuran, daftar }))
    }
  } else if (ring || terms.length) {
    const rows = tires.filter((t) => (!ring || t.ring === ring) && (!terms.length || matchTerms(t)))
    const ok = rows.filter(usable).sort(byPrice)
    const what = [ring ? `ring ${ring}` : '', terms.join(' ')].filter(Boolean).join(' ')
    if (!ok.length) {
      stockFailed = true
      resultParts.push(`${what}: ${describeMissing(rows)}`)
      whyParts.push(`${what}: ${describeMissing(rows)}`)
    } else if (ok.length > MAX_LIST) {
      // Terlalu banyak untuk dijawab: minta ukuran, bukan kirim seluruh daftar.
      return say('tanya_ukuran', renderTemplate(tpl.tanyaUkuran, { cabang }), `${what}: ${ok.length} baris ready, minta ukuran`, `${what}: ${ok.length} baris ready`)
    } else if (ok.length) {
      answers.push(renderTemplate(tpl.stokAda, { cabang, ukuran: what, daftar: ok.map((t) => tireLine(t, true)).join('\n') }))
      resultParts.push(`${what}: ${ok.length} baris ready`)
      whyParts.push(`${what}: ${ok.length} baris ready`)
    }
  }

  // Jasa
  if (jasa.groups.length) {
    if (jasa.failed) {
      resultParts.push(jasa.failed)
      whyParts.push(jasa.failed)
      stockFailed = true
    } else {
      answers.push(renderTemplate(tpl.jasaAda, { cabang, jasa: jasa.groups.join(', ').toLowerCase(), daftar: jasa.rows.map(serviceLine).join('\n') }))
      resultParts.push(`Jasa ${jasa.groups.join(', ')}: ${jasa.rows.length} baris tarif`)
      whyParts.push(`jasa ${jasa.groups.join(', ')}: ${jasa.rows.length} baris`)
    }
  }

  // Pelanggan mau datang, pasang, atau booking: jawaban stok (kalau ada) tetap dikirim, lalu serah terima.
  if (RE_BOOKING.test(msg)) {
    const pre = stockFailed ? '' : answers.join('\n\n')
    const reason = ['pelanggan mau datang, pasang, atau booking', ...whyParts].join('; ')
    const o = serah(reason, resultParts.join('; ') || 'permintaan datang atau booking', sizes)
    return pre ? { ...o, reply: `${pre}\n\n${o.reply}` } : o
  }

  const recognized = sizes.length > 0 || ring !== null || terms.length > 0 || jasa.groups.length > 0
  if (!recognized) {
    // Hanya sapaan atau kalimat pembuka tombol situs: jawab ramah. Ada hal lain yang tidak dikenal: serahkan.
    const unknown = tokens(msg).filter((w) => !GREETING.has(w))
    if (!unknown.length) {
      return branch
        ? say('sapaan', renderTemplate(tpl.sapaan, { cabang }), 'hanya sapaan atau kalimat pembuka, cabang dikenali', '')
        : say('tanya_ukuran', renderTemplate(tpl.tanyaUkuran, { cabang }), 'hanya sapaan, minta ukuran', '')
    }
    return serah(`tidak ada ukuran, merek, ring, atau jasa yang dikenali (kata tidak dikenal: ${unknown.slice(0, 5).join(' ')})`, 'pesan tidak dikenali')
  }
  if (!jasaMode && !sizes.length && ring && !terms.length) {
    return say('tanya_ukuran', renderTemplate(tpl.tanyaUkuran, { cabang }), `ring ${ring} saja, minta ukuran lengkap`, `ring ${ring}`)
  }
  if (stockFailed || !answers.length) return serah(whyParts.join('; ') || 'tidak ada jawaban dari data', resultParts.join('; ') || 'tidak ada hasil', sizes)
  return say(jasaMode ? 'jasa_ada' : 'stok_ada', answers.join('\n\n'), whyParts.join('; '), resultParts.join('; '), sizes)
}

const branchChoices = (branches: BotBranch[]) => branches.map((b, i) => `${i + 1}. ${b.name.replace(/\s*\(.*\)\s*/, '').trim()}`).join('\n')

// Jawaban angka atas pertanyaan cabang: "1" untuk cabang pertama, "2" untuk kedua.
export function parseBranchPick(text: string, branches: BotBranch[]): BotBranch | null {
  const m = /^\s*([1-9])\s*[.!)]?\s*$/.exec(text)
  return m ? (branches[Number(m[1]) - 1] ?? null) : null
}

// Pintu masuk: cabang diambil dari pesan (di mana pun), lalu dari ingatan per nomor pelanggan.
export function handle(text: string, tires: Tire[], ctx: BotContext): Outcome {
  const tpl = ctx.templates ?? DEFAULT_TEMPLATES
  const msg = text.trim()
  const detected = detectBranch(msg, ctx.branches)
  const known = ctx.knownBranch ? (ctx.branches.find((b) => b.slug === ctx.knownBranch) ?? null) : null
  const label = (b: BotBranch) => b.name.replace(/\s*\(.*\)\s*/, '').trim()
  const plain = (kind: Outcome['kind'], reply: string, reason: string, b: BotBranch | null, awaiting: Outcome['awaiting'] = null): Outcome => ({
    kind,
    reply,
    adminNote: null,
    adminNumber: (b && ctx.adminNumbers[b.slug]) || ctx.ownerNumber || '',
    status: kind === 'tanya_cabang' ? 'BARU' : 'DIJAWAB_BOT',
    branchSlug: b?.slug ?? '',
    branchLabel: b ? label(b) : 'Bejo Ban',
    sizes: [],
    sizeLabel: '',
    result: '',
    reason,
    branchChosen: kind === 'cabang_diganti' && b ? b.slug : '',
    awaiting,
  })
  const confirm = (b: BotBranch) => plain('cabang_diganti', renderTemplate(tpl.cabangDiganti, { cabang: label(b) }), `cabang diganti ke ${b.slug}`, b)

  // Bot sedang menunggu jawaban cabang.
  if (ctx.awaiting) {
    const pick = parseBranchPick(msg, ctx.branches) ?? detected
    if (pick) {
      if (ctx.awaiting.action === 'ganti' || !ctx.awaiting.text) return confirm(pick)
      return { ...core(ctx.awaiting.text, tires, { ...ctx, awaiting: null }, pick), branchChosen: pick.slug }
    }
    // Pelanggan tidak menjawab: serahkan ke owner dengan cabang belum diketahui.
    return core(ctx.awaiting.text || msg, tires, { ...ctx, forceOwner: true, extraNote: `pelanggan tidak menjawab pilihan cabang, pesan terakhir: "${msg.slice(0, 120)}"` }, null)
  }

  if (RE_GANTI.test(msg)) {
    if (detected) return confirm(detected)
    return plain('tanya_cabang', renderTemplate(tpl.tanyaCabang, { pilihan: branchChoices(ctx.branches) }), 'pelanggan minta ganti cabang', known, { action: 'ganti', text: '' })
  }
  const o = core(msg, tires, ctx, detected ?? known)
  return { ...o, branchChosen: detected?.slug ?? '' }
}


