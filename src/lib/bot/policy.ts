// Aturan kapan bot boleh membalas. Modul murni supaya mudah diuji.
export type BotSettings = {
  enabled: boolean // saklar utama
  startTime: string // "08:00", waktu Jakarta
  endTime: string // "17:00"
  gapSec: number // jeda minimal antar pesan terkirim
  dailyLimit: number // batas pesan terkirim per hari
  muteHours: number // lama bot diam di chat yang diserahkan ke admin
  restrictNumbers: boolean // true: hanya melayani nomor uji (aman selama masih uji coba)
  testNumbers: string[] // nomor uji, format 62812...
  adminNumbers: Record<string, string> // slug cabang -> nomor admin untuk serah terima
  branchMemoryDays: number // lama pilihan cabang pelanggan diingat
  branchWaitMin: number // menit menunggu jawaban cabang sebelum diserahkan ke owner
  branchAliases: Record<string, string[]> // kata lain pengenal cabang, kunci: slug
  ownerNumber: string // dipakai kalau cabang tidak dikenali atau nomor admin kosong
  stokPerCabang: boolean // true: stok bercabang hanya disebut untuk cabang pelanggan, cabang ditanyakan dulu
}

export const DEFAULT_BOT: BotSettings = {
  enabled: false,
  startTime: '08:00',
  endTime: '17:00',
  gapSec: 20,
  dailyLimit: 100,
  muteHours: 6,
  restrictNumbers: true,
  testNumbers: [],
  adminNumbers: {},
  branchMemoryDays: 30,
  branchWaitMin: 15,
  branchAliases: { karanglo: ['singosari'] },
  ownerNumber: '',
  stokPerCabang: true,
}

export const mergeBot = (saved: (Partial<BotSettings> & { numbers?: string[] }) | null | undefined): BotSettings => {
  const { numbers, ...rest } = saved ?? {}
  return { ...DEFAULT_BOT, ...(numbers && !rest.testNumbers ? { testNumbers: numbers } : {}), ...rest, adminNumbers: { ...rest.adminNumbers }, branchAliases: { ...DEFAULT_BOT.branchAliases, ...rest.branchAliases } }
}

// "0812-3456 789", "+62 812...", "62812...@c.us" menjadi "62812..."
export const normalizeNumber = (raw: string) => raw.replace(/@.*$/, '').replace(/\D/g, '').replace(/^0/, '62')

export const isTestNumber = (sender: string, s: BotSettings) => {
  const n = normalizeNumber(sender)
  return !!n && s.testNumbers.some((x) => normalizeNumber(x) === n)
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Menit sejak tengah malam, waktu Jakarta (UTC+7, tanpa DST).
export const jakartaMinutes = (d: Date) => (d.getUTCHours() * 60 + d.getUTCMinutes() + 7 * 60) % (24 * 60)

export const withinHours = (now: Date, s: BotSettings) => {
  const m = jakartaMinutes(now)
  const a = toMin(s.startTime)
  const b = toMin(s.endTime)
  return a <= b ? m >= a && m < b : m >= a || m < b
}

export const jamBukaText = (s: BotSettings) => `${s.startTime.replace(':', '.')} sampai ${s.endTime.replace(':', '.')}`

export type Decision = { action: 'balas' | 'luar_jam' | 'diam'; reason: string }

// Jeda antar pesan tidak diperiksa di sini: pengirim menunggu sampai jeda lewat.
export function decide(p: { settings: BotSettings; now: Date; sender: string; sentToday: number }): Decision {
  const { settings: s } = p
  if (!s.enabled) return { action: 'diam', reason: 'saklar bot mati' }
  if (s.restrictNumbers && !isTestNumber(p.sender, s)) return { action: 'diam', reason: 'nomor bukan nomor uji (pembatasan nomor aktif)' }
  if (!withinHours(p.now, s)) return { action: 'luar_jam', reason: `di luar jam aktif ${s.startTime} sampai ${s.endTime}` }
  if (p.sentToday >= s.dailyLimit) return { action: 'diam', reason: `batas harian ${s.dailyLimit} tercapai` }
  return { action: 'balas', reason: 'boleh membalas' }
}
