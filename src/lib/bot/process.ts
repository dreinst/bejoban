// Proses satu chat untuk worker: pesan baru, status percakapan, serah terima, dan pengiriman.
// Tidak bicara ke WAHA sendiri: pengiriman lewat fungsi `send` yang diberikan pemanggil.
import { db } from '../db'
import { renderTemplate } from '../text/template'
import { isClosed, isMuted, memoryFresh, muteUntil, nextStatus, type Status } from './conversation'
import { findSizes } from '../tire/size'
import { decide, jamBukaText, normalizeNumber } from './policy'
import { handle, type AwaitAction } from './engine'
import { loadContext } from './respond'

export type Msg = { id: string; fromMe: boolean; timestamp: number; body?: string }
export type Sender = (chatId: string, text: string) => Promise<void>

export const startOfTodayJakarta = (now = new Date()) => {
  const j = new Date(now.getTime() + 7 * 3600_000)
  j.setUTCHours(0, 0, 0, 0)
  return new Date(j.getTime() - 7 * 3600_000)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Opts = {
  send: Sender
  now?: Date
  maxAgeSec?: number
  live: boolean
  log?: (s: string) => void
  // Label WhatsApp per cabang (akun WhatsApp Business). Dipanggil saat cabang percakapan diketahui atau berubah.
  // Kegagalan tidak boleh menghentikan balasan, jadi pemanggilnya di bawah dibungkus try/catch.
  labelChat?: (chatId: string, branchSlug: string) => Promise<void>
}

// Kirim satu pesan dengan memperhatikan jeda dan mencatat ke log.
async function deliver(o: Opts, chatId: string, text: string, meta: { source: string; sender: string; input: string; reason: string; handoff: boolean; conversationId: number | null }, gapSec: number) {
  let sent = false
  if (o.live) {
    const last = await db.botLog.findFirst({ where: { sent: true }, orderBy: { createdAt: 'desc' } })
    if (last) {
      const wait = last.createdAt.getTime() + gapSec * 1000 - Date.now()
      if (wait > 0) await sleep(wait)
    }
    await o.send(chatId, text)
    sent = true
  }
  await db.botLog.create({ data: { ...meta, reply: text, sent, source: o.live ? meta.source : 'WA_KERING' } })
  o.log?.(`  -> ${chatId}${sent ? '' : ' (uji kering, tidak dikirim)'}\n${text.replace(/^/gm, '     ')}`)
}

export async function processChat(chatId: string, messages: Msg[], o: Opts) {
  const now = o.now ?? new Date()
  const msgs = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const customer = normalizeNumber(chatId)
  const seen = new Set((await db.botProcessed.findMany({ where: { messageId: { in: msgs.map((m) => m.id) } } })).map((p) => p.messageId))
  const fresh = msgs.filter((m) => !m.fromMe && !seen.has(m.id))

  for (const m of fresh) {
    // Dicatat dulu supaya tidak pernah dibalas dua kali, apa pun hasilnya.
    await db.botProcessed.create({ data: { messageId: m.id } }).catch(() => null)
    const text = (m.body ?? '').trim()
    if (!text) continue
    if (now.getTime() / 1000 - m.timestamp > (o.maxAgeSec ?? 600)) {
      o.log?.(`[${customer}] pesan lama, dilewati`)
      continue
    }
    const { ctx, tires, settings } = await loadContext()
    let conv = await db.botConversation.findFirst({ where: { chatId, status: { notIn: ['SELESAI_ADA', 'SELESAI_TIDAK_ADA'] } }, orderBy: { id: 'desc' } })
    let questionText = text // pertanyaan asli, bukan jawaban "1" atau "2" atas pertanyaan cabang
    const meta = (reason: string, handoff = false) => ({ source: 'WA', sender: customer, input: text, reason, handoff, conversationId: conv?.id ?? null })
    const ensureConv = async (data: { status: Status; branchSlug?: string; sizes?: string; result?: string; mutedUntil?: Date | null; awaitingBranch?: boolean; pendingAction?: string; pendingText?: string }) => {
      const base = { question: questionText.slice(0, 500), ...data, branchSlug: data.branchSlug || conv?.branchSlug || '' }
      conv = conv
        ? await db.botConversation.update({ where: { id: conv.id }, data: base })
        : await db.botConversation.create({ data: { chatId, customer, ...base } })
    }

    if (conv && isMuted(conv, now)) {
      await db.botLog.create({ data: { ...meta('bot diam: percakapan diserahkan ke admin'), reply: '', sent: false } })
      continue
    }
    const adminReplied = msgs.some((x) => x.fromMe && x.timestamp >= m.timestamp)
    if (adminReplied) {
      await ensureConv({ status: conv ? nextStatus(conv.status as Status, 'admin_membalas') : 'DISERAHKAN', mutedUntil: muteUntil(now, settings.muteHours) })
      await db.botLog.create({ data: { ...meta('admin sudah membalas'), reply: '', sent: false } })
      continue
    }

    const sentToday = await db.botLog.count({ where: { sent: true, createdAt: { gte: startOfTodayJakarta(now) } } })
    const d = decide({ settings, now, sender: customer, sentToday })
    const mem = await db.botBranchChoice.findUnique({ where: { customer } })
    const memFresh = mem && memoryFresh(mem, now, settings.branchMemoryDays) ? mem.branchSlug : undefined
    const out = handle(text, tires, {
      ...ctx,
      customer,
      knownBranch: memFresh,
      awaiting: conv?.awaitingBranch ? { action: (conv.pendingAction as AwaitAction) || 'serah', text: conv.pendingText } : null,
    })
    if (conv?.awaitingBranch && conv.pendingText && out.kind !== 'tanya_cabang') questionText = conv.pendingText
    // Cabang yang disebut atau dipilih pelanggan diingat per nomor.
    if (out.branchChosen) {
      await db.botBranchChoice.upsert({ where: { customer }, create: { customer, branchSlug: out.branchChosen, chosenAt: now }, update: { branchSlug: out.branchChosen, chosenAt: now } })
    }

    if (d.action === 'diam') {
      if (d.reason.startsWith('batas harian')) await ensureConv({ status: 'BARU', branchSlug: out.branchSlug })
      await db.botLog.create({ data: { ...meta(d.reason), reply: '', sent: false } })
      o.log?.(`[${customer}] diam: ${d.reason}`)
      continue
    }
    if (d.action === 'luar_jam') {
      const today = startOfTodayJakarta(now)
      await ensureConv({ status: 'BARU', branchSlug: out.branchSlug })
      if (!conv!.lastOutOfHoursAt || conv!.lastOutOfHoursAt < today) {
        const reply = renderTemplate(ctx.templates!.diLuarJam, { cabang: out.branchLabel, jamBuka: jamBukaText(settings) })
        await deliver(o, chatId, reply, meta(d.reason), settings.gapSec)
        await db.botConversation.update({ where: { id: conv!.id }, data: { lastOutOfHoursAt: now } })
      }
      continue
    }

    const handoff = out.kind === 'serah'
    const asking = out.kind === 'tanya_cabang'
    const prevBranch = conv?.branchSlug ?? ''
    await ensureConv({
      status: asking ? (conv ? (conv.status as Status) : 'BARU') : nextStatus((conv?.status as Status) ?? 'BARU', handoff ? 'bot_serahkan' : 'bot_menjawab'),
      branchSlug: out.branchSlug,
      awaitingBranch: asking,
      pendingAction: asking ? out.awaiting?.action : '',
      pendingText: asking ? out.awaiting?.text : '',
      sizes: out.sizes.join(','),
      result: out.result,
      mutedUntil: handoff ? muteUntil(now, settings.muteHours) : null,
    })
    if (conv?.branchSlug && conv.branchSlug !== prevBranch) {
      try {
        await o.labelChat?.(chatId, conv.branchSlug)
      } catch (e) {
        o.log?.(`[${customer}] label WhatsApp gagal, balasan tetap dikirim: ${(e as Error).message}`)
      }
    }
    o.log?.(`[${customer}] ${JSON.stringify(text)} -> ${out.kind} (${out.reason})`)
    await deliver(o, chatId, out.reply, meta(`${d.reason}. ${out.reason}`, handoff), settings.gapSec)
    if (handoff && out.adminNote && out.adminNumber) {
      await deliver(o, `${normalizeNumber(out.adminNumber)}@c.us`, out.adminNote, { ...meta('ringkasan untuk admin', true), sender: normalizeNumber(out.adminNumber) }, settings.gapSec)
    }
  }
}

// Kirim penutup "tidak tersedia" untuk percakapan yang baru ditandai admin.
export async function flushClosings(o: Opts) {
  const now = o.now ?? new Date()
  const pending = await db.botConversation.findMany({ where: { status: 'SELESAI_TIDAK_ADA', closingPending: true } })
  if (!pending.length) return
  const { ctx, settings } = await loadContext()
  for (const c of pending) {
    const d = decide({ settings, now, sender: c.customer, sentToday: await db.botLog.count({ where: { sent: true, createdAt: { gte: startOfTodayJakarta(now) } } }) })
    if (d.action !== 'balas') continue
    const branch = ctx.branches.find((b) => b.slug === c.branchSlug)
    const reply = renderTemplate(ctx.templates!.penutupTidakTersedia, {
      cabang: branch ? branch.name.replace(/\s*\(.*\)\s*/, '').trim() : 'Bejo Ban',
      ukuran: c.sizes ? c.sizes.split(',').map((n) => findSizes(n)[0]?.label ?? n).join(', ') : 'barang yang kakak tanyakan',
    })
    await deliver(o, c.chatId, reply, { source: 'WA', sender: c.customer, input: '(penutup tidak tersedia)', reason: 'admin menandai tidak tersedia', handoff: false, conversationId: c.id }, settings.gapSec)
    await db.botConversation.update({ where: { id: c.id }, data: { closingPending: false } })
  }
}

export { isClosed }

// Pelanggan tidak menjawab pertanyaan cabang dalam waktu yang diatur: serahkan ke owner.
export async function flushAwaiting(o: Opts) {
  const now = o.now ?? new Date()
  const { ctx, tires, settings } = await loadContext()
  const waiting = await db.botConversation.findMany({ where: { awaitingBranch: true, status: { notIn: ['SELESAI_ADA', 'SELESAI_TIDAK_ADA'] } } })
  for (const c of waiting) {
    if (now.getTime() - c.updatedAt.getTime() < settings.branchWaitMin * 60_000) continue
    const sentToday = await db.botLog.count({ where: { sent: true, createdAt: { gte: startOfTodayJakarta(now) } } })
    if (decide({ settings, now, sender: c.customer, sentToday }).action !== 'balas') continue
    const out = handle(c.pendingText, tires, { ...ctx, customer: c.customer, forceOwner: true, extraNote: 'pelanggan tidak menjawab pertanyaan cabang' })
    await db.botConversation.update({
      where: { id: c.id },
      data: { awaitingBranch: false, pendingAction: '', pendingText: '', status: out.kind === 'serah' ? 'DISERAHKAN' : c.status, mutedUntil: out.kind === 'serah' ? muteUntil(now, settings.muteHours) : null, result: out.result },
    })
    const meta = { source: 'WA', sender: c.customer, input: c.pendingText, reason: `pertanyaan cabang tidak dijawab. ${out.reason}`, handoff: out.kind === 'serah', conversationId: c.id }
    await deliver(o, c.chatId, out.reply, meta, settings.gapSec)
    if (out.adminNote && out.adminNumber) await deliver(o, `${normalizeNumber(out.adminNumber)}@c.us`, out.adminNote, { ...meta, sender: normalizeNumber(out.adminNumber), reason: 'ringkasan untuk owner' }, settings.gapSec)
  }
}
