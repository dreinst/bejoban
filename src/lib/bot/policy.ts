// Aturan kapan bot boleh membalas. Modul murni supaya mudah diuji.
export type BotSettings = {
  enabled: boolean // saklar utama
  startTime: string // "08:00", waktu Jakarta
  endTime: string // "17:00"
  gapSec: number // jeda minimal antar balasan
  dailyLimit: number // batas balasan terkirim per hari
  numbers: string[] // nomor internal yang dilayani, format 62812...
  replyOnHandoff: boolean // false: diam saat diserahkan ke admin
}

export const DEFAULT_BOT: BotSettings = {
  enabled: false,
  startTime: '08:00',
  endTime: '17:00',
  gapSec: 20,
  dailyLimit: 50,
  numbers: [],
  replyOnHandoff: false,
}

export const mergeBot = (saved: Partial<BotSettings> | null | undefined): BotSettings => ({ ...DEFAULT_BOT, ...saved })

// "0812-3456 789", "+62 812..." menjadi "62812..."
export const normalizeNumber = (raw: string) => raw.replace(/@.*$/, '').replace(/\D/g, '').replace(/^0/, '62')

export const isInternal = (sender: string, s: BotSettings) => {
  const n = normalizeNumber(sender)
  return !!n && s.numbers.some((x) => normalizeNumber(x) === n)
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

export type Decision = { send: boolean; reason: string }

export function decide(p: {
  settings: BotSettings
  now: Date
  sender: string
  handoff: boolean
  adminReplied: boolean // admin sudah membalas chat ini setelah pesan masuk
  sentToday: number
  lastSentAt: Date | null
}): Decision {
  const { settings: s } = p
  if (!s.enabled) return { send: false, reason: 'saklar bot mati' }
  if (!isInternal(p.sender, s)) return { send: false, reason: 'nomor bukan internal' }
  if (p.adminReplied) return { send: false, reason: 'admin sudah membalas' }
  if (!withinHours(p.now, s)) return { send: false, reason: `di luar jam aktif ${s.startTime} sampai ${s.endTime}` }
  if (p.handoff && !s.replyOnHandoff) return { send: false, reason: 'diserahkan ke admin' }
  if (p.sentToday >= s.dailyLimit) return { send: false, reason: `batas harian ${s.dailyLimit} tercapai` }
  if (p.lastSentAt && p.now.getTime() - p.lastSentAt.getTime() < s.gapSec * 1000) return { send: false, reason: `jeda ${s.gapSec} detik belum lewat` }
  return { send: true, reason: 'boleh membalas' }
}
