// Worker chatbot lewat WAHA (polling, bukan webhook). Satu sesi WAHA GOWS, satu nomor untuk dua cabang.
// Bawaan: uji kering, hanya mencetak dan mencatat balasan. Kirim sungguhan hanya kalau BOT_SEND=1.
//   npx tsx scripts/bot-wa.ts          jalan terus
//   npx tsx scripts/bot-wa.ts --once   satu putaran lalu berhenti
// Variabel: WAHA_URL, WAHA_API_KEY, WAHA_SESSION, BOT_SEND, BOT_POLL_SEC, BOT_MAX_AGE_MIN
import 'dotenv/config'
import { db } from '../src/lib/db'
import { loadBotSettings } from '../src/lib/bot/respond'
import { flushAwaiting, flushClosings, processChat, type Msg } from '../src/lib/bot/process'
import { cariLabel, labelBaruChat, mintaBuatLabel, mintaDaftarLabel, mintaLabelChat, mintaPasangLabel, rencanaLabelKering, type LabelWaha, type Langkah } from '../src/lib/bot/label'
import { namaPendek } from '../src/lib/tire/cabang'
import { catatKirimBot } from '../src/lib/cermin/simpan'

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
  const jawaban = await waha('/api/sendText', { method: 'POST', body: JSON.stringify({ session: SESSION, chatId, text }) })
  // Id pesan dicatat supaya cermin chat menandainya "bot", bukan "admin". Gagal mencatat tidak boleh mengganggu balasan.
  await catatKirimBot(jawaban).catch((e) => console.error(`Id kiriman bot tidak tercatat untuk cermin chat: ${(e as Error).message}`))
}
// Label WhatsApp Business per cabang ("Batu", "Karanglo") supaya admin bisa memilah chat di aplikasi.
// Endpoint label WAHA didukung engine GOWS (lihat docs/PANDUAN-ADMIN.md). Pembentuk permintaan ada di
// src/lib/bot/label.ts (murni, dites). Di mode uji kering langkahnya hanya dicetak, WAHA tidak dipanggil.
// Kegagalan apa pun (404, 501, engine tidak mendukung, jaringan) dicatat sekali lalu diabaikan: balasan bot tetap jalan.
const labelIds: Record<string, string> = {} // nama label huruf kecil -> id label WAHA, disimpan di memori worker
let labelGagalDicatat = false
let cabangCache: { slug: string; name: string }[] | null = null

async function jalankanLangkah<T>(l: Langkah): Promise<T> {
  const res = await fetch(`${URL_}${l.path}`, {
    method: l.method,
    headers: { 'X-Api-Key': KEY, 'Content-Type': 'application/json' },
    body: l.body === undefined ? undefined : JSON.stringify(l.body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`WAHA ${res.status} saat ${l.ket} (${l.method} ${l.path.split('?')[0]})`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

const labelChat = async (chatId: string, branchSlug: string): Promise<void> => {
  cabangCache ??= await db.branch.findMany({ orderBy: [{ sort: 'asc' }, { id: 'asc' }], select: { slug: true, name: true } })
  const tujuan = cabangCache.find((b) => b.slug === branchSlug)
  if (!tujuan) return
  const nama = namaPendek(tujuan.name)
  const kunci = nama.toLowerCase()
  if (!LIVE) {
    for (const l of rencanaLabelKering({ session: SESSION, chatId, nama, slug: branchSlug, idDiketahui: labelIds }))
      console.log(`  [label, uji kering] ${l.method} ${l.path}${l.body === undefined ? '' : ` ${JSON.stringify(l.body)}`} (${l.ket})`)
    return
  }
  try {
    if (!labelIds[kunci]) {
      for (const l of await jalankanLangkah<LabelWaha[]>(mintaDaftarLabel(SESSION))) labelIds[l.name.trim().toLowerCase()] = String(l.id)
      if (!labelIds[kunci]) {
        const baru = await jalankanLangkah<LabelWaha | null>(mintaBuatLabel(SESSION, nama, branchSlug))
        const id = baru?.id ?? cariLabel(await jalankanLangkah<LabelWaha[]>(mintaDaftarLabel(SESSION)), nama)?.id
        if (!id) throw new Error(`label "${nama}" tidak bisa dibuat`)
        labelIds[kunci] = String(id)
      }
    }
    const idLain = cabangCache.filter((b) => b.slug !== branchSlug).map((b) => labelIds[namaPendek(b.name).toLowerCase()]).filter(Boolean)
    const sekarang = (await jalankanLangkah<LabelWaha[] | null>(mintaLabelChat(SESSION, chatId))) ?? []
    const labels = labelBaruChat(sekarang.map((l) => ({ ...l, id: String(l.id) })), labelIds[kunci], idLain)
    if (labels) await jalankanLangkah(mintaPasangLabel(SESSION, chatId, labels, nama))
  } catch (e) {
    if (!labelGagalDicatat) {
      labelGagalDicatat = true
      console.error(`Label WhatsApp tidak bisa dipasang, balasan bot tetap jalan (pesan ini hanya muncul sekali): ${(e as Error).message}`)
    }
  }
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
