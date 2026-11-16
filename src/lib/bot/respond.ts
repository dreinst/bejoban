// Penghubung mesin jawab dengan database. Dipakai halaman admin dan worker.
import { db } from '../db'
import { handle, type BotContext, type Outcome, type Service, type Tire } from './engine'
import { mergeBot, jamBukaText, type BotSettings } from './policy'
import { mergeSosmed, mergeTemplates, type Sosmed, type Templates } from './templates'

const read = async (key: string) => {
  const row = await db.setting.findUnique({ where: { key } })
  return row ? JSON.parse(row.value) : null
}

export const loadBotSettings = async (): Promise<BotSettings> => mergeBot(await read('bot'))
export const loadTemplates = async (): Promise<Templates> => mergeTemplates(await read('bot.templates'))
export const loadSosmed = async (): Promise<Sosmed> => mergeSosmed(await read('bot.sosmed'))

export async function loadContext(settings?: BotSettings): Promise<{ ctx: BotContext; tires: Tire[]; settings: BotSettings }> {
  const s = settings ?? (await loadBotSettings())
  const [branches, tires, services, templates] = await Promise.all([
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { slug: true, name: true } }),
    db.stockTire.findMany({ select: { id: true, ring: true, sizeRaw: true, sizeNorm: true, brand: true, price: true, discount: true, stock: true, note: true } }),
    db.servicePrice.findMany({ orderBy: { sort: 'asc' } }),
    loadTemplates(),
  ])
  return {
    ctx: { branches: branches.map((b) => ({ ...b, aliases: s.branchAliases[b.slug] ?? [] })), adminNumbers: s.adminNumbers, ownerNumber: s.ownerNumber, templates, services: services as Service[], jamBuka: jamBukaText(s) },
    tires,
    settings: s,
  }
}

export async function runBot(text: string, customer = '', extra: Partial<BotContext> = {}): Promise<Outcome> {
  const { ctx, tires } = await loadContext()
  return handle(text, tires, { ...ctx, customer, ...extra })
}
