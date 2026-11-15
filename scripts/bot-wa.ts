// Worker chatbot stok lewat WAHA (polling, bukan webhook).
// Bawaan: uji kering, hanya mencetak balasan. Kirim sungguhan hanya kalau BOT_SEND=1.
//   npx tsx scripts/bot-wa.ts          jalan terus
//   npx tsx scripts/bot-wa.ts --once   satu putaran lalu berhenti
// Variabel: WAHA_URL, WAHA_API_KEY, WAHA_SESSION, BOT_SEND, BOT_POLL_SEC, BOT_MAX_AGE_MIN
import 'dotenv/config'
import { db } from '../src/lib/db'
import { respond, loadBotSettings } from '../src/lib/bot/respond'
import { decide, normalizeNumber } from '../src/lib/bot/policy'

const URL_ = (process.env.WAHA_URL ?? '').replace(/\/$/, '')
const KEY = process.env.WAHA_API_KEY ?? ''
const SESSION = process.env.WAHA_SESSION ?? 'default'
const SEND = process.env.BOT_SEND === '1'
const POLL = Number(process.env.BOT_POLL_SEC ?? 15) * 1000
const MAX_AGE = Number(process.env.BOT_MAX_AGE_MIN ?? 10) * 60

type Msg = { id: string; fromMe: boolean; timestamp: number; body?: string; from?: string }

async function waha(path: string, init?: RequestInit) {
  const res = await fetch(`${URL_}${path}`, { ...init, headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json', ...init?.headers } })
  if (!res.ok) throw new Error(`WAHA ${res.status} di ${path.split('?')[0]}`)
  return res.json()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function startOfToday() {
  const now = new Date()
  const jakarta = new Date(now.getTime() + 7 * 3600_000)
  jakarta.setUTCHours(0, 0, 0, 0)
  return new Date(jakarta.getTime() - 7 * 3600_000)
}

async function poll() {
  const settings = await loadBotSettings()
  for (const number of settings.numbers.map(normalizeNumber).filter(Boolean)) {
    const chatId = `${number}@c.us`
    let msgs: Msg[]
    try {
      msgs = await waha(`/api/${encodeURIComponent(SESSION)}/chats/${encodeURIComponent(chatId)}/messages?limit=10&downloadMedia=false`)
    } catch (e) {
      console.error(`[${number}] gagal baca pesan:`, (e as Error).message)
      continue
    }
    msgs.sort((a, b) => a.timestamp - b.timestamp)
    const seen = new Set((await db.botProcessed.findMany({ where: { messageId: { in: msgs.map((m) => m.id) } } })).map((p) => p.messageId))
    const fresh = msgs.filter((m) => !m.fromMe && !seen.has(m.id))
    for (const m of fresh) {
      // Catat dulu supaya tidak pernah dibalas dua kali, apa pun hasilnya.
      await db.botProcessed.create({ data: { messageId: m.id } }).catch(() => null)
      const text = (m.body ?? '').trim()
      if (!text) continue
      const age = Date.now() / 1000 - m.timestamp
      if (age > MAX_AGE) {
        console.log(`[${number}] pesan lama (${Math.round(age / 60)} menit), dilewati`)
        continue
      }
      const adminReplied = msgs.some((x) => x.fromMe && x.timestamp >= m.timestamp)
      const a = await respond(text)
      const last = await db.botLog.findFirst({ where: { sent: true }, orderBy: { createdAt: 'desc' } })
      const sentToday = await db.botLog.count({ where: { sent: true, createdAt: { gte: await startOfToday() } } })
      const d = decide({ settings, now: new Date(), sender: number, handoff: a.handoff, adminReplied, sentToday, lastSentAt: last?.createdAt ?? null })
      let sent = false
      if (d.send && SEND) {
        await waha('/api/sendText', { method: 'POST', body: JSON.stringify({ session: SESSION, chatId, text: a.reply }) })
        sent = true
      }
      await db.botLog.create({
        data: { source: SEND ? 'WA' : 'WA_KERING', sender: number, input: text, reply: a.reply, handoff: a.handoff, sent, reason: `${d.reason}. ${a.reason}`.slice(0, 500) },
      })
      console.log(`[${number}] ${JSON.stringify(text)}\n  keputusan: ${d.reason}${d.send && !SEND ? ' (uji kering, tidak dikirim)' : ''}\n  balasan:\n${a.reply.replace(/^/gm, '    ')}`)
      if (sent) await sleep(settings.gapSec * 1000)
    }
  }
}

async function main() {
  if (!URL_ || !KEY) {
    console.error('Isi WAHA_URL dan WAHA_API_KEY di .env dulu.')
    process.exit(1)
  }
  console.log(`Worker bot stok: sesi ${SESSION}, ${SEND ? 'MODE KIRIM' : 'uji kering (tidak mengirim)'}`)
  const once = process.argv.includes('--once')
  do {
    await poll().catch((e) => console.error('putaran gagal:', e.message))
    if (!once) await sleep(POLL)
  } while (!once)
  await db.$disconnect()
}

main()
