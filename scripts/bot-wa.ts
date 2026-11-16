// Worker chatbot lewat WAHA (polling, bukan webhook). Satu sesi WAHA GOWS, satu nomor untuk dua cabang.
// Bawaan: uji kering, hanya mencetak dan mencatat balasan. Kirim sungguhan hanya kalau BOT_SEND=1.
//   npx tsx scripts/bot-wa.ts          jalan terus
//   npx tsx scripts/bot-wa.ts --once   satu putaran lalu berhenti
// Variabel: WAHA_URL, WAHA_API_KEY, WAHA_SESSION, BOT_SEND, BOT_POLL_SEC, BOT_MAX_AGE_MIN
import 'dotenv/config'
import { db } from '../src/lib/db'
import { loadBotSettings } from '../src/lib/bot/respond'
import { flushAwaiting, flushClosings, processChat, type Msg } from '../src/lib/bot/process'

const URL_ = (process.env.WAHA_URL ?? '').replace(/\/$/, '')
const KEY = process.env.WAHA_API_KEY ?? ''
const SESSION = process.env.WAHA_SESSION ?? 'default'
const LIVE = process.env.BOT_SEND === '1'
const POLL = Number(process.env.BOT_POLL_SEC ?? 15) * 1000
const MAX_AGE = Number(process.env.BOT_MAX_AGE_MIN ?? 10) * 60

async function waha(path: string, init?: RequestInit) {
  const res = await fetch(`${URL_}${path}`, { ...init, headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json', ...init?.headers } })
  if (!res.ok) throw new Error(`WAHA ${res.status} di ${path.split('?')[0]}`)
  return res.json()
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const send = async (chatId: string, text: string) => {
  await waha('/api/sendText', { method: 'POST', body: JSON.stringify({ session: SESSION, chatId, text }) })
}
// Label WhatsApp per cabang (mis. "Batu", "Karanglo") membantu admin memilah chat di aplikasi WhatsApp Business.
// Label hanya ada di akun WhatsApp Business, dan endpoint WAHA untuk label belum bisa diuji dari prototipe ini.
// Isi fungsi ini nanti, mis. dengan endpoint labels dari WAHA (cek dokumentasi versi yang dipakai).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const labelChat = async (chatId: string, branchSlug: string): Promise<void> => {
  // belum dikerjakan: sengaja kosong
}
const opts = { send, live: LIVE, maxAgeSec: MAX_AGE, log: console.log, labelChat }

async function poll() {
  const settings = await loadBotSettings()
  if (!settings.enabled) return console.log('Saklar bot mati, tidak ada yang diproses.')
  // Chat terbaru di sesi. Grup, status, dan newsletter dilewati.
  const chats: { id: string }[] = await waha(`/api/${encodeURIComponent(SESSION)}/chats/overview?limit=30`)
  for (const c of chats) {
    if (/@(g\.us|newsletter|broadcast)$/.test(c.id) || c.id.startsWith('status@')) continue
    let msgs: Msg[]
    try {
      msgs = await waha(`/api/${encodeURIComponent(SESSION)}/chats/${encodeURIComponent(c.id)}/messages?limit=10&downloadMedia=false`)
    } catch (e) {
      console.error(`[${c.id}] gagal baca pesan:`, (e as Error).message)
      continue
    }
    await processChat(c.id, msgs, opts)
  }
  await flushClosings(opts)
  await flushAwaiting(opts)
}

async function main() {
  if (!URL_ || !KEY) {
    console.error('Isi WAHA_URL dan WAHA_API_KEY di .env dulu.')
    process.exit(1)
  }
  console.log(`Worker bot: sesi ${SESSION}, ${LIVE ? 'MODE KIRIM' : 'uji kering (tidak mengirim)'}`)
  const once = process.argv.includes('--once')
  do {
    await poll().catch((e) => console.error('putaran gagal:', e.message))
    if (!once) await sleep(POLL)
  } while (!once)
  await db.$disconnect()
}

main()
