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
  const [branches, rows, services, templates, byOrder] = await Promise.all([
    db.branch.findMany({ orderBy: { sort: 'asc' }, select: { id: true, slug: true, name: true } }),
    db.stockTire.findMany({ where: { aktif: true }, select: { id: true, ring: true, sizeRaw: true, sizeNorm: true, brand: true, price: true, discount: true, stock: true, note: true, cabangId: true } }),
    db.servicePrice.findMany({ orderBy: { sort: 'asc' } }),
    loadTemplates(),
    db.brand.findMany({ where: { byOrder: true }, select: { name: true } }),
  ])
  // Mesin jawab memakai slug cabang. Cabang yang sudah tidak ada tetap dianggap bercabang (tidak pernah cocok).
  const slug = (id: number | null) => (id === null ? null : (branches.find((b) => b.id === id)?.slug ?? `cabang-${id}`))
  const tires: Tire[] = rows.map(({ cabangId, ...t }) => ({ ...t, cabang: slug(cabangId) }))
  return {
    ctx: {
      branches: branches.map((b) => ({ slug: b.slug, name: b.name, aliases: s.branchAliases[b.slug] ?? [] })),
      adminNumbers: s.adminNumbers,
      ownerNumber: s.ownerNumber,
      templates,
      services: services as Service[],
      jamBuka: jamBukaText(s),
      stokPerCabang: s.stokPerCabang,
      byOrderBrands: byOrder.map((b) => b.name),
    },
    tires,
    settings: s,
  }
}

export async function runBot(text: string, customer = '', extra: Partial<BotContext> = {}): Promise<Outcome> {
  const { ctx, tires } = await loadContext()
  return handle(text, tires, { ...ctx, customer, ...extra })
}
